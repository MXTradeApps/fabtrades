import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../app/ui.dart';
import '../../app/widgets.dart';
import '../../core/analytics/analytics.dart';
import '../../core/models/card_model.dart';
import '../../core/models/price_alert.dart';
import '../../core/providers.dart';
import '../auth/sign_in_sheet.dart';
import '../card_detail/card_detail_screen.dart';
import 'price_alert_widgets.dart';

/// Every price alert the user has set, opened from More. Alerts that have
/// fired come first, so the reason someone opened this is at the top.
class PriceAlertsScreen extends ConsumerStatefulWidget {
  const PriceAlertsScreen({super.key, this.source = 'more'});

  /// `more` or `push`, for the `price_alerts_viewed` event.
  final String source;

  @override
  ConsumerState<PriceAlertsScreen> createState() => _PriceAlertsScreenState();
}

class _PriceAlertsScreenState extends ConsumerState<PriceAlertsScreen> {
  @override
  void initState() {
    super.initState();
    final alerts = ref.read(priceAlertsProvider).value ?? const <PriceAlert>[];
    ref.read(analyticsProvider).capture('price_alerts_viewed', {
      'source': widget.source,
      'alert_count': alerts.length,
      'hit_count': alerts.where((a) => a.isTriggered).length,
    });
    // Fired alerts change overnight on the server; pick that up on open.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(priceAlertsProvider.notifier).refresh();
    });
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(isSignedInProvider);
    final alerts = ref.watch(priceAlertsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Price alerts')),
      body: !signedIn
          ? Center(
              child: EmptyState(
                icon: Icons.notifications_none_rounded,
                title: 'Sign in for price alerts',
                message: 'Get a notification when a card rises or drops to '
                    'the price you pick.',
                actions: [
                  FilledButton(
                    onPressed: () => presentSignIn(
                      context,
                      source: 'price_alerts',
                      copy: SignInCopy.priceAlerts,
                    ),
                    child: const Text('Sign in'),
                  ),
                ],
              ),
            )
          : alerts.when(
              loading: () => const Center(
                child: CircularProgressIndicator.adaptive(),
              ),
              error: (_, _) => Center(
                child: EmptyState(
                  icon: Icons.cloud_off_rounded,
                  title: 'Could not load your alerts',
                  message: 'Check your connection and try again.',
                  actions: [
                    OutlinedButton(
                      onPressed: () => ref.invalidate(priceAlertsProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (list) => list.isEmpty
                  ? const Center(
                      child: EmptyState(
                        icon: Icons.notifications_none_rounded,
                        title: 'No price alerts yet',
                        message: 'Open any card and tap "Notify me when the '
                            'price moves" to pick a price to watch for.',
                      ),
                    )
                  : _AlertList(alerts: list),
            ),
    );
  }
}

class _AlertList extends ConsumerWidget {
  const _AlertList({required this.alerts});

  final List<PriceAlert> alerts;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hit = alerts.where((a) => a.isTriggered).toList();
    final watching = alerts.where((a) => !a.isTriggered).toList();
    return RefreshIndicator(
      onRefresh: () => ref.read(priceAlertsProvider.notifier).refresh(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
        children: [
          if (hit.isNotEmpty) ...[
            SectionTitle(
              'Hit',
              count: hit.length,
              padding: const EdgeInsets.fromLTRB(4, 12, 4, 8),
            ),
            for (final a in hit) _AlertTile(alert: a),
          ],
          if (watching.isNotEmpty) ...[
            SectionTitle(
              'Watching',
              count: watching.length,
              padding: const EdgeInsets.fromLTRB(4, 12, 4, 8),
            ),
            for (final a in watching) _AlertTile(alert: a),
          ],
        ],
      ),
    );
  }
}

class _AlertTile extends ConsumerWidget {
  const _AlertTile({required this.alert});

  final PriceAlert alert;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final t = context.tokens;
    final CardModel? card = ref.watch(
      catalogByIdProvider.select((byId) => byId[alert.cardId]),
    );
    final notifier = ref.read(priceAlertsProvider.notifier);
    final pricing = pricingFor(alert);
    final current = card == null ? null : pricing.value(card);

    Future<void> delete() async {
      try {
        await notifier.delete(alert);
      } catch (_) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete the alert.')),
        );
      }
    }

    return Dismissible(
      key: ValueKey(alert.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: t.loss.withValues(alpha: 0.15),
          borderRadius: AppRadii.lgAll,
        ),
        child: Icon(Icons.delete_outline, color: t.loss),
      ),
      onDismissed: (_) => delete(),
      child: Panel(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.fromLTRB(10, 10, 4, 10),
        onTap: card == null
            ? null
            : () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        CardDetailScreen(card: card, source: 'price_alerts'),
                    settings: const RouteSettings(name: 'Card Detail'),
                  ),
                ),
        child: Row(
          children: [
            CardThumbnail(
              url: card?.imageUrl,
              width: 40,
              height: 56,
              foil: card?.isFoil ?? false,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    card?.name ?? alert.cardId,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall,
                  ),
                  if (card != null) CardMetaLine(card: card),
                  const SizedBox(height: 4),
                  Text(
                    alertConditionLabel(alert),
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    alert.isTriggered
                        ? alertStatusLabel(alert)
                        : 'Now ${pricing.format(current)} · Watching',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: alert.isTriggered ? t.accentText : t.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              tooltip: 'Alert options',
              onSelected: (v) {
                if (v == 'rearm') notifier.rearm(alert);
                if (v == 'delete') delete();
              },
              itemBuilder: (_) => [
                if (alert.isTriggered)
                  const PopupMenuItem(
                    value: 'rearm',
                    child: Text('Watch again'),
                  ),
                const PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
