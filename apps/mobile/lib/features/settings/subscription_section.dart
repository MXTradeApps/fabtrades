import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/legal_urls.dart';
import '../../core/logic/free_limits.dart';
import '../../core/logic/pro_packages.dart';
import '../../core/models/entitlement.dart';
import '../../core/providers.dart';
import '../paywall/pro_gate.dart';
import '../paywall/pro_paywall.dart';
import 'manage_subscription_screen.dart';
import 'settings_screen.dart' show SettingsSectionLabel;

/// Subscription block on My Account: current status, and the entry points to
/// the paywall, plan management, and restore.
///
/// Hides itself entirely on builds without a RevenueCat API key, so nothing
/// offers a purchase that can't complete.
class SubscriptionSection extends ConsumerWidget {
  const SubscriptionSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(purchasesAvailableProvider)) return const SizedBox.shrink();

    final entitlement = ref.watch(entitlementProvider);
    final device = ref.watch(subscriptionProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SettingsSectionLabel('Subscription'),
        const SizedBox(height: 8),
        // Access first, device state second. Somebody whose subscription the
        // server has confirmed should see it even if this device's store lookup
        // is still loading or failed outright — which is the whole reason the two
        // sources are merged.
        if (entitlement.isPro)
          _ProStatusCard(entitlement: entitlement)
        else
          switch (device) {
            AsyncLoading() => const _StatusPlaceholder(),
            AsyncError() => const _StatusUnavailable(),
            _ => const _UpgradeCard(),
          },
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
                // Only when the purchase was made elsewhere. Managing it has to
                // happen where it was bought, and saying so up front is kinder
                // than a Customer Center that cannot help.
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
          // Plan changes and cancellation need this store's purchase. Offering
          // management for a purchase made on the other platform would dead-end.
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
    // Renewal intent is unknown for a subscription bought on the other platform,
    // and "access ends" would be a bad guess to get wrong.
    if (!entitlement.knowsRenewalIntent) return 'Active until $date.';
    return entitlement.willRenew ? 'Renews $date.' : 'Access ends $date.';
  }
}

/// Non-subscriber: the pitch, live prices from the offering, and restore.
class _UpgradeCard extends ConsumerStatefulWidget {
  const _UpgradeCard();

  @override
  ConsumerState<_UpgradeCard> createState() => _UpgradeCardState();
}

class _UpgradeCardState extends ConsumerState<_UpgradeCard> {
  bool _restoring = false;

  Future<void> _restore() async {
    setState(() => _restoring = true);
    try {
      await restoreProPurchases(context, ref);
    } finally {
      if (mounted) setState(() => _restoring = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final priceLabel = ref.watch(proOfferingProvider).maybeWhen(
          data: _priceLabel,
          orElse: () => null,
        );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
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
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Support development and unlock the Pro features. '
              'Monthly or yearly, cancel any time.',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            if (priceLabel != null) ...[
              const SizedBox(height: 10),
              Text(priceLabel, style: theme.textTheme.labelLarge),
            ],
            // Only shown once a cap is actually in sight — a usage readout at
            // one of five cards is noise, and reads as nagging. Hidden while
            // [unlockAllFeatures] is on because nothing is capped.
            ?_usageLine(context, ref.watch(freeUsageProvider)),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                // onlyIfNeeded: false — this is an explicit "see plans" tap, so
                // show the paywall even while features are ungated, and even
                // if the entitlement is mid-sync.
                onPressed: () => presentProPaywall(
                  context,
                  ref,
                  onlyIfNeeded: false,
                  trigger: 'settings',
                ),
                child: const Text('See plans'),
              ),
            ),
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: _restoring ? null : _restore,
                child: Text(
                  _restoring ? 'Restoring…' : 'Restore purchases',
                ),
              ),
            ),
            // App Review 3.1.2: functional Privacy + Terms links near the
            // subscription offer (RevenueCat paywall should also link these).
            Wrap(
              spacing: 12,
              children: [
                TextButton(
                  onPressed: () => _openLegal(context, LegalUrls.privacyPolicy),
                  child: const Text('Privacy Policy'),
                ),
                TextButton(
                  onPressed: () => _openLegal(context, LegalUrls.termsOfUse),
                  child: const Text('Terms of Use'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static Future<void> _openLegal(BuildContext context, String url) async {
    final opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Couldn't open that link.")),
      );
    }
  }

  static Widget? _usageLine(BuildContext context, FreeUsage? usage) {
    if (usage == null || !usage.isNearAnyLimit) return null;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Text(
        'Free plan · binder ${usage.binderCards}/${FreeLimits.binderCards} · '
        'want list ${usage.wantListCards}/${FreeLimits.wantListCards} · '
        'loaned ${usage.loanedCards}/${FreeLimits.loanedCards} · '
        'trades ${usage.savedTrades}/${FreeLimits.savedTrades}',
        style: theme.textTheme.bodySmall
            ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
      ),
    );
  }

  /// Prices straight from the store, so currency and formatting are always
  /// right for the customer's region.
  static String? _priceLabel(Offering? offering) {
    if (offering == null) return null;
    final monthly = offering.monthlyPackage?.storeProduct.priceString;
    final yearly = offering.yearlyPackage?.storeProduct.priceString;
    final parts = [
      if (monthly != null) '$monthly / month',
      if (yearly != null) '$yearly / year',
    ];
    if (parts.isEmpty) return null;

    final saving = yearlySavingPercent(offering);
    final label = parts.join('  ·  ');
    return saving == null ? label : '$label  ·  save $saving% yearly';
  }
}

class _StatusPlaceholder extends StatelessWidget {
  const _StatusPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: ListTile(
        leading: SizedBox(
          width: 24,
          height: 24,
          child: Center(
            child: SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
        title: Text('FABTrades Pro'),
        subtitle: Text('Checking your subscription…'),
      ),
    );
  }
}

/// Entitlements couldn't be read — offer a retry rather than silently claiming
/// the customer is on the free tier.
class _StatusUnavailable extends ConsumerWidget {
  const _StatusUnavailable();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.cloud_off_outlined),
        title: const Text('FABTrades Pro'),
        subtitle: const Text("Couldn't check your subscription."),
        trailing: TextButton(
          onPressed: () => ref.invalidate(subscriptionProvider),
          child: const Text('Retry'),
        ),
      ),
    );
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
