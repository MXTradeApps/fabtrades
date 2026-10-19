import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../app/ui.dart';
import '../../core/logic/pricing.dart';
import '../../core/models/app_settings.dart';
import '../../core/models/card_model.dart';
import '../../core/models/price_alert.dart';
import '../../core/providers.dart';
import 'price_alert_sheet.dart';

/// Prices for the marketplace an alert was set in, whatever the current price
/// source setting is.
Pricing pricingFor(PriceAlert alert) =>
    Pricing(AppSettings(source: alert.source));

/// "Rises to $25.00".
String alertConditionLabel(PriceAlert alert) =>
    '${alert.direction.label} ${pricingFor(alert).format(alert.targetPrice)}';

/// "Hit Oct 20 at $26.10" or "Watching".
String alertStatusLabel(PriceAlert alert) {
  if (!alert.isTriggered) return 'Watching';
  final when = DateFormat('MMM d').format(alert.triggeredAt!.toLocal());
  final price = alert.triggeredPrice;
  return price == null
      ? 'Hit $when'
      : 'Hit $when at ${pricingFor(alert).format(price)}';
}

/// The card detail page's "Price alerts" block: this printing's alerts and a
/// button to add one.
class CardPriceAlerts extends ConsumerWidget {
  const CardPriceAlerts({super.key, required this.card});

  final CardModel card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts = (ref.watch(priceAlertsProvider).value ?? const <PriceAlert>[])
        .where((a) => a.cardId == card.id)
        .toList();

    void add() => showPriceAlertSheet(
          context,
          ref,
          card: card,
          source: 'card_detail',
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(
          'Price alerts',
          icon: Icons.notifications_none_rounded,
          padding: const EdgeInsets.only(bottom: 8),
          trailing: alerts.isEmpty
              ? null
              : TextButton.icon(
                  onPressed: add,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add'),
                ),
        ),
        if (alerts.isEmpty)
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(44),
            ),
            onPressed: add,
            icon: const Icon(Icons.notifications_active_outlined),
            label: const Text('Notify me when the price moves'),
          )
        else
          for (final alert in alerts)
            _CompactAlertRow(alert: alert),
      ],
    );
  }
}

class _CompactAlertRow extends ConsumerWidget {
  const _CompactAlertRow({required this.alert});

  final PriceAlert alert;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final t = context.tokens;
    final notifier = ref.read(priceAlertsProvider.notifier);
    return Panel(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
      child: Row(
        children: [
          Icon(
            alert.direction == PriceAlertDirection.above
                ? Icons.trending_up_rounded
                : Icons.trending_down_rounded,
            size: 18,
            color: alert.direction == PriceAlertDirection.above
                ? t.gain
                : t.loss,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alertConditionLabel(alert),
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  alertStatusLabel(alert),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: alert.isTriggered ? t.accentText : t.textMuted,
                  ),
                ),
              ],
            ),
          ),
          if (alert.isTriggered)
            IconButton(
              tooltip: 'Watch again',
              icon: const Icon(Icons.replay_rounded, size: 20),
              onPressed: () => notifier.rearm(alert),
            ),
          IconButton(
            tooltip: 'Delete alert',
            icon: const Icon(Icons.close_rounded, size: 20),
            onPressed: () => notifier.delete(alert, source: 'card_detail'),
          ),
        ],
      ),
    );
  }
}
