import 'package:fabtrades/app/app.dart';
import 'package:fabtrades/core/models/account.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/harness.dart';

void main() {
  testWidgets('menu offers Sign up when signed out', (tester) async {
    await pumpApp(
      tester,
      Scaffold(appBar: AppBar(actions: const [AppMenuAction()])),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();

    expect(find.text('Sign up'), findsOneWidget);
    expect(find.text('My Account'), findsNothing);
    expect(find.text('Life Tracker'), findsOneWidget);
    expect(find.text('Import from Fabrary'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);
  });

  testWidgets('menu offers My Account when signed in', (tester) async {
    await pumpApp(
      tester,
      Scaffold(appBar: AppBar(actions: const [AppMenuAction()])),
      account: const Account(
        id: '9f1c0b62-0000-4000-8000-000000000001',
        email: 'bravo@example.com',
        displayName: 'Rhinar Hothead',
        provider: AuthProviderKind.discord,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();

    expect(find.text('My Account'), findsOneWidget);
    expect(find.text('Sign up'), findsNothing);
    expect(find.text('Life Tracker'), findsOneWidget);
    expect(find.text('Import from Fabrary'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);
  });

  testWidgets('Settings opens the settings screen', (tester) async {
    await pumpApp(
      tester,
      Scaffold(appBar: AppBar(actions: const [AppMenuAction()])),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();

    expect(find.text('PRICE SOURCE'), findsOneWidget);
    expect(find.text('APPEARANCE'), findsOneWidget);
  });

  testWidgets('My Account opens the account screen', (tester) async {
    await pumpApp(
      tester,
      Scaffold(appBar: AppBar(actions: const [AppMenuAction()])),
      account: const Account(
        id: '9f1c0b62-0000-4000-8000-000000000001',
        email: 'bravo@example.com',
        displayName: 'Rhinar Hothead',
        provider: AuthProviderKind.discord,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('My Account'));
    await tester.pumpAndSettle();

    expect(find.text('My Account'), findsWidgets);
    expect(find.text('Rhinar Hothead'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
  });
}
