import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/app.dart';
import '../../app/card_filter_bar.dart';
import '../../app/widgets.dart';
import '../../core/analytics/analytics.dart';
import '../../core/data/card_repository.dart';
import '../../core/data/set_logo_cache.dart';
import '../../core/data/set_logos.dart';
import '../../core/data/set_published_on.dart';
import '../../core/logic/recent_movers.dart';
import '../../core/logic/set_abbreviation.dart';
import '../../core/logic/set_sort.dart';
import '../../core/models/app_settings.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import '../card_detail/card_detail_screen.dart';
import '../scan/scan_screen.dart';
import 'mover_box.dart';
import 'trends_screen.dart';

/// Top-level Home tab: a See Trending row, then the set list. Searching
/// short-circuits both and shows every matching printing across the whole catalog.
class BrowseScreen extends ConsumerStatefulWidget {
  const BrowseScreen({super.key});

  @override
  ConsumerState<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends ConsumerState<BrowseScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';
  CardSort _sort = CardSort.nameAsc;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() {}); // refresh clear button
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      final query = value.trim();
      setState(() => _query = query);
      if (query.isEmpty) return;
      final catalog = ref.read(catalogProvider).asData?.value ?? const [];
      final resultsCount = filterCards(
        catalog,
        CardFilters(query: query, sort: _sort),
      ).length;
      ref.read(analyticsProvider).capture('search_performed', {
        'search_query': query,
        'query_length': query.length,
        'results_count': resultsCount,
      });
    });
  }

  void _clear() {
    _controller.clear();
    _debounce?.cancel();
    setState(() => _query = '');
  }

  Future<void> _refresh() => refreshPricesWithToast(context, ref);

  @override
  Widget build(BuildContext context) {
    final searching = _query.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            tooltip: 'Scan a card',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                settings: const RouteSettings(name: 'Scan'),
                builder: (_) => const ScanScreen(),
              ),
            ),
          ),
          const AppMenuAction(),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
            child: CardSearchBar(
              controller: _controller,
              hintText: 'Search all cards…',
              onChanged: _onChanged,
              onClear: _clear,
              sort: _sort,
              onSort: (s) => setState(() => _sort = s),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: searching
                  ? _GlobalSearchResults(query: _query, sort: _sort)
                  : CustomScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      slivers: [
                        const SliverToBoxAdapter(
                          child: SeeTrendingTile(),
                        ),
                        const _SetList(),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The list of sets to drill into (shown when the global search is empty).
class _SetList extends ConsumerStatefulWidget {
  const _SetList();

  @override
  ConsumerState<_SetList> createState() => _SetListState();
}

class _SetListState extends ConsumerState<_SetList> {
  var _memoryPrecacheStarted = false;

  void _precacheLogosIfNeeded(SetLogoMap logos) {
    if (_memoryPrecacheStarted || logos.isEmpty) return;
    _memoryPrecacheStarted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      SetLogoCache.precacheIntoMemory(
        context,
        logos.urls,
        onCached: SetLogoTitle.markWarm,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    // Flesh and Blood has ~100 sets that grow over time, so the browsable set
    // list is derived from whatever the pipeline has loaded rather than a fixed
    // list. Watching the catalog here also preloads it as soon as the app
    // opens, so tapping into a set later is instant.
    final catalog = ref.watch(catalogProvider);
    final logos = ref.watch(setLogoMapProvider).asData?.value ?? SetLogoMap.empty;
    final publishedOn =
        ref.watch(setPublishedOnMapProvider).asData?.value ??
            SetPublishedOnMap.empty;
    _precacheLogosIfNeeded(logos);
    return catalog.when(
      loading: () => const SliverFillRemaining(
        child: Center(child: CircularProgressIndicator.adaptive()),
      ),
      error: (e, _) => SliverFillRemaining(
        child: _ScrollableCenter(
          child: _ErrorView(
            message: e.toString(),
            onRetry: () => ref.invalidate(catalogProvider),
          ),
        ),
      ),
      data: (cards) {
        // setName → TCGplayer group id (for logo lookup). First seen wins.
        final setIds = <String, int>{};
        final collectorNumbersBySet = <String, List<String?>>{};
        for (final c in cards) {
          if (isNonCardProduct(c)) continue;
          final s = c.setName;
          if (s == null) continue;
          final id = c.setId;
          if (id != null) setIds.putIfAbsent(s, () => id);
          collectorNumbersBySet.putIfAbsent(s, () => <String?>[]).add(
                c.collectorNumber,
              );
        }
        final sets = CardRepository.setNamesFrom(
          cards,
          publishedOnForGroupId: publishedOn.forGroupId,
        );
        if (sets.isEmpty) {
          return const SliverFillRemaining(
            child: _ScrollableCenter(child: _EmptyView()),
          );
        }

        // Flatten section headers + set rows so one list can render both.
        final entries = <_BrowseEntry>[];
        int? lastTier;
        for (final set in sets) {
          final tier = setBrowseTier(set);
          if (tier != lastTier) {
            entries.add(_BrowseSectionHeader(browseTierLabel(tier)));
            lastTier = tier;
          }
          final groupId = setIds[set];
          final abbreviation = resolveSetAbbreviation(
            logos.abbreviationForGroupId(groupId),
            collectorNumbersBySet[set] ?? const <String?>[],
          );
          entries.add(
            _BrowseSetRow(
              setName: set,
              logoUrl: logos.urlForGroupId(groupId),
              abbreviation: abbreviation,
              alwaysShowName: tier == BrowseTier.silverAge,
            ),
          );
        }

        // Retained frames in SetLogoCache keep logos painted if a row is
        // disposed while a set is open and remounted on pop.
        return SliverPadding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          sliver: SliverList.builder(
            itemCount: entries.length,
            itemBuilder: (context, i) {
              final entry = entries[i];
              return switch (entry) {
                _BrowseSectionHeader(:final label) => _SetSectionHeader(
                    label: label,
                    isFirst: i == 0,
                  ),
                _BrowseSetRow(
                  :final setName,
                  :final logoUrl,
                  :final abbreviation,
                  :final alwaysShowName,
                ) =>
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _SetTile(
                        key: ValueKey<String>(setName),
                        setName: setName,
                        logoUrl: logoUrl,
                        abbreviation: abbreviation,
                        alwaysShowName: alwaysShowName,
                      ),
                      if (i < entries.length - 1 &&
                          entries[i + 1] is _BrowseSetRow)
                        const Divider(height: 1, indent: 16),
                    ],
                  ),
              };
            },
          ),
        );
      },
    );
  }
}

sealed class _BrowseEntry {
  const _BrowseEntry();
}

class _BrowseSectionHeader extends _BrowseEntry {
  const _BrowseSectionHeader(this.label);
  final String label;
}

class _BrowseSetRow extends _BrowseEntry {
  const _BrowseSetRow({
    required this.setName,
    required this.logoUrl,
    required this.abbreviation,
    required this.alwaysShowName,
  });
  final String setName;
  final String? logoUrl;
  final String abbreviation;
  final bool alwaysShowName;
}

class _SetSectionHeader extends StatelessWidget {
  const _SetSectionHeader({required this.label, required this.isFirst});

  final String label;
  final bool isFirst;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, isFirst ? 4 : 16, 16, 6),
      child: Text(
        label.toUpperCase(),
        style: theme.textTheme.labelLarge?.copyWith(
          color: scheme.onSurfaceVariant,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

/// One browsable set row. Kept alive so logos stay mounted while scrolling.
class _SetTile extends ConsumerStatefulWidget {
  const _SetTile({
    super.key,
    required this.setName,
    required this.logoUrl,
    required this.abbreviation,
    required this.alwaysShowName,
  });

  final String setName;
  final String? logoUrl;
  final String abbreviation;
  final bool alwaysShowName;

  @override
  ConsumerState<_SetTile> createState() => _SetTileState();
}

class _SetTileState extends ConsumerState<_SetTile>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      title: SetLogoTitle(
        setName: widget.setName,
        logoUrl: widget.logoUrl,
        abbreviation: widget.abbreviation,
        alwaysShowName: widget.alwaysShowName,
      ),
      trailing: const Icon(Icons.chevron_right),
      onTap: () {
        ref.read(searchFiltersProvider.notifier).enterSet(widget.setName);
        Navigator.of(context).push(
          MaterialPageRoute(
            settings: const RouteSettings(name: 'Set Cards'),
            builder: (_) => SetCardsScreen(setName: widget.setName),
          ),
        );
      },
    );
  }
}

/// Trend boxes for a global (all-sets) query typed on Home. Ranked movers
/// and the set list are covered while this is showing. In-set search stays a
/// [_PrintingList].
class _GlobalSearchResults extends ConsumerStatefulWidget {
  const _GlobalSearchResults({required this.query, required this.sort});
  final String query;
  final CardSort sort;

  @override
  ConsumerState<_GlobalSearchResults> createState() =>
      _GlobalSearchResultsState();
}

class _GlobalSearchResultsState extends ConsumerState<_GlobalSearchResults> {
  Timer? _overlayDebounce;
  int _overlayGen = 0;
  var _overlays = const <RecentLowChange>[];
  Object? _overlayError;
  String? _scheduledKey;

  @override
  void dispose() {
    _overlayDebounce?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _GlobalSearchResults oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.query != widget.query || oldWidget.sort != widget.sort) {
      _overlayDebounce?.cancel();
      _overlayGen++;
      _overlays = const [];
      _overlayError = null;
      _scheduledKey = null;
    }
  }

  void _ensureOverlayFetch(List<CardModel> cards, String source) {
    final ids = cards.map((c) => c.id).toList();
    final key = '$source|${ids.join(',')}';
    if (key == _scheduledKey) return;
    _scheduledKey = key;
    _overlayDebounce?.cancel();
    if (ids.isEmpty) {
      _overlayGen++;
      return;
    }
    final gen = ++_overlayGen;
    _overlayDebounce = Timer(const Duration(milliseconds: 300), () {
      _fetchOverlays(ids, gen);
    });
  }

  Future<void> _fetchOverlays(List<String> ids, int gen) async {
    final source = ref.read(settingsProvider).source.name;
    try {
      final rows = await ref
          .read(cardRepositoryProvider)
          .printingRecentChanges(source, ids);
      if (!mounted || gen != _overlayGen) return;
      setState(() {
        _overlays = rows;
        _overlayError = null;
      });
    } catch (error) {
      if (!mounted || gen != _overlayGen) return;
      setState(() {
        _overlays = const [];
        _overlayError = error;
      });
    }
  }

  void _retryOverlays(List<CardModel> cards) {
    final ids = cards.map((c) => c.id).toList();
    if (ids.isEmpty) return;
    final gen = ++_overlayGen;
    setState(() => _overlayError = null);
    _fetchOverlays(ids, gen);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AppSettings>(settingsProvider, (prev, next) {
      if (prev?.source != next.source) {
        _overlayDebounce?.cancel();
        _overlayGen++;
        _overlays = const [];
        _overlayError = null;
        _scheduledKey = null;
      }
    });

    final catalog = ref.watch(catalogProvider);
    final pricing = ref.watch(pricingProvider);
    final source = ref.watch(settingsProvider).source.name;

    return catalog.when(
      loading: () => const Center(child: CircularProgressIndicator.adaptive()),
      error: (e, _) => _ScrollableCenter(
        child: _ErrorView(
          message: e.toString(),
          onRetry: () => ref.invalidate(catalogProvider),
        ),
      ),
      data: (all) {
        final filtered = filterCards(
          all,
          CardFilters(query: widget.query, sort: widget.sort),
        );
        _ensureOverlayFetch(filtered, source);
        if (filtered.isEmpty) {
          return const _ScrollableCenter(child: _EmptyView());
        }
        final overlayById = {
          for (final row in _overlays) row.cardId: row,
        };
        return ListView.builder(
          key: const Key('search-trend-boxes'),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 16),
          itemCount: filtered.length + (_overlayError != null ? 1 : 0),
          itemBuilder: (context, i) {
            if (_overlayError != null && i == 0) {
              return Column(
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text('Couldn’t load recent changes.'),
                  ),
                  TextButton(
                    onPressed: () => _retryOverlays(filtered),
                    child: const Text('Retry'),
                  ),
                ],
              );
            }
            final card = filtered[_overlayError != null ? i - 1 : i];
            final overlay = overlayById[card.id];
            return MoverBox(
              name: card.name,
              setName: card.setName ?? '',
              finish: card.subTypeName ?? '',
              currentLow: pricing.lowValue(card),
              percentChange: overlay?.percentChange,
              amountChange: overlay?.amountChange,
              pricing: pricing,
              onSelect: () => Navigator.of(context).push(
                MaterialPageRoute(
                  settings: const RouteSettings(name: 'Card Detail'),
                  builder: (_) =>
                      CardDetailScreen(card: card, source: 'search'),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

/// Cards within a single set — every printing listed individually — with
/// search / sort and pull-to-refresh.
class SetCardsScreen extends ConsumerStatefulWidget {
  const SetCardsScreen({super.key, required this.setName});

  final String setName;

  @override
  ConsumerState<SetCardsScreen> createState() => _SetCardsScreenState();
}

class _SetCardsScreenState extends ConsumerState<SetCardsScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    ref.read(analyticsProvider).capture('set_opened', {
      'set_name': widget.setName,
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() {}); // refresh clear button
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      final query = value.trim();
      ref.read(searchFiltersProvider.notifier).setQuery(value);
      if (query.isEmpty) return;
      final resultsCount =
          ref.read(browseResultsProvider).asData?.value.length ?? 0;
      ref.read(analyticsProvider).capture('search_performed', {
        'search_query': query,
        'query_length': query.length,
        'results_count': resultsCount,
      });
    });
  }

  /// Clear the TextField and the provider query together so they cannot desync.
  void _clearQuery() {
    _debounce?.cancel();
    _controller.clear();
    ref.read(searchFiltersProvider.notifier).setQuery('');
    setState(() {});
  }

  /// Pull-to-refresh: re-query Supabase so the latest synced prices show up,
  /// then toast when the pipeline last updated pricing.
  Future<void> _refresh() => refreshPricesWithToast(context, ref);

  @override
  Widget build(BuildContext context) {
    final results = ref.watch(browseResultsProvider);
    final filters = ref.watch(searchFiltersProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.setName),
        actions: const [AppMenuAction()],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
            child: CardSearchBar(
              controller: _controller,
              hintText: 'Search in ${widget.setName}…',
              onChanged: _onChanged,
              onClear: _clearQuery,
              sort: filters.sort,
              onSort: (s) =>
                  ref.read(searchFiltersProvider.notifier).setSort(s),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: results.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator.adaptive()),
                error: (e, _) => _ScrollableCenter(
                  child: _ErrorView(
                    message: e.toString(),
                    onRetry: () => ref.invalidate(catalogProvider),
                  ),
                ),
                data: (list) {
                  if (list.isEmpty) {
                    return const _ScrollableCenter(child: _EmptyView());
                  }
                  return _PrintingList(cards: list, source: 'set');
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Refreshes the catalog from Supabase, then shows a toast noting when the
/// pricing pipeline last refreshed prices (and from which marketplace).
Future<void> refreshPricesWithToast(BuildContext context, WidgetRef ref) async {
  try {
    await ref.read(catalogProvider.notifier).refresh();
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(const SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text('Could not refresh prices. Check your connection.'),
        ));
    }
    return;
  }
  ref.read(analyticsProvider).capture('prices_refreshed');
  if (!context.mounted) return;
  final updatedAt = ref.read(priceUpdatedAtProvider);
  final source = ref.read(pricingProvider).sourceLabel;
  ScaffoldMessenger.of(context)
    ..clearSnackBars()
    ..showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
        content: Row(
          children: [
            const Icon(Icons.schedule, size: 18, color: Colors.white),
            const SizedBox(width: 10),
            Expanded(
              child: Text('${_priceUpdatedLabel(updatedAt)} · $source pricing'),
            ),
          ],
        ),
      ),
    );
}

/// A short, human "prices updated …" phrase from the pipeline timestamp.
String _priceUpdatedLabel(DateTime? updatedAt) {
  if (updatedAt == null) return 'Prices refreshed';
  final local = updatedAt.toLocal();
  final diff = DateTime.now().difference(local);
  final String when;
  if (diff.inMinutes < 1) {
    when = 'just now';
  } else if (diff.inMinutes < 60) {
    when = '${diff.inMinutes}m ago';
  } else if (diff.inHours < 24) {
    when = '${diff.inHours}h ago';
  } else if (diff.inDays == 1) {
    when = 'yesterday';
  } else if (diff.inDays < 7) {
    when = '${diff.inDays}d ago';
  } else {
    when = DateFormat('MMM d').format(local);
  }
  return 'Prices updated $when';
}

/// A scrollable list of individual printings, shared by the set view and
/// global search. Each row opens card detail with that printing pre-selected.
class _PrintingList extends StatelessWidget {
  const _PrintingList({required this.cards, required this.source});
  final List<CardModel> cards;

  /// Where these results came from — `search` or `set` — passed through to
  /// [CardDetailScreen] for the `card_detail_viewed` event.
  final String source;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 16),
      itemCount: cards.length,
      separatorBuilder: (_, _) => const Divider(height: 1, indent: 14),
      itemBuilder: (context, i) =>
          _PrintingTile(card: cards[i], source: source),
    );
  }
}

/// One printing in the browse list. Tapping opens card detail with this
/// printing selected; the detail screen's version selector still lists every
/// sibling printing of the same card.
class _PrintingTile extends ConsumerWidget {
  const _PrintingTile({required this.card, required this.source});
  final CardModel card;
  final String source;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pricing = ref.watch(pricingProvider);

    void openDetail() => Navigator.of(context).push(
          MaterialPageRoute(
            settings: const RouteSettings(name: 'Card Detail'),
            builder: (_) => CardDetailScreen(card: card, source: source),
          ),
        );

    return CardRow(
      card: card,
      priceLabel: pricing.priceLabel(card),
      secondaryLabel: pricing.lowPriceLabel(card),
      priceSource: pricing.sourceLabel,
      showThumbnail: false,
      inlineBadges: true,
      onTap: openDetail,
      trailing: Icon(Icons.chevron_right,
          color: Theme.of(context).colorScheme.onSurfaceVariant),
    );
  }
}

/// Wraps a centered widget in an always-scrollable view so pull-to-refresh
/// still works when the list is empty or errored.
class _ScrollableCenter extends StatelessWidget {
  const _ScrollableCenter({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.search_off, size: 48, color: scheme.outline),
        const SizedBox(height: 12),
        const Text('No cards match your filters.'),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off, size: 44),
          const SizedBox(height: 12),
          Text('Could not load cards.\n$message',
              textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton.tonal(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
