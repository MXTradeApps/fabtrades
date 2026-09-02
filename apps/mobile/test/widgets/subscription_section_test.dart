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

class _FakeSubscription extends SubscriptionNotifier {
  _FakeSubscription(this.status);

  final SubscriptionStatus status;

  @override
  Future<SubscriptionStatus> build() async => status;
}

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
      proOfferingProvider.overrideWith((ref) async => null),
      serverEntitlementProvider.overrideWith((ref) async => server),
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
  testWidgets('does not offer a purchase when there is no entitlement',
      (tester) async {
    await _pumpAccount(tester, status: SubscriptionStatus.free);

    expect(find.text('See plans'), findsNothing);
    expect(find.text('Restore purchases'), findsNothing);
    expect(find.text('SUBSCRIPTION'), findsNothing);
    expect(find.text('Manage subscription'), findsNothing);
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
    await _pumpAccount(
      tester,
      status: SubscriptionStatus.free,
      server: ServerEntitlement(
        isActive: true,
        source: 'play_store',
        productId: 'yearly',
        expiresAt: DateTime(2027, 3, 14),
      ),
    );

    expect(find.text('Active until Mar 14, 2027.'), findsOneWidget);
    expect(find.textContaining('Purchased through Google Play'), findsOneWidget);
    expect(find.text('Manage subscription'), findsNothing);
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
