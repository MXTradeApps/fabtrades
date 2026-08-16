import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:purchases_ui_flutter/purchases_ui_flutter.dart';

import '../../core/analytics/analytics.dart';
import '../../core/config/revenuecat_config.dart';
import '../../core/models/purchase_outcome.dart';
import '../../core/providers.dart';
import '../auth/sign_in_sheet.dart';

/// Presentation helpers for RevenueCat's remotely-configured UI.
///
/// The paywall and Customer Center are both native views driven entirely by the
/// RevenueCat dashboard, so pricing, copy, layout, A/B tests and retention
/// offers all change without an app release. Everything here funnels through
/// these two functions so behaviour stays consistent wherever Pro is offered.

/// Shows the paywall for the current offering and returns true if the customer
/// has Pro when it closes.
///
/// [onlyIfNeeded] uses `presentPaywallIfNeeded`, which skips presentation
/// entirely for customers who already have the entitlement — the right default
/// for an "unlock this feature" tap. Pass false for an explicit "see plans"
/// action, where showing the paywall regardless is expected.
///
/// [offering] overrides which offering is shown; leave it null to use the one
/// marked **Current** in the dashboard so offerings can be swapped remotely.
///
/// [trigger] identifies what surfaced the paywall (e.g. `settings`,
/// `price_history`, `binder_limit`), for analytics.
Future<bool> presentProPaywall(
  BuildContext context,
  WidgetRef ref, {
  Offering? offering,
  bool onlyIfNeeded = true,
  String trigger = 'settings',
}) async {
  if (!ref.read(purchasesAvailableProvider)) {
    _showMessage(context, 'Subscriptions are unavailable in this build.');
    return ref.read(isProProvider);
  }

  if (!await _ensureSignedIn(context, ref)) return ref.read(isProProvider);

  ref.read(analyticsProvider).capture('paywall_shown', {'trigger': trigger});

  final PaywallResult result;
  try {
    result = onlyIfNeeded
        ? await RevenueCatUI.presentPaywallIfNeeded(
            RevenueCatConfig.proEntitlement,
            offering: offering,
          )
        : await RevenueCatUI.presentPaywall(offering: offering);
  } catch (e) {
    debugPrint('RevenueCat: failed to present paywall — $e');
    ref.read(analyticsProvider).capture('purchase_failed', {
      'trigger': trigger,
      'error_type': e.runtimeType.toString(),
    });
    if (context.mounted) {
      _showMessage(context, "Couldn't open FABTrades Pro. Please try again.");
    }
    return ref.read(isProProvider);
  }

  // The paywall purchases through the native SDK, so pull the entitlement back
  // into Riverpod. The customer info listener usually beats us to it; this
  // makes the state correct before we return either way.
  await ref.read(subscriptionProvider.notifier).refresh();
  if (result == PaywallResult.purchased || result == PaywallResult.restored) {
    // Ask the server for its row too. It is written by a webhook, so it may not
    // exist yet — access is already granted by the device's answer, and this
    // only fills in what the server knows. If it loses the race, the next launch
    // reads it.
    ref.invalidate(serverEntitlementProvider);
  }
  final isPro = ref.read(isProProvider);

  switch (result) {
    case PaywallResult.purchased:
      final productId = ref.read(entitlementProvider).productIdentifier;
      ref.read(analyticsProvider).capture('purchase_completed', {
        'trigger': trigger,
        'product_id': ?productId,
      });
    case PaywallResult.restored:
      ref
          .read(analyticsProvider)
          .capture('purchase_restored', {'trigger': trigger});
    case PaywallResult.error:
      ref.read(analyticsProvider).capture('purchase_failed', {
        'trigger': trigger,
        'error_type': 'paywall_error',
      });
    case PaywallResult.cancelled:
    case PaywallResult.notPresented:
      ref
          .read(analyticsProvider)
          .capture('paywall_dismissed', {'trigger': trigger});
  }

  if (!context.mounted) return isPro;
  switch (result) {
    case PaywallResult.purchased:
      _showMessage(context, "You're on FABTrades Pro — thanks for the support!");
    case PaywallResult.restored:
      _showMessage(context, 'Purchases restored.');
    case PaywallResult.error:
      _showMessage(context, "Couldn't complete that purchase. Please try again.");
    case PaywallResult.cancelled:
    case PaywallResult.notPresented:
      // Nothing to say: the customer either backed out, or already had Pro.
      break;
  }
  return isPro;
}

/// Opens the RevenueCat [Customer Center][cc] — the self-service screen for
/// cancelling, changing plans, requesting refunds (iOS) and recovering missing
/// purchases.
///
/// Worth routing support requests through: its cancellation and refund paths
/// can present retention offers configured in the dashboard, so churn attempts
/// get one chance to convert before reaching the store.
///
/// [cc]: https://www.revenuecat.com/docs/tools/customer-center
Future<void> presentProCustomerCenter(
  BuildContext context,
  WidgetRef ref,
) async {
  if (!ref.read(purchasesAvailableProvider)) {
    _showMessage(context, 'Subscriptions are unavailable in this build.');
    return;
  }

  ref.read(analyticsProvider).capture('customer_center_opened');

  final subscription = ref.read(subscriptionProvider.notifier);
  try {
    await RevenueCatUI.presentCustomerCenter(
      // Restores and promotional-offer redemptions both change entitlements
      // while the native view is still on screen.
      onRestoreCompleted: (_) => subscription.refresh(),
      onPromotionalOfferSucceeded: (_, _, _) => subscription.refresh(),
      onManagementOptionSelected: (option, _) {
        debugPrint('Customer Center: selected "$option"');
      },
    );
  } catch (e) {
    debugPrint('RevenueCat: failed to present customer center — $e');
    if (context.mounted) {
      _showMessage(context, "Couldn't open subscription settings.");
    }
    return;
  }

  // Cancellations and plan changes are only reflected once the sheet closes.
  await subscription.refresh();
}

/// Restores purchases and reports the outcome.
///
/// Required by App Review for anything non-consumable, and the fix for the most
/// common support ticket a no-account app gets: "I paid on my old phone."
Future<bool> restoreProPurchases(BuildContext context, WidgetRef ref) async {
  if (!ref.read(purchasesAvailableProvider)) {
    _showMessage(context, 'Subscriptions are unavailable in this build.');
    return false;
  }

  final outcome = await ref.read(subscriptionProvider.notifier).restore();
  final isPro = ref.read(isProProvider);
  if (!context.mounted) return isPro;

  switch (outcome) {
    case RestoreSuccess():
      ref.read(analyticsProvider).capture('purchase_restored', {
        'trigger': 'restore',
      });
      _showMessage(
        context,
        isPro
            ? 'FABTrades Pro restored.'
            : 'No previous purchases found on this store account.',
      );
    case RestoreFailure(:final message, :final code):
      ref.read(analyticsProvider).capture('purchase_failed', {
        'trigger': 'restore',
        'error_type': code.toString(),
      });
      _showMessage(context, message);
  }
  return isPro;
}

/// Makes sure there is an account before money changes hands.
///
/// Not a policy choice — it is what makes the entitlement addressable. A purchase
/// made while signed out is attributed to an anonymous RevenueCat id, so the
/// webhook has no Supabase user to write a row for, and the customer ends up
/// having paid for access the server cannot grant them. Reattaching it later is
/// manual support work.
///
/// The prompt is the same dismissable sheet as everywhere else. Backing out just
/// means no purchase.
Future<bool> _ensureSignedIn(BuildContext context, WidgetRef ref) async {
  if (!ref.read(isSignedInProvider)) {
    if (!await presentSignIn(context, source: 'paywall')) return false;

    // A redirect-based provider finishes in a browser, so `presentSignIn` can
    // return true before the session lands.
    if (!await _waitForAccount(ref)) return false;
  }

  if (await _bindPurchasesIdentity(ref)) return true;

  if (context.mounted) {
    _showMessage(context, "Couldn't reach the store. Please try again.");
  }
  return false;
}

/// Binds RevenueCat to the signed-in user, and waits for it.
///
/// `purchasesIdentityProvider` does this too, but as a side effect of a rebuild,
/// which is not ordered against opening a paywall. `Purchases.logIn` is idempotent,
/// so doing it again here costs nothing and removes the race: whichever one gets
/// there first, the purchase is attributed to the Supabase user rather than to the
/// anonymous id the SDK starts with.
///
/// A failure blocks the purchase. Letting it through would take the customer's money
/// against an identity the webhook cannot resolve, which is the one outcome here that
/// needs a human to unpick.
Future<bool> _bindPurchasesIdentity(WidgetRef ref) async {
  final account = ref.read(accountProvider).value;
  if (account == null) return false;

  final info = await ref.read(purchasesRepositoryProvider).logIn(account.id);
  // The SDK is known to be configured by this point — the caller checked — so the
  // only reason for no customer info is that the call failed.
  if (info == null) return false;

  // Signing in can grant Pro outright, if this account already had it.
  ref.read(subscriptionProvider.notifier).adopt(info);
  return true;
}

/// Waits for [accountProvider] to produce an account, giving up after a few
/// seconds so a failed browser handoff cannot hang the purchase flow.
Future<bool> _waitForAccount(WidgetRef ref) async {
  if (ref.read(isSignedInProvider)) return true;

  final completer = Completer<bool>();
  final subscription = ref.listenManual(accountProvider, (_, next) {
    if (next.value != null && !completer.isCompleted) completer.complete(true);
  });

  try {
    return await completer.future.timeout(
      const Duration(seconds: 20),
      onTimeout: () => false,
    );
  } finally {
    subscription.close();
  }
}

void _showMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 3)),
    );
}
