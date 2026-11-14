import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/analytics/analytics.dart';
import '../../core/config/revenuecat_config.dart';
import '../../core/logic/pro_packages.dart';
import '../../core/models/entitlement.dart';
import '../../core/models/purchase_outcome.dart';
import '../../core/providers.dart';
import '../paywall/pro_paywall.dart';
import 'settings_screen.dart' show SettingsSectionLabel;

/// Self-service plan changes and cancellation for an active store subscription.
///
/// Apps cannot cancel or switch App Store / Play subscriptions silently — both
/// stores own those actions. Changing plan purchases the other package (the
/// store applies its upgrade/downgrade rules); cancelling opens the store's
/// subscription management page via RevenueCat's [Entitlement.managementUrl].
class ManageSubscriptionScreen extends ConsumerWidget {
  const ManageSubscriptionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entitlement = ref.watch(entitlementProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Manage subscription')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _CurrentPlanCard(entitlement: entitlement),
          const SizedBox(height: 28),
          if (entitlement.canManageInStore) ...[
            const SettingsSectionLabel('Plan'),
            const SizedBox(height: 8),
            const _ChangePlanCard(),
            const SizedBox(height: 28),
            const SettingsSectionLabel('Cancel'),
            const SizedBox(height: 8),
            const _CancelCard(),
            const SizedBox(height: 28),
          ] else ...[
            const SettingsSectionLabel('Management'),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  entitlement.store == Store.promotional ||
                          entitlement.purchasedFrom == 'a complimentary grant'
                      ? 'This Pro access was granted by support, not through '
                          'the App Store or Google Play. It cannot be changed '
                          'or cancelled here — contact support if you need it '
                          'updated.'
                      : entitlement.purchasedFrom == null
                          ? 'This Pro access was not purchased through this store, '
                              'so it cannot be changed or cancelled here. Manage it '
                              'where it was granted.'
                          : 'This Pro access comes from ${entitlement.purchasedFrom}. '
                              'Manage or cancel it there.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
              ),
            ),
            const SizedBox(height: 28),
          ],
          const SettingsSectionLabel('Help'),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.support_agent_outlined),
              title: const Text('Get help'),
              subtitle: const Text('Restore purchases or contact support'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => presentProCustomerCenter(context, ref),
            ),
          ),
        ],
      ),
    );
  }
}

class _CurrentPlanCard extends StatelessWidget {
  const _CurrentPlanCard({required this.entitlement});

  final Entitlement entitlement;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('FABTrades Pro', style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              _planLabel(entitlement),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            if (entitlement.expiresAt != null) ...[
              const SizedBox(height: 4),
              Text(
                _renewalLabel(entitlement),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static String _planLabel(Entitlement entitlement) {
    final id = entitlement.productIdentifier;
    if (RevenueCatConfig.isYearlyProduct(id)) return 'Yearly plan';
    if (RevenueCatConfig.isMonthlyProduct(id)) return 'Monthly plan';
    if (entitlement.isLifetime) return 'Lifetime access';
    return 'Active';
  }

  static String _renewalLabel(Entitlement entitlement) {
    final date = DateFormat.yMMMd().format(entitlement.expiresAt!);
    if (!entitlement.knowsRenewalIntent) return 'Active until $date.';
    return entitlement.willRenew ? 'Renews $date.' : 'Access ends $date.';
  }
}

class _ChangePlanCard extends ConsumerStatefulWidget {
  const _ChangePlanCard();

  @override
  ConsumerState<_ChangePlanCard> createState() => _ChangePlanCardState();
}

class _ChangePlanCardState extends ConsumerState<_ChangePlanCard> {
  bool _busy = false;

  Future<void> _switchPlan(Package package, String label) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Switch to $label?'),
        content: Text(
          'Your store will apply its upgrade or downgrade rules. '
          'You stay on Pro either way.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text('Switch to $label'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    ref.read(analyticsProvider).capture('subscription_change_plan_started', {
      'target_product': package.storeProduct.identifier,
    });
    try {
      final outcome =
          await ref.read(subscriptionProvider.notifier).purchase(package);
      if (!mounted) return;
      switch (outcome) {
        case PurchaseSuccess():
          ref.invalidate(serverEntitlementProvider);
          ref.read(analyticsProvider).capture('subscription_change_plan_completed', {
            'target_product': package.storeProduct.identifier,
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("You're now on the $label plan.")),
          );
        case PurchaseCancelled():
          break;
        case PurchasePending():
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Payment is still processing. Your plan updates when the '
                'store confirms it.',
              ),
            ),
          );
        case PurchaseFailure(:final message):
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(message)),
          );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final entitlement = ref.watch(entitlementProvider);
    final offering = ref.watch(proOfferingProvider).asData?.value;
    final productId = entitlement.productIdentifier;
    final onYearly = RevenueCatConfig.isYearlyProduct(productId);
    final onMonthly = RevenueCatConfig.isMonthlyProduct(productId);

    final Package? target;
    final String? label;
    if (onYearly) {
      target = offering?.monthlyPackage;
      label = 'monthly';
    } else if (onMonthly) {
      target = offering?.yearlyPackage;
      label = 'yearly';
    } else {
      target = null;
      label = null;
    }

    final price = target?.storeProduct.priceString;
    final subtitle = target == null
        ? 'Plans are unavailable right now. Try again shortly.'
        : price == null
            ? 'Switch to the $label plan'
            : 'Switch to $label · $price';

    return Card(
      child: ListTile(
        leading: Icon(
          onYearly ? Icons.calendar_view_month : Icons.calendar_today,
        ),
        title: Text(
          onYearly
              ? 'Switch to monthly'
              : onMonthly
                  ? 'Switch to yearly'
                  : 'Change plan',
        ),
        subtitle: Text(subtitle),
        trailing: _busy
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.chevron_right),
        enabled: !_busy && target != null && label != null,
        onTap: !_busy && target != null && label != null
            ? () => _switchPlan(target!, label!)
            : null,
      ),
    );
  }
}

class _CancelCard extends ConsumerWidget {
  const _CancelCard();

  Future<void> _openStoreManagement(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final entitlement = ref.read(entitlementProvider);
    final url = entitlement.managementUrl ?? _fallbackManagementUrl();
    if (url == null) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              "Couldn't open subscription settings. Open your store "
              'account and manage subscriptions there.',
            ),
          ),
        );
      }
      return;
    }

    ref.read(analyticsProvider).capture('subscription_cancel_opened');
    final opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Couldn't open subscription settings.")),
      );
    }
  }

  static String? _fallbackManagementUrl() {
    return switch (defaultTargetPlatform) {
      // Prefer a concrete URL when RevenueCat has not populated managementURL
      // yet (common right after a sandbox purchase).
      TargetPlatform.iOS || TargetPlatform.macOS =>
        'https://apps.apple.com/account/subscriptions',
      TargetPlatform.android =>
        'https://play.google.com/store/account/subscriptions',
      _ => null,
    };
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final entitlement = ref.watch(entitlementProvider);
    final alreadyCancelled =
        entitlement.knowsRenewalIntent && !entitlement.willRenew;

    return Card(
      child: Column(
        children: [
          ListTile(
            leading: Icon(
              Icons.cancel_outlined,
              color: theme.colorScheme.error,
            ),
            title: Text(
              alreadyCancelled ? 'Manage in store' : 'Cancel subscription',
              style: TextStyle(color: theme.colorScheme.error),
            ),
            subtitle: Text(
              alreadyCancelled
                  ? 'Your subscription is set to end. Reopen it in the store '
                      'if you change your mind.'
                  : 'Opens your store account. You keep Pro until the end of '
                      'the current period.',
            ),
            trailing: const Icon(Icons.open_in_new),
            onTap: () => _openStoreManagement(context, ref),
          ),
        ],
      ),
    );
  }
}
