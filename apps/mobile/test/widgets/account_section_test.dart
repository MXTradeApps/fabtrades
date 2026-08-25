import 'dart:async';

import 'package:fabtrades/core/data/auth_repository.dart';
import 'package:fabtrades/core/models/account.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/auth/sign_in_sheet.dart';
import 'package:fabtrades/features/settings/account_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import '../support/sync_stub.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

const _account = Account(
  id: '9f1c0b62-0000-4000-8000-000000000001',
  email: 'bravo@example.com',
  displayName: 'Rhinar Hothead',
  provider: AuthProviderKind.discord,
);

/// Pumps just the account block with a scripted auth state, so nothing here
/// depends on `Supabase.initialize` having run.
Future<_MockAuthRepository> _pumpAccount(
  WidgetTester tester, {
  required Stream<Account?> accounts,
  List<AuthProviderKind> providers = const [
    AuthProviderKind.google,
    AuthProviderKind.discord,
  ],
  // The loading placeholder spins forever, so pumpAndSettle would never return.
  bool settle = true,
  StubSyncNotifier? sync,
}) async {
  final auth = _MockAuthRepository();
  when(() => auth.availableProviders()).thenAnswer((_) async => providers);
  when(auth.signOut).thenAnswer((_) async {});

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        accountProvider.overrideWith((ref) => accounts),
        syncProvider.overrideWith(() => sync ?? StubSyncNotifier()),
      ],
      child: const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: AccountSection()),
        ),
      ),
    ),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
  return auth;
}

void main() {
  setUpAll(() {
    registerFallbackValue(AuthProviderKind.google);
  });

  testWidgets('invites a guest to sign in without demanding it',
      (tester) async {
    await _pumpAccount(tester, accounts: Stream.value(null));

    expect(find.text('Sync across devices'), findsOneWidget);
    expect(
      find.textContaining('works fine without an account'),
      findsOneWidget,
    );
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Sign out'), findsNothing);
  });

  testWidgets('opens the provider sheet from the sign-in button',
      (tester) async {
    await _pumpAccount(tester, accounts: Stream.value(null));

    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Continue with Google'), findsOneWidget);
    expect(find.text('Continue with Discord'), findsOneWidget);
    // Not an Apple platform under test, so no Apple button is offered.
    expect(find.text('Continue with Apple'), findsNothing);
  });

  testWidgets('post-purchase sheet can be dismissed without signing in',
      (tester) async {
    final auth = _MockAuthRepository();
    when(() => auth.availableProviders()).thenAnswer(
      (_) async => const [AuthProviderKind.google, AuthProviderKind.discord],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(auth),
          accountProvider.overrideWith((ref) => Stream.value(null)),
          syncProvider.overrideWith(StubSyncNotifier.new),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: SignInSheet(copy: SignInCopy.keepProOnOtherDevices),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Use Pro on other devices'), findsOneWidget);
    expect(find.text('Not now'), findsOneWidget);
    expect(find.text('Sync your collection'), findsNothing);
  });

  testWidgets('surfaces the failure message when a provider rejects sign-in',
      (tester) async {
    final auth = await _pumpAccount(tester, accounts: Stream.value(null));
    when(() => auth.signIn(any())).thenAnswer(
      (_) async => const SignInFailed('Network problem while signing in.'),
    );

    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue with Google'));
    await tester.pumpAndSettle();

    // Sheet stays open so the customer can retry or pick another provider.
    expect(find.text('Network problem while signing in.'), findsOneWidget);
    expect(find.text('Continue with Discord'), findsOneWidget);
  });

  testWidgets('closes the sheet once a browser handoff is under way',
      (tester) async {
    final auth = await _pumpAccount(tester, accounts: Stream.value(null));
    when(() => auth.signIn(any())).thenAnswer(
      (_) async => const SignInPending(),
    );

    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue with Discord'));
    await tester.pumpAndSettle();

    expect(find.text('Continue with Discord'), findsNothing);
  });

  testWidgets('says nothing about failure when the customer just cancels',
      (tester) async {
    final auth = await _pumpAccount(tester, accounts: Stream.value(null));
    when(() => auth.signIn(any())).thenAnswer(
      (_) async => const SignInCancelled(),
    );

    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue with Google'));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.error_outline), findsNothing);
    expect(find.text('Continue with Google'), findsOneWidget);
  });

  testWidgets('identifies the signed-in account and how they signed in',
      (tester) async {
    await _pumpAccount(tester, accounts: Stream.value(_account));

    expect(find.text('Rhinar Hothead'), findsOneWidget);
    expect(find.text('bravo@example.com · Discord'), findsOneWidget);
    expect(find.text('RH'), findsOneWidget);
    expect(find.text('Sign in'), findsNothing);
  });

  testWidgets('confirms before signing out, and reassures about local data',
      (tester) async {
    final auth = await _pumpAccount(tester, accounts: Stream.value(_account));

    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Sign out?'), findsOneWidget);
    expect(find.textContaining('stays on this device'), findsOneWidget);

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    verifyNever(auth.signOut);

    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Sign out'));
    await tester.pumpAndSettle();
    verify(auth.signOut).called(1);
  });

  testWidgets('shows a placeholder while the stored session is being read',
      (tester) async {
    // A stream that has not emitted yet stands in for the brief window before
    // Supabase reports the restored session.
    final controller = StreamController<Account?>();
    addTearDown(controller.close);
    await _pumpAccount(tester, accounts: controller.stream, settle: false);

    expect(find.text('Checking your session…'), findsOneWidget);
    expect(find.text('Sign in'), findsNothing);

    controller.add(null);
    await tester.pumpAndSettle();
    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('reports when this device last reached the account',
      (tester) async {
    await _pumpAccount(
      tester,
      accounts: Stream.value(_account),
      sync: StubSyncNotifier(
        SyncStatus(lastSyncedAt: DateTime.now().subtract(Duration(minutes: 5))),
      ),
    );

    expect(find.text('Last synced 5m ago.'), findsOneWidget);
  });

  testWidgets('says so plainly when nothing has synced yet', (tester) async {
    await _pumpAccount(tester, accounts: Stream.value(_account));

    expect(find.text('Not synced yet on this device.'), findsOneWidget);
  });

  testWidgets('shows a sync failure beside the account, not in place of it',
      (tester) async {
    await _pumpAccount(
      tester,
      accounts: Stream.value(_account),
      sync: StubSyncNotifier(const SyncStatus(error: 'Offline right now.')),
    );

    // The account itself is still fully usable: a failed sync is not a failed screen.
    expect(find.text('Offline right now.'), findsOneWidget);
    expect(find.text('Rhinar Hothead'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
  });

  testWidgets('lets the customer retry a sync without restarting the app',
      (tester) async {
    final sync = StubSyncNotifier(const SyncStatus(error: 'Offline right now.'));
    await _pumpAccount(tester, accounts: Stream.value(_account), sync: sync);

    await tester.tap(find.text('Sync now'));
    await tester.pumpAndSettle();

    expect(sync.requested, [_account.id]);
  });

  testWidgets('will not stack a second sync on top of one in flight',
      (tester) async {
    final sync = StubSyncNotifier(const SyncStatus(isSyncing: true));
    await _pumpAccount(
      tester,
      accounts: Stream.value(_account),
      sync: sync,
      // The in-progress spinner never settles.
      settle: false,
    );

    await tester.tap(find.text('Syncing…'));
    await tester.pump();

    expect(sync.requested, isEmpty);
  });

  testWidgets('treats an auth stream error as signed out', (tester) async {
    await _pumpAccount(
      tester,
      accounts: Stream.error(Exception('token refresh failed')),
    );

    // Never strand someone in a broken account tile; offer sign-in instead.
    expect(find.text('Sign in'), findsOneWidget);
  });
}
