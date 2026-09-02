import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/logic/binder_value_snapshot.dart';
import '../../core/logic/pricing.dart';
import '../../core/logic/recent_movers.dart';
import '../../core/models/app_settings.dart';
import '../../core/models/binder.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import '../card_detail/card_detail_screen.dart';
import '../search/mover_box.dart';
import 'binder_grid.dart';

/// Binder-tab page for the currently open Binder. Dual-currency total and
/// movers come from live Binder + catalog; movers must not block the headline.
class CollectionStatsScreen extends ConsumerStatefulWidget {
  const CollectionStatsScreen({super.key});

  @override
  ConsumerState<CollectionStatsScreen> createState() =>
      _CollectionStatsScreenState();
}

class _CollectionStatsScreenState extends ConsumerState<CollectionStatsScreen> {
  int _moversGen = 0;
  var _moversLoading = false;
  Object? _moversError;
  List<RecentMoverRow> _moverRows = const [];
  String? _fetchedKey;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pricing = ref.watch(pricingProvider);
    final settings = ref.watch(settingsProvider);
    final binders = ref.watch(bindersProvider);
    final openId = ref.watch(openBinderIdProvider) ?? BinderIds.trade;
    final binder = ownedInBinder(ref.watch(binderProvider), openId);
    final binderName = () {
      for (final b in binders) {
        if (b.clientId == openId && b.isLive) return b.name;
      }
      return 'Binder';
    }();

    final usdAmount = chosenSourceHeadlineAmount(
      binder,
      source: PriceSource.tcgplayer,
    );
    final eurAmount = chosenSourceHeadlineAmount(
      binder,
      source: PriceSource.cardmarket,
    );
    final ids = ownedPrintingIds(binder);
    final copies = copiesByPrintingId(binder);
    final moversKey = '${settings.source.name}:${(List<String>.from(ids)..sort()).join(',')}';

    ref.listen<AppSettings>(settingsProvider, (prev, next) {
      if (prev?.source != next.source) {
        _fetchedKey = null;
      }
    });

    if (_fetchedKey != moversKey) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadMovers(settings.source.name, ids, moversKey);
      });
    }

    const usd = Pricing(AppSettings(source: PriceSource.tcgplayer));
    const eur = Pricing(AppSettings(source: PriceSource.cardmarket));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Collection Stats'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          Text(
            binderName,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          _StatsSection(
            sectionKey: const Key('collectionStatsHeadline'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Total Value',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        usd.format(usdAmount),
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppTheme.positive,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        eur.format(eurAmount),
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppTheme.positive,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _StatsSection(
            child: _BinderMoversBlock(
              rows: _visibleMovers(copies),
              loading: _moversLoading,
              error: _moversError,
              emptyIds: ids.isEmpty,
              sourceLabel: pricing.sourceLabel,
              pricing: pricing,
              copies: copies,
              onRetry: () => _loadMovers(settings.source.name, ids, moversKey),
              onSelect: _openPrinting,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Observed catalog numbers, not an appraisal. Values follow ${pricing.sourceLabel}.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  List<RecentMoverRow> _visibleMovers(Map<String, int> copies) {
    return _moverRows.where((row) {
      final qty = copies[row.cardId];
      return qty != null && qty > 0;
    }).toList(growable: false);
  }

  Future<void> _loadMovers(
    String source,
    List<String> ids,
    String key,
  ) async {
    final gen = ++_moversGen;
    _fetchedKey = key;
    if (ids.isEmpty) {
      if (!mounted || gen != _moversGen) return;
      setState(() {
        _moverRows = const [];
        _moversError = null;
        _moversLoading = false;
      });
      return;
    }
    setState(() {
      _moversLoading = true;
      _moversError = null;
    });
    try {
      final rows = await ref.read(cardRepositoryProvider).recentMovers(
            source,
            cardIds: ids,
          );
      if (!mounted || gen != _moversGen) return;
      setState(() {
        _moverRows = rows;
        _moversLoading = false;
      });
    } catch (error) {
      if (!mounted || gen != _moversGen) return;
      setState(() {
        _moversError = error;
        _moversLoading = false;
      });
    }
  }

  void _openPrinting(String cardId) {
    final catalog =
        ref.read(catalogProvider).asData?.value ?? const <CardModel>[];
    CardModel? printing;
    for (final card in catalog) {
      if (card.id == cardId) {
        printing = card;
        break;
      }
    }
    if (printing == null) {
      final openId = ref.read(openBinderIdProvider) ?? BinderIds.trade;
      for (final entry in ownedInBinder(ref.read(binderProvider), openId)) {
        if (entry.card.id == cardId) {
          printing = entry.card;
          break;
        }
      }
    }
    if (printing == null) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'Card Detail'),
        builder: (_) =>
            CardDetailScreen(card: printing!, source: 'collection_stats'),
      ),
    );
  }
}

class _StatsSection extends StatelessWidget {
  const _StatsSection({this.sectionKey, required this.child});

  final Key? sectionKey;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      key: sectionKey,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}

class _BinderMoversBlock extends StatelessWidget {
  const _BinderMoversBlock({
    required this.rows,
    required this.loading,
    required this.error,
    required this.emptyIds,
    required this.sourceLabel,
    required this.pricing,
    required this.copies,
    required this.onRetry,
    required this.onSelect,
  });

  final List<RecentMoverRow> rows;
  final bool loading;
  final Object? error;
  final bool emptyIds;
  final String sourceLabel;
  final Pricing pricing;
  final Map<String, int> copies;
  final VoidCallback onRetry;
  final void Function(String cardId) onSelect;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gainers = rows.where((r) => r.isGainer).toList();
    final losers = rows.where((r) => !r.isGainer).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Recent movers',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        if (loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator.adaptive()),
          )
        else if (error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              children: [
                Text(
                  'Couldn’t load recent movers from $sourceLabel.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium,
                ),
                TextButton(onPressed: onRetry, child: const Text('Retry')),
              ],
            ),
          )
        else if (emptyIds || rows.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              emptyIds
                  ? 'No Printings in this Binder to rank.'
                  : 'None of these Printings gained or lost enough to rank.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          )
        else ...[
          _DirectionList(
            title: 'Gainers',
            rows: gainers,
            pricing: pricing,
            copies: copies,
            up: true,
            emptyCopy: 'None of these Printings gained enough to rank.',
            onSelect: onSelect,
          ),
          const Divider(height: 24),
          _DirectionList(
            title: 'Losers',
            rows: losers,
            pricing: pricing,
            copies: copies,
            up: false,
            emptyCopy: 'None of these Printings lost enough to rank.',
            onSelect: onSelect,
          ),
        ],
      ],
    );
  }
}

class _DirectionList extends StatelessWidget {
  const _DirectionList({
    required this.title,
    required this.rows,
    required this.pricing,
    required this.copies,
    required this.up,
    required this.emptyCopy,
    required this.onSelect,
  });

  final String title;
  final List<RecentMoverRow> rows;
  final Pricing pricing;
  final Map<String, int> copies;
  final bool up;
  final String emptyCopy;
  final void Function(String cardId) onSelect;

  @override
  Widget build(BuildContext context) {
    final color = up ? AppTheme.positive : AppTheme.negative;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w700,
              ),
        ),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              emptyCopy,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          )
        else
          for (final row in rows)
            MoverBox(
              name: row.name,
              setName: row.setName,
              finish: row.finish,
              currentLow: row.latestLow,
              percentChange: row.percentChange,
              amountChange: row.amountChange,
              copies: copies[row.cardId],
              pricing: pricing,
              onSelect: () => onSelect(row.cardId),
            ),
      ],
    );
  }
}
