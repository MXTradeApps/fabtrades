import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fabtrades/app/app.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

/// Headless end-to-end smoke of the whole app shell (Browse → Trade → Lend
/// navigation and the trade badge), mirroring integration_test/app_test.dart
/// so the same flow is covered by plain `flutter test`.
void main() {
  final catalog = [
    buildCard(id: 'vex', name: 'Vex - Apathetic', rarity: 'Rare', tcgMarket: 3.5),
    buildCard(
        id: 'ahri', name: 'Ahri - Inquisitive', rarity: 'Champion', tcgMarket: 12),
  ];

  Future<ProviderContainer> launch(WidgetTester tester) async {
    // Skip the welcome carousel so smoke tests exercise the tab shell.
    SharedPreferences.setMockInitialValues({
      OnboardingRepository.storageKey:
          jsonEncode(OnboardingTourId.all.toList()),
    });
    final prefs = await SharedPreferences.getInstance();
    final mockRepo = MockCardRepository();
    when(() => mockRepo.fetchAll()).thenAnswer((_) async => catalog);

    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        cardRepositoryProvider.overrideWithValue(mockRepo),
        // Skip the remote update check in headless smoke tests.
        appUpdatePromptProvider.overrideWith((ref) async => null),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const FabTradesApp(),
      ),
    );
    await tester.pumpAndSettle();
    return container;
  }

  testWidgets('boots with the four main tabs', (tester) async {
    await launch(tester);
    expect(find.text('Browse'), findsWidgets);
    expect(find.text('Trade'), findsWidgets);
    expect(find.text('Binder'), findsWidgets);
    expect(find.text('Lend'), findsWidgets);
  });

  testWidgets('navigating to the Trade tab shows its add rows', (tester) async {
    await launch(tester);
    await tester.tap(find.text('Trade'));
    await tester.pumpAndSettle();
    expect(find.text('Add my cards'), findsOneWidget);
  });

  testWidgets('adding a card to the draft updates the trade badge & list',
      (tester) async {
    final container = await launch(tester);

    container
        .read(tradeDraftProvider.notifier)
        .addCard(TradeSide.have, catalog.first);
    await tester.pumpAndSettle();
    expect(find.text('1'), findsWidgets);

    await tester.tap(find.text('Trade'));
    await tester.pumpAndSettle();
    expect(find.text('Vex - Apathetic'), findsOneWidget);
  });

  testWidgets('Life Tracker covers the tab bar', (tester) async {
    await launch(tester);

    await tester.tap(find.byTooltip('Menu').hitTestable().first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Life Tracker'));
    await tester.pumpAndSettle();

    expect(find.byType(NavigationBar).hitTestable(), findsNothing);
    expect(find.byTooltip('Close'), findsOneWidget);
    expect(find.byTooltip('Settings'), findsOneWidget);
  });
}
