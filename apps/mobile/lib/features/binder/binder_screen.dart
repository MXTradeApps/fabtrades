import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:showcaseview/showcaseview.dart';

import '../../app/app.dart';
import '../../app/card_filter_bar.dart';
import '../../app/printing_picker.dart';
import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/data/card_repository.dart';
import '../../core/logic/pricing.dart';
import '../../core/models/binder_entry.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import '../card_detail/card_detail_screen.dart';
import '../onboarding/onboarding_keys.dart';
import '../onboarding/onboarding_provider.dart';
import '../onboarding/onboarding_repository.dart';
import '../onboarding/showcase_theme.dart';
import '../onboarding/tour_controller.dart';
import '../onboarding/tour_copy.dart';
import '../paywall/pro_limits.dart';
import '../scan/scan_screen.dart';
import '../search/card_picker.dart';
import '../sync/binder_refresh.dart';
import '../want_list/want_list_screen.dart';
import 'binder_value_sheet.dart';

class BinderScreen extends ConsumerStatefulWidget {
  const BinderScreen({super.key});

  @override
  ConsumerState<BinderScreen> createState() => _BinderScreenState();
}

class _BinderScreenState extends ConsumerState<BinderScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 2, vsync: this);
  bool _wantTourStarted = false;

  @override
  void initState() {
    super.initState();
    _tab.addListener(_onTabChanged);
  }

  void _onTabChanged() {
    if (_tab.indexIsChanging) return;
    setState(() {});
    if (_tab.index == 1) _maybeStartWantListTour();
  }

  void _maybeStartWantListTour() {
    if (_wantTourStarted) return;
    if (ref.read(onboardingProvider).contains(OnboardingTourId.wantList)) {
      return;
    }

    // Don't interrupt a home-shell tour already running (e.g. Binder).
    final home = ShowcaseView.getNamed(OnboardingKeys.homeScope);
    if (home.isShowcaseRunning) return;

    _wantTourStarted = true;
    final hasCards =
        ref.read(binderProvider).any((e) => e.isWanted && e.quantity > 0);
    final tours = TourController(ref);
    final keys = tours.wantListKeys(hasCards: hasCards);

    late final void Function(GlobalKey?) onDismiss;
    void finishTour() {
      tours.markSeen(OnboardingTourId.wantList);
      home.removeOnFinishCallback(finishTour);
      home.removeOnDismissCallback(onDismiss);
    }

    onDismiss = (GlobalKey? _) => finishTour();

    home.addOnFinishCallback(finishTour);
    home.addOnDismissCallback(onDismiss);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _tab.index != 1) {
        finishTour();
        return;
      }
      tours.startHomeTour(keys);
    });
  }

  @override
  void dispose() {
    _tab.removeListener(_onTabChanged);
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final entries = ref.watch(binderProvider);
    final pricing = ref.watch(pricingProvider);
    final binder = entries.where((e) => !e.isWanted).toList();
    final wanted = entries.where((e) => e.isWanted).toList();
    final onBinderTab = _tab.index == 0;
    final binderTotal = binder.fold<double>(
        0, (s, e) => s + (pricing.value(e.card) ?? 0) * e.quantity);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Binder'),
        actions: const [AppMenuAction()],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(46),
          child: ShowcaseTheme.mark(
            key: OnboardingKeys.binderTabs,
            title: TourCopy.binderTabsTitle,
            description: TourCopy.binderTabsBody,
            child: TabBar(
              controller: _tab,
              tabs: [
                Tab(text: 'Binder (${_count(binder)})'),
                Tab(text: 'Want List (${_count(wanted)})'),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          _BinderList(allEntries: binder, pricing: pricing),
          WantListPane(
            onAdd: () => _addBySearch(isWanted: true),
          ),
        ],
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: SizedBox(
          width: MediaQuery.sizeOf(context).width - 32,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (onBinderTab && binder.isNotEmpty)
                ShowcaseTheme.mark(
                  key: OnboardingKeys.binderTotal,
                  title: TourCopy.binderTotalTitle,
                  description: TourCopy.binderTotalBody,
                  child: _BinderValueChip(
                    total: pricing.formatValue(binderTotal),
                    onTap: () => showBinderValueSheet(context),
                  ),
                )
              else
                const SizedBox.shrink(),
              ShowcaseTheme.mark(
                key: OnboardingKeys.binderFab,
                title: TourCopy.binderFabTitle,
                description: TourCopy.binderFabBody,
                child: FloatingActionButton.extended(
                  heroTag: 'binderFab',
                  onPressed: () => onBinderTab
                      ? _showBinderAddOptions(context)
                      : _addBySearch(isWanted: true),
                  icon: const Icon(Icons.add),
                  label: Text(onBinderTab ? 'Add card' : 'Add want'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  int _count(List<BinderEntry> e) => e.fold<int>(0, (s, x) => s + x.quantity);

  Future<void> _showBinderAddOptions(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.qr_code_scanner),
              title: const Text('Scan cards'),
              subtitle: const Text('Add each match and keep scanning'),
              onTap: () {
                Navigator.pop(ctx);
                // Push after the sheet closes — same-frame pop+push can drop
                // the route on some Android builds.
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (context.mounted) ScanScreen.forBinder(context);
                });
              },
            ),
            ListTile(
              leading: const Icon(Icons.search),
              title: const Text('Add by search'),
              onTap: () {
                Navigator.pop(ctx);
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (context.mounted) _addBySearch(isWanted: false);
                });
              },
            ),
          ],
        ),
      ),
      routeSettings: const RouteSettings(name: 'Add To Binder'),
    );
  }

  Future<void> _addBySearch({required bool isWanted}) async {
    await CardPickerScreen.showMulti(
      context,
      title: isWanted ? 'Add to Want List' : 'Add to Binder',
      onPick: (card) => addToBinderOrUpsell(
        context,
        ref,
        card,
        isWanted: isWanted,
        successMessage:
            'Added ${card.name} to ${isWanted ? 'Want List' : 'Binder'}',
        source: 'search',
      ),
    );
  }
}

class _BinderList extends ConsumerStatefulWidget {
  const _BinderList({required this.allEntries, required this.pricing});

  final List<BinderEntry> allEntries;
  final Pricing pricing;

  @override
  ConsumerState<_BinderList> createState() => _BinderListState();
}

class _BinderListState extends ConsumerState<_BinderList> {
  final _controller = TextEditingController();
  Timer? _debounce;

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
      ref.read(binderFiltersProvider.notifier).setQuery(value);
    });
  }

  void _clearQuery() {
    _debounce?.cancel();
    _controller.clear();
    ref.read(binderFiltersProvider.notifier).setQuery('');
    setState(() {});
  }

  void _clearFilters() {
    _debounce?.cancel();
    _controller.clear();
    ref.read(binderFiltersProvider.notifier).clear();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final all = widget.allEntries;
    final pricing = widget.pricing;

    if (all.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => refreshBinderSync(context, ref),
        child: _ScrollableCenter(
          child: _BinderEmptyState(
            onScan: () {
              if (context.mounted) ScanScreen.forBinder(context);
            },
            onSearch: () async {
              await CardPickerScreen.showMulti(
                context,
                title: 'Add to Binder',
                onPick: (card) => addToBinderOrUpsell(
                  context,
                  ref,
                  card,
                  successMessage: 'Added ${card.name} to Binder',
                  source: 'search',
                ),
              );
            },
          ),
        ),
      );
    }

    final filters = ref.watch(binderFiltersProvider);
    final visible = ref.watch(filteredBinderProvider);
    final hasQuery = filters.query.trim().isNotEmpty;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
          child: CardSearchBar(
            controller: _controller,
            hintText: 'Search binder…',
            dense: true,
            onChanged: _onChanged,
            onClear: _clearQuery,
            sort: filters.sort,
            onSort: (s) => ref.read(binderFiltersProvider.notifier).setSort(s),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => refreshBinderSync(context, ref),
            child: visible.isEmpty
                ? _ScrollableCenter(
                    child: _BinderNoMatches(
                      hasQuery: hasQuery || filters.hasActiveFilters,
                      onClear: _clearFilters,
                    ),
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.only(bottom: 96),
                    itemCount: visible.length,
                    separatorBuilder: (_, _) =>
                        const Divider(height: 1, indent: 72),
                    itemBuilder: (context, i) =>
                        _EntryRow(entry: visible[i], pricing: pricing),
                  ),
          ),
        ),
      ],
    );
  }
}

/// Always-scrollable wrapper so pull-to-refresh works on empty / no-match views.
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

class _BinderNoMatches extends StatelessWidget {
  const _BinderNoMatches({required this.hasQuery, required this.onClear});
  final bool hasQuery;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off, size: 48, color: scheme.outline),
            const SizedBox(height: 12),
            Text(
              hasQuery
                  ? 'No cards match your filters.'
                  : 'No cards in binder.',
              textAlign: TextAlign.center,
            ),
            if (hasQuery) ...[
              const SizedBox(height: 16),
              TextButton(onPressed: onClear, child: const Text('Clear filters')),
            ],
          ],
        ),
      ),
    );
  }
}

class _BinderEmptyState extends StatelessWidget {
  const _BinderEmptyState({required this.onScan, required this.onSearch});
  final VoidCallback onScan;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.menu_book_outlined, size: 56, color: scheme.outline),
            const SizedBox(height: 16),
            Text('Your Binder is empty',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              'Add the cards you\'re willing to trade. Scan a stack or search '
              'by name — no separate chore.',
              textAlign: TextAlign.center,
              style: TextStyle(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onScan,
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Scan cards'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onSearch,
              icon: const Icon(Icons.search),
              label: const Text('Add by search'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact FAB-height chip showing binder total, opposite the Add button.
class _BinderValueChip extends StatelessWidget {
  const _BinderValueChip({required this.total, required this.onTap});
  final String total;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    const color = AppTheme.positive;
    return Material(
      elevation: 6,
      shadowColor: Colors.black54,
      color: scheme.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        key: const Key('binderValueChip'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Semantics(
          button: true,
          label: 'Binder value',
          child: SizedBox(
            height: 56,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Center(
                child: Text(
                  total,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _EntryRow extends ConsumerWidget {
  const _EntryRow({required this.entry, required this.pricing});
  final BinderEntry entry;
  final Pricing pricing;

  void _openDetail(BuildContext context, CardModel card) {
    Navigator.of(context).push(MaterialPageRoute(
      settings: const RouteSettings(name: 'Card Detail'),
      builder: (_) => CardDetailScreen(card: card, source: 'binder'),
    ));
  }

  Future<void> _pickVersion(
    BuildContext context,
    WidgetRef ref,
    List<CardModel> catalog,
  ) async {
    final card = entry.card;
    final printings = printingsForCard(catalog, card);
    final picked = await showPrintingPicker(
      context: context,
      current: card,
      printings: printings,
      priceLabel: pricing.priceLabel,
    );
    if (picked == null) return;
    ref
        .read(binderProvider.notifier)
        .replaceCard(card.id, entry.isWanted, picked);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final notifier = ref.read(binderProvider.notifier);
    final card = entry.card;
    final lineValue = (pricing.value(card) ?? 0) * entry.quantity;
    final catalog = ref.watch(catalogProvider).asData?.value ?? const [];
    final printings = printingsForCard(catalog, card);

    return Dismissible(
      key: ValueKey('${card.id}_${entry.isWanted}'),
      direction: DismissDirection.endToStart,
      background: Container(
        color: AppTheme.negative,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) => notifier.remove(card.id, entry.isWanted),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Row(
          children: [
            GestureDetector(
              onTap: () => _openDetail(context, card),
              child: CardThumbnail(url: card.imageUrl, foil: card.isFoil),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GestureDetector(
                    onTap: () => _openDetail(context, card),
                    child: Text(card.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(height: 3),
                  GestureDetector(
                    onTap: printings.length >= 2
                        ? () => _pickVersion(context, ref, catalog)
                        : () => _openDetail(context, card),
                    child: Row(
                      children: [
                        Expanded(child: CardMetaLine(card: card)),
                        if (printings.length >= 2)
                          Icon(Icons.unfold_more,
                              size: 16,
                              color: theme.colorScheme.onSurfaceVariant),
                      ],
                    ),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      if (card.finishBadgeLabel != null) ...[
                        FinishBadge(card: card),
                        const SizedBox(width: 5),
                      ],
                      _ConditionChip(
                        condition: entry.condition,
                        onChanged: (c) => notifier.setCondition(
                            card.id, entry.isWanted, c),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(pricing.formatValue(lineValue),
                    style: theme.textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w800)),
                if (pricing.lowPriceLabel(card) != null)
                  Text(pricing.lowPriceLabel(card)!,
                      style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 4),
                _MiniStepper(
                  qty: entry.quantity,
                  onInc: () => notifier.setQuantity(
                      card.id, entry.isWanted, entry.quantity + 1),
                  onDec: () => notifier.setQuantity(
                      card.id, entry.isWanted, entry.quantity - 1),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ConditionChip extends StatelessWidget {
  const _ConditionChip({required this.condition, required this.onChanged});
  final String condition;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return PopupMenuButton<String>(
      onSelected: onChanged,
      itemBuilder: (_) => BinderEntry.conditions
          .map((c) => PopupMenuItem(value: c, child: Text(c)))
          .toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: scheme.secondaryContainer,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(condition,
                style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSecondaryContainer)),
            Icon(Icons.arrow_drop_down,
                size: 14, color: scheme.onSecondaryContainer),
          ],
        ),
      ),
    );
  }
}

class _MiniStepper extends StatelessWidget {
  const _MiniStepper(
      {required this.qty, required this.onInc, required this.onDec});
  final int qty;
  final VoidCallback onInc;
  final VoidCallback onDec;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: onDec,
            child: const Padding(
                padding: EdgeInsets.all(5), child: Icon(Icons.remove, size: 15)),
          ),
          SizedBox(
            width: 20,
            child: Text('$qty',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 13)),
          ),
          InkWell(
            onTap: onInc,
            child: const Padding(
                padding: EdgeInsets.all(5), child: Icon(Icons.add, size: 15)),
          ),
        ],
      ),
    );
  }
}
