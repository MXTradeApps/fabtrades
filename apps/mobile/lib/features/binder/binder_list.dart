import 'dart:async';

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
  final _controller = TextEditingController();
  Timer? _debounce;

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
                    itemBuilder: (context, i) => _EntryRow(
                      entry: visible[i],
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
        .where((b) => b.isLive && b.clientId != binderId)
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
    final printings = printingsForCard(catalog, card);
    final dests = Binder.gridOrder(liveBinders)
        .where((b) => b.isLive && b.clientId != binderId)
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
                          card.id,
                          entry.isWanted,
                          c,
                          binderId: binderId,
                        ),
                      ),
                      if (dests.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        TextButton(
                          key: Key('moveBinder-${card.id}'),
                          onPressed: () => _move(context, ref),
                          child: const Text('Move'),
                        ),
                      ],
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
