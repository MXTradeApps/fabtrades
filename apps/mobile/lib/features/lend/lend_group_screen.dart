import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/logic/pricing.dart';
import '../../core/models/lend_group.dart';
import '../../core/providers.dart';
import '../card_detail/card_detail_screen.dart';
import '../paywall/pro_limits.dart';
import '../search/card_picker.dart';
import 'person_name_dialog.dart';

/// Detail view of a single lend/borrow batch. Watches the group by id so that
/// added cards persist and stay in sync even after navigating back and forth.
class LendGroupScreen extends ConsumerWidget {
  const LendGroupScreen({super.key, required this.groupId});
  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final group = ref.watch(lendGroupProvider(groupId));
    final pricing = ref.watch(pricingProvider);

    // The group was deleted (e.g. swiped away elsewhere) — leave the screen.
    if (group == null) {
      return const Scaffold(
        body: Center(child: Text('This batch no longer exists.')),
      );
    }

    final color = group.isBorrowing ? context.tokens.accent : context.tokens.gain;
    final title = group.personName?.isNotEmpty == true
        ? group.personName!
        : (group.isBorrowing ? 'Borrowing' : 'Lent out');
    final total = group.items
        .fold<double>(0, (s, i) => s + (pricing.value(i.card) ?? 0) * i.quantity);

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Edit name',
            onPressed: () => _editName(context, ref, group),
          ),
        ],
      ),
      body: Column(
        children: [
          _Header(
            group: group,
            total: pricing.formatValue(total),
            color: color,
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                for (int i = 0; i < group.items.length; i++) ...[
                  if (i > 0) const Divider(height: 1, indent: 72),
                  _ItemRow(
                    groupId: group.id,
                    item: group.items[i],
                    pricing: pricing,
                  ),
                ],
                if (group.items.isNotEmpty) const Divider(height: 1),
                AddListRow(
                  label: group.isBorrowing ? 'Add borrowed card' : 'Add lent card',
                  onTap: () => _addCard(context, ref, group),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _addCard(
      BuildContext context, WidgetRef ref, LendGroup group) async {
    await CardPickerScreen.showMulti(
      context,
      title: group.isBorrowing ? 'Add borrowed card' : 'Add lent card',
      onPick: (card) async {
        final ok = await addToLendOrUpsell(
          context,
          ref,
          groupId: group.id,
          card: card,
        );
        if (!ok) return false;
        if (!context.mounted) return true;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text('Added ${card.name}'),
              duration: const Duration(seconds: 2),
              behavior: SnackBarBehavior.floating,
            ),
          );
        return true;
      },
    );
  }

  Future<void> _editName(
      BuildContext context, WidgetRef ref, LendGroup group) async {
    final name = await askPersonName(context,
        isBorrowing: group.isBorrowing, initial: group.personName);
    if (name == null) return;
    ref.read(lendProvider.notifier).setPersonName(group.id, name);
  }
}

class _Header extends StatelessWidget {
  const _Header(
      {required this.group, required this.total, required this.color});
  final LendGroup group;
  final String total;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(group.isBorrowing ? Icons.call_received : Icons.call_made,
              color: color),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(group.isBorrowing ? 'Borrowed value' : 'Lent out value',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              Text(
                  '${group.cardCount} '
                  '${group.cardCount == 1 ? 'card' : 'cards'}',
                  style: theme.textTheme.bodyMedium),
            ],
          ),
          const Spacer(),
          Text(total,
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}

class _ItemRow extends ConsumerWidget {
  const _ItemRow(
      {required this.groupId, required this.item, required this.pricing});
  final String groupId;
  final LendItem item;
  final Pricing pricing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final notifier = ref.read(lendProvider.notifier);
    final card = item.card;
    final lineValue = (pricing.value(card) ?? 0) * item.quantity;

    return Dismissible(
      key: ValueKey('${groupId}_${card.id}'),
      direction: DismissDirection.endToStart,
      background: Container(
        color: context.tokens.loss,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) => notifier.removeCard(groupId, card.id),
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
            settings: const RouteSettings(name: 'Card Detail'),
            builder: (_) => CardDetailScreen(card: card, source: 'lend'))),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            children: [
              CardThumbnail(url: card.imageUrl, foil: card.isFoil),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(card.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 3),
                    CardMetaLine(card: card),
                    if (card.finishBadgeLabel != null) ...[
                      const SizedBox(height: 5),
                      FinishBadge(card: card),
                    ],
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
                    qty: item.quantity,
                    onInc: () => setLendQuantityOrUpsell(
                      context,
                      ref,
                      groupId: groupId,
                      cardId: card.id,
                      quantity: item.quantity + 1,
                    ),
                    onDec: () => notifier.setCardQuantity(
                        groupId, card.id, item.quantity - 1),
                  ),
                ],
              ),
            ],
          ),
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
