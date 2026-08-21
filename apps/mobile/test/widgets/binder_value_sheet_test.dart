import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/binder/binder_screen.dart';
import 'package:fabtrades/features/binder/binder_value_sheet.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

Map<String, Object> _onboarded() => {
      OnboardingRepository.storageKey:
          jsonEncode(OnboardingTourId.all.toList()),
    };

void main() {
  testWidgets('empty Binder hides the value chip', (tester) async {
    await pumpApp(tester, const BinderScreen(), seed: _onboarded());
    await tester.pump();
    expect(find.byKey(const Key('binderValueChip')), findsNothing);
  });

  testWidgets('chip opens Binder value sheet matching the total; dismiss leaves entries',
      (tester) async {
    final container = await pumpApp(
      tester,
      const BinderScreen(),
      seed: _onboarded(),
    );
    await tester.pump();

    container.read(binderProvider.notifier).add(
          buildCard(id: 'a-Normal', name: 'Alpha', tcgMarket: 12.5, tcgLow: 8),
        );
    await tester.pump();

    expect(find.byKey(const Key('binderValueChip')), findsOneWidget);
    expect(find.text('\$12.50'), findsWidgets);

    await tester.tap(find.byKey(const Key('binderValueChip')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Binder value'), findsOneWidget);
    expect(find.byKey(const Key('binderValueHeadline')), findsOneWidget);
    expect(
      tester.widget<Text>(find.byKey(const Key('binderValueHeadline'))).data,
      '\$12.50',
    );
    expect(container.read(binderProvider).single.quantity, 1);

    await tester.tapAt(const Offset(8, 8));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byKey(const Key('binderValueHeadline')), findsNothing);
    expect(container.read(binderProvider).single.quantity, 1);
    expect(find.text('Alpha'), findsOneWidget);
  });

  testWidgets('Want List tab hides the Binder value chip', (tester) async {
    final container = await pumpApp(
      tester,
      const BinderScreen(),
      seed: _onboarded(),
    );
    await tester.pump();
    container.read(binderProvider.notifier).add(
          buildCard(id: 'a-Normal', name: 'Alpha', tcgMarket: 12.5),
        );
    await tester.pump();
    expect(find.byKey(const Key('binderValueChip')), findsOneWidget);

    await tester.tap(find.widgetWithText(Tab, 'Want List (0)'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.byKey(const Key('binderValueChip')), findsNothing);
  });

  testWidgets('sheet shows TCG Market/Low and CardMarket Trend/Low; unpriced is dash',
      (tester) async {
    final container = await pumpApp(
      tester,
      const Scaffold(body: BinderValueSheet()),
      seed: _onboarded(),
    );
    await tester.pump();
    container.read(binderProvider.notifier).add(
          buildCard(
            id: 'a-Normal',
            name: 'Alpha',
            tcgMarket: 5,
            tcgLow: null,
            cmTrend: 4,
            cmLow: 2,
          ),
        );
    await tester.pump();

    expect(find.text('TCGplayer (USD)'), findsOneWidget);
    expect(find.text('CardMarket (EUR)'), findsOneWidget);
    expect(find.text('Market'), findsOneWidget);
    expect(find.text('Trend'), findsOneWidget);
    expect(find.text('\$5.00'), findsWidgets);
    expect(find.text('€4.00'), findsOneWidget);
    expect(find.text('€2.00'), findsOneWidget);
    expect(find.text('—'), findsOneWidget);
    expect(find.textContaining('unpriced'), findsWidgets);
    expect(find.text('\$0.00'), findsNothing);
    expect(find.text('€0.00'), findsNothing);
  });

  testWidgets('sheet shows stock counts and top Printings without padding',
      (tester) async {
    final container = await pumpApp(
      tester,
      const Scaffold(body: BinderValueSheet()),
      seed: _onboarded(),
    );
    await tester.pump();
    container.read(binderProvider.notifier).add(
          buildCard(
            id: 'a-Normal',
            name: 'Alpha',
            isFoil: false,
            subTypeName: 'Normal',
            tcgMarket: 10,
          ),
          quantity: 2,
        );
    container.read(binderProvider.notifier).add(
          buildCard(
            id: 'b-RF',
            name: 'Bravo',
            isFoil: true,
            subTypeName: 'Rainbow Foil',
            tcgMarket: 3,
          ),
        );
    await tester.pump();

    expect(find.textContaining('3 copies'), findsOneWidget);
    expect(find.textContaining('2 Printings'), findsOneWidget);
    expect(find.textContaining('1 foil'), findsOneWidget);
    expect(find.textContaining('2 Regular'), findsOneWidget);
    expect(find.text('Top Printings'), findsOneWidget);
    expect(find.text('Alpha'), findsOneWidget);
    expect(find.text('Bravo'), findsOneWidget);
    expect(find.text('\$20.00'), findsWidgets);
  });
}
