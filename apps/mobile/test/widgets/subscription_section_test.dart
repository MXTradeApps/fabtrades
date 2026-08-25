import 'package:fabtrades/core/models/entitlement.dart';
import 'package:fabtrades/core/models/subscription_status.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/paywall/pro_gate.dart';
import 'package:fabtrades/features/settings/account_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/harness.dart';

/// Serves a fixed entitlement state, standing in for the RevenueCat SDK (whose
/// method channels don't exist under `flutter test`).
class _FakeSubscription extends SubscriptionNotifier {
  _FakeSubscription(this.status);

  final SubscriptionStatus status;

  @override
  Future<SubscriptionStatus> build() async => status;
}

/// A device whose store lookup fails outright — no network, or an SDK error.
class _UnreadableSubscription extends SubscriptionNotifier {
  @override
  Future<SubscriptionStatus> build() async =>
      throw StateError('the store is unreachable');
}

Future<ProviderContainer> _pumpAccount(
  WidgetTester tester, {
  SubscriptionStatus? status,
  ServerEntitlement? server,
  bool purchasesAvailable = true,
}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final cards = MockCardRepository();
  when(() => cards.fetchAll()).thenAnswer((_) async => []);

  final container = ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      cardRepositoryProvider.overrideWithValue(cards),
      purchasesAvailableProvider.overrideWithValue(purchasesAvailable),
      subscriptionProvider.overrideWith(
        status == null
            ? _UnreadableSubscription.new
            : () => _FakeSubscription(status),
      ),
      // Prices would otherwise come from the store.
      proOfferingProvider.overrideWith((ref) async => null),
      // Overridden rather than left to read Supabase, which has no client under
      // `flutter test`.
      serverEntitlementProvider.overrideWith((ref) async => server),
      // Account also renders a sign-in block; keep it signed out so this test
      // stays about subscriptions.
      accountProvider.overrideWith((ref) => Stream.value(null)),
    ],
  );
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: AccountScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

void main() {
  testWidgets('offers an upgrade when the customer has no entitlement',
      (tester) async {
    final container =
        await _pumpAccount(tester, status: SubscriptionStatus.free);

    expect(container.read(isProProvider), isFalse);
    expect(find.text('SUBSCRIPTION'), findsOneWidget);
    expect(find.text('See plans'), findsOneWidget);
    expect(find.text('Restore purchases'), findsOneWidget);
    expect(find.text('Manage subscription'), findsNothing);
  });

  testWidgets('See plans opens the store without requiring an account',
      (tester) async {
    await _pumpAccount(tester, status: SubscriptionStatus.free);

    await tester.tap(find.text('See plans'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    // Guideline 5.1.1(v): registration cannot sit in front of IAP. The native
    // paywall is missing under `flutter test`, so the sheet that used to block
    // purchase is the thing we can still assert is gone.
    expect(find.text('Sync your collection'), findsNothing);
    expect(find.text('Continue with Google'), findsNothing);
    expect(find.text('Continue with Apple'), findsNothing);
  });

  testWidgets('shows renewal date and Customer Center for a subscriber',
      (tester) async {
    final container = await _pumpAccount(
      tester,
      status: SubscriptionStatus(
        isPro: true,
        willRenew: true,
        expiresAt: DateTime(2027, 3, 14),
        productIdentifier: 'yearly',
        store: Store.appStore,
      ),
    );

    expect(container.read(isProProvider), isTrue);
    expect(find.text('Renews Mar 14, 2027.'), findsOneWidget);
    expect(find.text('Manage subscription'), findsOneWidget);
    expect(find.byType(ProBadge), findsOneWidget);
    expect(find.text('See plans'), findsNothing);
  });

  testWidgets('warns a subscriber whose payment failed', (tester) async {
    await _pumpAccount(
      tester,
      status: SubscriptionStatus(
        isPro: true,
        willRenew: true,
        hasBillingIssue: true,
        expiresAt: DateTime(2027, 3, 14),
      ),
    );

    expect(
      find.textContaining('problem with your last payment'),
      findsOneWidget,
    );
  });

  testWidgets('says access ends, not renews, after a cancellation',
      (tester) async {
    await _pumpAccount(
      tester,
      status: SubscriptionStatus(
        isPro: true,
        willRenew: false,
        expiresAt: DateTime(2027, 3, 14),
      ),
    );

    expect(find.text('Access ends Mar 14, 2027.'), findsOneWidget);
  });

  testWidgets('honours a subscription bought on the other platform',
      (tester) async {
    final container = await _pumpAccount(
      tester,
      status: SubscriptionStatus.free,
      server: ServerEntitlement(
        isActive: true,
        source: 'play_store',
        productId: 'yearly',
        expiresAt: DateTime(2027, 3, 14),
      ),
    );

    // The whole point of a server-owned entitlements row: buy on Android, get
    // Pro on iOS.
    expect(container.read(isProProvider), isTrue);
    expect(find.text('Active until Mar 14, 2027.'), findsOneWidget);
    expect(find.textContaining('Purchased through Google Play'), findsOneWidget);
    // StoreKit cannot manage a Play subscription, so offering the link would
    // dead-end.
    expect(find.text('Manage subscription'), findsNothing);
    expect(find.text('See plans'), findsNothing);
  });

  testWidgets('keeps Pro when the store is unreachable but the server says yes',
      (tester) async {
    final container = await _pumpAccount(
      tester,
      server: ServerEntitlement(
        isActive: true,
        source: 'app_store',
        expiresAt: DateTime(2027, 3, 14),
      ),
    );

    // Losing Pro because a store lookup timed out would be the worst possible
    // failure mode for someone who has paid.
    expect(container.read(isProProvider), isTrue);
    expect(find.text('See plans'), findsNothing);
  });

  testWidgets('hides subscription UI entirely when RevenueCat is unconfigured',
      (tester) async {
    await _pumpAccount(
      tester,
      status: SubscriptionStatus.free,
      purchasesAvailable: false,
    );

    expect(find.text('SUBSCRIPTION'), findsNothing);
    expect(find.text('See plans'), findsNothing);
    // The rest of My Account is unaffected.
    expect(find.text('ACCOUNT'), findsOneWidget);
  });

  testWidgets('opens Manage subscription into the plan-change screen',
      (tester) async {
    await _pumpAccount(
      tester,
      status: SubscriptionStatus(
        isPro: true,
        willRenew: true,
        expiresAt: DateTime(2027, 3, 14),
        productIdentifier: 'yearly',
        store: Store.appStore,
      ),
    );

    await tester.tap(find.text('Manage subscription'));
    await tester.pumpAndSettle();

    expect(find.text('Switch to monthly'), findsOneWidget);
    expect(find.text('Cancel subscription'), findsOneWidget);
    expect(find.text('Get help'), findsOneWidget);
  });
}
