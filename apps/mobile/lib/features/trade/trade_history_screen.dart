import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/analytics/analytics.dart';
import '../../core/models/trade.dart';
import '../../core/providers.dart';

class TradeHistoryScreen extends ConsumerStatefulWidget {
  const TradeHistoryScreen({super.key});

  @override
  ConsumerState<TradeHistoryScreen> createState() =>
      _TradeHistoryScreenState();
}

class _TradeHistoryScreenState extends ConsumerState<TradeHistoryScreen> {
  @override
  void initState() {
    super.initState();
    ref.read(analyticsProvider).capture('trade_history_viewed', {
      'trade_count': ref.read(tradeHistoryProvider).length,
    });
  }

  @override
  Widget build(BuildContext context) {
    final trades = ref.watch(tradeHistoryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Trade history')),
      body: trades.isEmpty
          ? const Center(child: Text('No saved trades yet.'))
          : ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: trades.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) => _TradeCard(trade: trades[i]),
            ),
    );
  }
}

class _TradeCard extends ConsumerWidget {
  const _TradeCard({required this.trade});
  final Trade trade;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final symbol = trade.currencySymbol;
    final delta = trade.delta;
    final balanced = delta.abs() < 0.01;
    final color = balanced
        ? context.tokens.gain
        : (delta > 0 ? context.tokens.loss : context.tokens.gain);
    final dateStr = DateFormat.yMMMd().add_jm().format(trade.createdAt);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.swap_horiz, size: 18, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(dateStr,
                    style: theme.textTheme.labelLarge
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const Spacer(),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.delete_outline, size: 20),
                  onPressed: () {
                    ref.read(analyticsProvider).capture('trade_deleted', {
                      'their_card_count': trade.wantCount,
                      'my_card_count': trade.haveCount,
                    });
                    ref
                        .read(tradeHistoryProvider.notifier)
                        .remove(trade.id);
                  },
                ),
              ],
            ),
            if (trade.notes.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(trade.notes,
                  style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant)),
            ],
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _sideSummary(theme, 'Gave',
                      '${trade.haveCount} cards', trade.haveTotal, symbol,
                      context.tokens.gain),
                ),
                Icon(Icons.arrow_forward,
                    color: theme.colorScheme.onSurfaceVariant),
                Expanded(
                  child: _sideSummary(theme, 'Got',
                      '${trade.wantCount} cards', trade.wantTotal, symbol,
                      context.tokens.accent, alignEnd: true),
                ),
              ],
            ),
            if (trade.haveItems.isNotEmpty || trade.haveCash > 0) ...[
              const SizedBox(height: 12),
              _sideLabel(theme, 'Gave', context.tokens.gain),
              const SizedBox(height: 4),
              for (final item in trade.haveItems)
                _HistoryItemRow(item: item, symbol: symbol),
              if (trade.haveCash > 0)
                _CashRow(amount: trade.haveCash, symbol: symbol),
            ],
            if (trade.wantItems.isNotEmpty || trade.wantCash > 0) ...[
              const SizedBox(height: 10),
              _sideLabel(theme, 'Got', context.tokens.accent),
              const SizedBox(height: 4),
              for (final item in trade.wantItems)
                _HistoryItemRow(item: item, symbol: symbol),
              if (trade.wantCash > 0)
                _CashRow(amount: trade.wantCash, symbol: symbol),
            ],
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.center,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  balanced
                      ? 'Even trade'
                      : (delta > 0
                          ? 'Gave $symbol${delta.abs().toStringAsFixed(2)} more'
                          : 'Gained $symbol${delta.abs().toStringAsFixed(2)}'),
                  style: TextStyle(color: color, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sideLabel(ThemeData theme, String label, Color accent) {
    return Text(
      label,
      style: theme.textTheme.labelMedium?.copyWith(
        color: accent,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  Widget _sideSummary(ThemeData theme, String label, String count, double total,
      String symbol, Color accent,
      {bool alignEnd = false}) {
    return Column(
      crossAxisAlignment:
          alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Text(label,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        Text('$symbol${total.toStringAsFixed(2)}',
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w800, color: accent)),
        Text(count, style: theme.textTheme.bodySmall),
      ],
    );
  }
}

class _HistoryItemRow extends StatelessWidget {
  const _HistoryItemRow({required this.item, required this.symbol});
  final TradeItem item;
  final String symbol;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          CardThumbnail(
            url: item.card.imageUrl,
            foil: item.card.isFoil,
            width: 28,
            height: 39,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        item.card.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    if (item.card.finishBadgeShort != null) ...[
                      const SizedBox(width: 6),
                      FinishBadge(card: item.card, compact: true),
                    ],
                  ],
                ),
                Text(
                  '×${item.quantity} · $symbol${item.priceEach.toStringAsFixed(2)} ea',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '$symbol${item.lineTotal.toStringAsFixed(2)}',
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _CashRow extends StatelessWidget {
  const _CashRow({required this.amount, required this.symbol});
  final double amount;
  final String symbol;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(Icons.payments_outlined,
              size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Cash',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
          Text(
            '$symbol${amount.toStringAsFixed(2)}',
            style: theme.textTheme.bodySmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
