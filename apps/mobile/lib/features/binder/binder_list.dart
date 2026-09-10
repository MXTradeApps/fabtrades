import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/card_filter_bar.dart';
import '../../app/printing_picker.dart';
import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/data/card_repository.dart';
import '../../core/logic/pricing.dart';
import '../../core/models/binder.dart';
import '../../core/models/binder_entry.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import '../card_detail/card_detail_screen.dart';
import '../paywall/pro_limits.dart';
import '../scan/scan_screen.dart';
import '../search/card_picker.dart';
import '../sync/binder_refresh.dart';
import 'binder_grid.dart';

/// Existing Binder list chrome scoped to one [binderId].
class BinderList extends ConsumerStatefulWidget {
  const BinderList({super.key, required this.binderId, required this.pricing});

  final String binderId;
  final Pricing pricing;

  @override
  ConsumerState<BinderList> createState() => _BinderListState();
}

class _BinderListState extends ConsumerState<BinderList> {
  static const _pageSize = 50;

  final _controller = TextEditingController();
  Timer? _debounce;
  int _page = 0;

  @override
  void didUpdateWidget(BinderList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.binderId != widget.binderId) _page = 0;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      ref.read(binderFiltersProvider.notifier).setQuery(value);
      if (mounted) setState(() => _page = 0);
    });
  }

  void _clearQuery() {
    _debounce?.cancel();
    _controller.clear();
    ref.read(binderFiltersProvider.notifier).setQuery('');
    setState(() => _page = 0);
  }

  void _clearFilters() {
    _debounce?.cancel();
    _controller.clear();
    ref.read(binderFiltersProvider.notifier).clear();
    setState(() => _page = 0);
  }

  @override
  Widget build(BuildContext context) {
    final all = ownedInBinder(ref.watch(binderProvider), widget.binderId);
    final pricing = widget.pricing;
    final binders = ref.watch(bindersProvider);

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
                  binderId: widget.binderId,
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
    final pageRows = _pageSlice(visible);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
          child: CardSearchBar(
            controller: _controller,
            hintText: 'Search Binder…',
            dense: true,
            onChanged: _onChanged,
            onClear: _clearQuery,
            sort: filters.sort,
            onSort: (s) {
              setState(() => _page = 0);
              ref.read(binderFiltersProvider.notifier).setSort(s);
            },
          ),
        ),
        if (visible.isNotEmpty)
          _BinderPager(
            page: _clampedPage(visible.length),
            pageSize: _pageSize,
            total: visible.length,
            onPage: (next) => setState(() => _page = next),
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
                    itemCount: pageRows.length,
                    separatorBuilder: (_, _) =>
                        const Divider(height: 1, indent: 46),
                    itemBuilder: (context, i) => _EntryRow(
                      entry: pageRows[i],
                      pricing: pricing,
                      binderId: widget.binderId,
                      liveBinders: binders,
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  int _clampedPage(int total) {
    final last = math.max(0, ((total + _pageSize - 1) ~/ _pageSize) - 1);
    return _page.clamp(0, last).toInt();
  }

  List<BinderEntry> _pageSlice(List<BinderEntry> visible) {
    if (visible.isEmpty) return const [];
    final page = _clampedPage(visible.length);
    final start = page * _pageSize;
    final end = math.min(start + _pageSize, visible.length);
    return visible.sublist(start, end);
  }
}

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

class _BinderPager extends StatelessWidget {
  const _BinderPager({
    required this.page,
    required this.pageSize,
    required this.total,
    required this.onPage,
  });

  final int page;
  final int pageSize;
  final int total;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    if (total <= pageSize) return const SizedBox.shrink();
    final last = math.max(0, ((total + pageSize - 1) ~/ pageSize) - 1);
    final from = page * pageSize + 1;
    final to = math.min((page + 1) * pageSize, total);
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 4),
      child: Row(
        key: const Key('binderPager'),
        children: [
          Expanded(
            child: Text(
              '$from–$to of $total',
              key: const Key('binderPagerLabel'),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          IconButton(
            key: const Key('binderPagerPrev'),
            tooltip: 'Previous page',
            visualDensity: VisualDensity.compact,
            onPressed: page > 0 ? () => onPage(page - 1) : null,
            icon: const Icon(Icons.chevron_left),
          ),
          IconButton(
            key: const Key('binderPagerNext'),
            tooltip: 'Next page',
            visualDensity: VisualDensity.compact,
            onPressed: page < last ? () => onPage(page + 1) : null,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
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
                  : 'No cards in this Binder.',
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
              'Scan a stack or search by name to add Printings.',
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

class _EntryRow extends ConsumerWidget {
  const _EntryRow({
    required this.entry,
    required this.pricing,
    required this.binderId,
    required this.liveBinders,
  });
  final BinderEntry entry;
  final Pricing pricing;
  final String binderId;
  final List<Binder> liveBinders;

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
    ref.read(binderProvider.notifier).replaceCard(
          card.id,
          entry.isWanted,
          picked,
          binderId: binderId,
        );
  }

  Future<void> _move(BuildContext context, WidgetRef ref) async {
    final dests = Binder.gridOrder(liveBinders)
        .where((b) => b.isLive && !b.isWant && b.clientId != binderId)
        .toList();
    if (dests.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No other Binder to move into')),
      );
      return;
    }
    final dest = await showModalBottomSheet<Binder>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(title: Text('Move to Binder')),
            for (final binder in dests)
              ListTile(
                key: Key('moveDest-${binder.clientId}'),
                title: Text(binder.name),
                onTap: () => Navigator.pop(ctx, binder),
              ),
          ],
        ),
      ),
    );
    if (dest == null || !context.mounted) return;
    var qty = entry.quantity;
    if (entry.quantity > 1) {
      final picked = await showDialog<int>(
        context: context,
        builder: (ctx) => _MoveQtyDialog(max: entry.quantity),
      );
      if (picked == null || !context.mounted) return;
      qty = picked;
    }
    final result = ref.read(binderProvider.notifier).moveCopies(
          printingId: entry.card.id,
          fromBinderId: binderId,
          toBinderId: dest.clientId,
          quantity: qty,
          condition: entry.condition,
        );
    if (!result.ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.reason ?? 'Could not move')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final notifier = ref.read(binderProvider.notifier);
    final card = entry.card;
    final lineValue = (pricing.value(card) ?? 0) * entry.quantity;
    final catalog = ref.watch(catalogProvider).asData?.value ?? const [];
    final dests = Binder.gridOrder(liveBinders)
        .where((b) => b.isLive && !b.isWant && b.clientId != binderId)
        .toList();

    return Dismissible(
      key: ValueKey(
          '${card.id}_${entry.isWanted}_${entry.resolvedBinderId}_${entry.condition}'),
      direction: DismissDirection.endToStart,
      background: Container(
        color: AppTheme.negative,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) => notifier.remove(
        card.id,
        entry.isWanted,
        binderId: binderId,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
        child: Row(
          children: [
            GestureDetector(
              key: Key('binderArt-${card.id}'),
              onTap: () => _openDetail(context, card),
              child: CardThumbnail(
                url: card.imageUrl,
                foil: card.isFoil,
                width: 28,
                height: 40,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: InkWell(
                key: Key('binderRow-${card.id}'),
                onTap: () => _pickVersion(context, ref, catalog),
                child: Semantics(
                  button: true,
                  label: 'Change printing',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(card.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 1),
                      CardMetaLine(card: card),
                    ],
                  ),
                ),
              ),
            ),
            if (dests.isNotEmpty)
              TextButton(
                key: Key('moveBinder-${card.id}'),
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 2),
                  textStyle: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600),
                ),
                onPressed: () => _move(context, ref),
                child: const Text('Move'),
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
                const SizedBox(height: 2),
                _MiniStepper(
                  qty: entry.quantity,
                  onInc: () => notifier.setQuantity(
                    card.id,
                    entry.isWanted,
                    entry.quantity + 1,
                    binderId: binderId,
                  ),
                  onDec: () => notifier.setQuantity(
                    card.id,
                    entry.isWanted,
                    entry.quantity - 1,
                    binderId: binderId,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MoveQtyDialog extends StatefulWidget {
  const _MoveQtyDialog({required this.max});
  final int max;

  @override
  State<_MoveQtyDialog> createState() => _MoveQtyDialogState();
}

class _MoveQtyDialogState extends State<_MoveQtyDialog> {
  late int _qty = widget.max;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Move copies'),
      content: Row(
        children: [
          IconButton(
            onPressed: _qty > 1 ? () => setState(() => _qty--) : null,
            icon: const Icon(Icons.remove),
          ),
          Text('$_qty', key: const Key('moveQty')),
          IconButton(
            onPressed: _qty < widget.max ? () => setState(() => _qty++) : null,
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, _qty),
          child: const Text('Move'),
        ),
      ],
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
                padding: EdgeInsets.all(4), child: Icon(Icons.remove, size: 14)),
          ),
          SizedBox(
            width: 18,
            child: Text('$qty',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 12)),
          ),
          InkWell(
            onTap: onInc,
            child: const Padding(
                padding: EdgeInsets.all(4), child: Icon(Icons.add, size: 14)),
          ),
        ],
      ),
    );
  }
}
