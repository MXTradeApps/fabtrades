import 'package:fabtrades/core/data/auth_repository.dart';
import 'package:fabtrades/core/models/account.dart';
import 'package:fabtrades/core/models/subscription_status.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/settings/account_screen.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/harness.dart';
import '../support/sync_stub.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

class _FakeSubscription extends SubscriptionNotifier {
  _FakeSubscription(this.status);

  final SubscriptionStatus status;

  @override
  Future<SubscriptionStatus> build() async => status;
}

const _account = Account(
  id: '9f1c0b62-0000-4000-8000-000000000001',
  email: 'bravo@example.com',
  displayName: 'Rhinar Hothead',
  provider: AuthProviderKind.discord,
);

Future<_MockAuthRepository> _pumpMyAccount(
  WidgetTester tester, {
  Account? account = _account,
}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final cards = MockCardRepository();
  when(() => cards.fetchAll()).thenAnswer((_) async => []);

  final auth = _MockAuthRepository();
  when(auth.signOut).thenAnswer((_) async {});
  when(auth.deleteAccount).thenAnswer(
    (_) async => const DeleteAccountSucceeded(),
  );

  final container = ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      cardRepositoryProvider.overrideWithValue(cards),
      authRepositoryProvider.overrideWithValue(auth),
      accountProvider.overrideWith((ref) => Stream.value(account)),
      syncProvider.overrideWith(StubSyncNotifier.new),
      purchasesAvailableProvider.overrideWithValue(false),
      subscriptionProvider.overrideWith(
        () => _FakeSubscription(SubscriptionStatus.free),
      ),
      proOfferingProvider.overrideWith((ref) async => null),
      serverEntitlementProvider.overrideWith((ref) async => null),
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
  return auth;
}

void main() {
  testWidgets('shows Delete account at the bottom when signed in',
      (tester) async {
    await _pumpMyAccount(tester);

    expect(find.text('DANGER ZONE'), findsOneWidget);
    expect(find.text('Delete account'), findsOneWidget);
  });

  testWidgets('hides Delete account when signed out', (tester) async {
    await _pumpMyAccount(tester, account: null);

    expect(find.text('DANGER ZONE'), findsNothing);
    expect(find.text('Delete account'), findsNothing);
  });

  testWidgets('requires typing DELETE before confirming deletion',
      (tester) async {
    final auth = await _pumpMyAccount(tester);

    await tester.tap(find.text('Delete account'));
    await tester.pumpAndSettle();

    expect(find.text('Delete account?'), findsOneWidget);
    final confirm = find.widgetWithText(FilledButton, 'Delete account');
    expect(tester.widget<FilledButton>(confirm).onPressed, isNull);

    await tester.enterText(find.byType(TextField), 'delete');
    await tester.pump();
    expect(tester.widget<FilledButton>(confirm).onPressed, isNull);

    await tester.enterText(find.byType(TextField), 'DELETE');
    await tester.pump();
    expect(tester.widget<FilledButton>(confirm).onPressed, isNotNull);

    await tester.tap(confirm);
    await tester.pump();
    // Progress dialog, then completion.
    await tester.pumpAndSettle();

    verify(auth.deleteAccount).called(1);
    expect(
      find.textContaining('Your account has been deleted'),
      findsOneWidget,
    );
  });

  testWidgets('backing out of the confirmation does not delete',
      (tester) async {
    final auth = await _pumpMyAccount(tester);

    await tester.tap(find.text('Delete account'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();

    verifyNever(auth.deleteAccount);
  });
}
