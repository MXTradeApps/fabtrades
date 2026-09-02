import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/models/entitlement.dart';
import '../../core/providers.dart';
import '../paywall/pro_gate.dart';
import 'manage_subscription_screen.dart';
import 'settings_screen.dart' show SettingsSectionLabel;

/// Subscription block on My Account: manage/cancel for people who already
/// purchased. New purchases are no longer offered.
class SubscriptionSection extends ConsumerWidget {
  const SubscriptionSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(purchasesAvailableProvider)) return const SizedBox.shrink();

    final entitlement = ref.watch(entitlementProvider);
    if (!entitlement.isPro) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SettingsSectionLabel('Subscription'),
        const SizedBox(height: 8),
        _ProStatusCard(entitlement: entitlement),
        const SizedBox(height: 28),
      ],
    );
  }
}

/// Active subscriber: what they're on, when it renews, and one button into
/// subscription management for everything else.
class _ProStatusCard extends StatelessWidget {
  const _ProStatusCard({required this.entitlement});

  final Entitlement entitlement;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.workspace_premium,
                        color: theme.colorScheme.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text('FABTrades Pro',
                          style: theme.textTheme.titleMedium),
                    ),
                    const ProBadge(),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  _renewalLabel(entitlement),
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
                if (entitlement.hasBillingIssue) ...[
                  const SizedBox(height: 10),
                  _Notice(
                    icon: Icons.error_outline,
                    color: theme.colorScheme.error,
                    text: 'There was a problem with your last payment. Update '
                        'your payment method to keep Pro.',
                  ),
                ],
                if (entitlement.isSandbox) ...[
                  const SizedBox(height: 10),
                  _Notice(
                    icon: Icons.science_outlined,
                    color: theme.colorScheme.onSurfaceVariant,
                    text: 'Test purchase — this subscription is not real.',
                  ),
                ],
                if (!entitlement.knowsRenewalIntent) ...[
                  const SizedBox(height: 10),
                  _Notice(
                    icon: Icons.devices_outlined,
                    color: theme.colorScheme.onSurfaceVariant,
                    text: entitlement.purchasedFrom == null
                        ? 'Purchased on another platform. Manage it there.'
                        : 'Purchased through ${entitlement.purchasedFrom}. '
                            'Manage it there.',
                  ),
                ],
              ],
            ),
          ),
          if (entitlement.knowsRenewalIntent) ...[
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.manage_accounts_outlined),
              title: const Text('Manage subscription'),
              subtitle: const Text('Change plan, cancel, or get help'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const ManageSubscriptionScreen(),
                  settings: const RouteSettings(name: 'ManageSubscription'),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _renewalLabel(Entitlement entitlement) {
    if (entitlement.isLifetime) return 'Lifetime access.';
    final date = DateFormat.yMMMd().format(entitlement.expiresAt!);
    if (entitlement.isInTrial) {
      return entitlement.willRenew
          ? 'Free trial — first payment on $date.'
          : 'Free trial — ends $date.';
    }
    if (!entitlement.knowsRenewalIntent) return 'Active until $date.';
    return entitlement.willRenew ? 'Renews $date.' : 'Access ends $date.';
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: color),
          ),
        ),
      ],
    );
  }
}
