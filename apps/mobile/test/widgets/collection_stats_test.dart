import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/logic/recent_movers.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/binder/binder_screen.dart';
import 'package:fabtrades/features/binder/collection_stats_screen.dart';
import 'package:fabtrades/features/card_detail/card_detail_screen.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

Map<String, Object> _onboarded() => {
      OnboardingRepository.storageKey:
          jsonEncode(OnboardingTourId.all.toList()),
    };

RecentMoverRow mover({
  required String direction,
  int rank = 1,
  String cardId = 'a-Normal',
  String name = 'Alpha',
  String setName = 'Origins',
  String finish = 'Normal',
  double startLow = 8,
  String startOn = '2026-08-22',
  double latestLow = 10,
  double percentChange = 0.25,
  double amountChange = 2,
}) =>
    RecentMoverRow(
      direction: direction,
      rank: rank,
      cardId: cardId,
      name: name,
      setName: setName,
      finish: finish,
      startLow: startLow,
      startOn: startOn,
      latestLow: latestLow,
      percentChange: percentChange,
      amountChange: amountChange,
    );

void main() {
  testWidgets('empty Binder hides Collection Stats', (tester) async {
    await pumpApp(tester, const BinderScreen(), seed: _onboarded());
    await tester.pump();
    expect(find.byKey(const Key('collectionStatsButton')), findsNothing);
    expect(find.byKey(const Key('binderValueChip')), findsNothing);
  });

  testWidgets(
      'Collection Stats opens a page with Binder name and current total; back restores the list',
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
    await tester.tap(find.byKey(const Key('binderTile-system:trade')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('collectionStatsButton')), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const Key('collectionStatsButton')),
        matching: find.text('Collection Stats'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('collectionStatsButton')),
        matching: find.text('\$12.50'),
      ),
      findsNothing,
    );
    expect(find.byKey(const Key('binderValueChip')), findsNothing);

    await tester.tap(find.byKey(const Key('collectionStatsButton')));
    await tester.pumpAndSettle();

    expect(find.byType(CollectionStatsScreen), findsOneWidget);
    expect(find.text('Collection Stats'), findsWidgets);
    expect(find.text('Trade Binder'), findsOneWidget);
    expect(find.text('Total Value'), findsOneWidget);
    expect(find.byKey(const Key('collectionStatsHeadline')), findsOneWidget);
    expect(find.text('\$12.50'), findsOneWidget);
    expect(find.text('—'), findsOneWidget);
    expect(find.text('Binder value'), findsNothing);
    expect(container.read(binderProvider).single.quantity, 1);

    await tester.pageBack();
    await tester.pumpAndSettle();

    expect(find.byType(CollectionStatsScreen), findsNothing);
    expect(container.read(binderProvider).single.quantity, 1);
    expect(find.text('Alpha'), findsOneWidget);
    expect(find.byKey(const Key('collectionStatsButton')), findsOneWidget);
  });

  testWidgets('Collection Stats and Add card sit at the bottom of the list',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

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
    await tester.tap(find.byKey(const Key('binderTile-system:trade')));
    await tester.pumpAndSettle();

    final stats = tester.getRect(find.byKey(const Key('collectionStatsButton')));
    final addCard = tester.getRect(find.widgetWithText(FloatingActionButton, 'Add card'));
    final row = tester.getRect(find.byKey(const Key('binderActionRow')));
    final screen = tester.view.physicalSize / tester.view.devicePixelRatio;

    expect(row.height, closeTo(56, 0.5));
    expect(stats.top, greaterThan(screen.height * 0.75));
    expect(addCard.top, greaterThan(screen.height * 0.75));
    expect((stats.top - addCard.top).abs(), lessThan(8));
    expect(addCard.left - stats.right, greaterThanOrEqualTo(12));
    expect(find.text('Alpha'), findsOneWidget);
  });

  testWidgets('Want List tab has no Collection Stats button', (tester) async {
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
    await tester.tap(find.byKey(const Key('binderTile-system:trade')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('collectionStatsButton')), findsOneWidget);

    await tester.tap(find.byKey(const Key('binderBackToGrid')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(Tab, 'Want List (0)'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.byKey(const Key('collectionStatsButton')), findsNothing);
    expect(find.text('Want List'), findsOneWidget);
  });

  testWidgets('headline shows Total Value with USD and Euro side by side',
      (tester) async {
    final container = await pumpApp(
      tester,
      const CollectionStatsScreen(),
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
    await tester.pump();

    expect(find.text('Total Value'), findsOneWidget);
    expect(find.text('\$5.00'), findsOneWidget);
    expect(find.text('€4.00'), findsOneWidget);
    expect(find.text('TCGplayer (USD)'), findsNothing);
    expect(find.text('CardMarket (EUR)'), findsNothing);
    expect(find.text('Market'), findsNothing);
    expect(find.text('Trend'), findsNothing);
    expect(find.text('Top Printings'), findsNothing);
    expect(find.text('Stock'), findsNothing);
    expect(find.text('\$0.00'), findsNothing);
    expect(find.text('€0.00'), findsNothing);
    expect(find.byType(CollectionStatsScreen), findsOneWidget);
  });

  testWidgets('movers are this Binder only and show copies; tap opens details',
      (tester) async {
    final alpha = buildCard(
      id: 'a-Normal',
      name: 'Alpha',
      setName: 'Origins',
      subTypeName: 'Normal',
      tcgMarket: 12.5,
      tcgLow: 10,
    );
    final hot = buildCard(
      id: 'hot-unowned',
      name: 'Hot Catalog Card',
      setName: 'Origins',
    );
    final gainer = mover(direction: 'gainer');
    final catalogGainer = mover(
      direction: 'gainer',
      cardId: 'hot-unowned',
      name: 'Hot Catalog Card',
    );
    final container = await pumpApp(
      tester,
      const CollectionStatsScreen(),
      seed: _onboarded(),
      catalog: [alpha, hot],
      recentMovers: [catalogGainer],
      recentMoversByOwnedKey: {
        'a-Normal': [gainer],
      },
    );
    container.read(binderProvider.notifier).add(alpha, quantity: 2);
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.text('Alpha'), findsWidgets);
    expect(find.textContaining('2 copies'), findsWidgets);
    expect(find.textContaining('Origins'), findsWidgets);
    expect(find.textContaining('Normal'), findsWidgets);
    expect(find.text('Gainers'), findsOneWidget);
    expect(find.text('Hot Catalog Card'), findsNothing);
    expect(find.text('\$0.00'), findsNothing);

    await tester.tap(find.text('Alpha').first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(CardDetailScreen), findsOneWidget);

    await tester.pageBack();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(CollectionStatsScreen), findsOneWidget);
    expect(find.byKey(const Key('collectionStatsHeadline')), findsOneWidget);
  });

  testWidgets('a Printing in Binder A does not appear on Binder B',
      (tester) async {
    final alpha = buildCard(id: 'a-Normal', name: 'Alpha', tcgMarket: 12.5);
    await pumpApp(
      tester,
      const CollectionStatsScreen(),
      seed: _onboarded(),
      catalog: [alpha],
      recentMoversByOwnedKey: {
        'a-Normal': [mover(direction: 'gainer')],
      },
    );
    // Collection is open-empty of Alpha (default open is Trade, which is also empty).
    await tester.pumpAndSettle();
    expect(find.text('Alpha'), findsNothing);
    expect(find.text('No Printings in this Binder to rank.'), findsOneWidget);
    expect(find.byKey(const Key('collectionStatsHeadline')), findsOneWidget);
  });

  testWidgets('RPC empty with ids is honest empty; headline stays',
      (tester) async {
    final alpha = buildCard(id: 'a-Normal', name: 'Alpha', tcgMarket: 12.5);
    final container = await pumpApp(
      tester,
      const CollectionStatsScreen(),
      seed: _onboarded(),
      catalog: [alpha],
      recentMoversByOwnedKey: {'a-Normal': const []},
    );
    container.read(binderProvider.notifier).add(alpha);
    await tester.pumpAndSettle();

    expect(
      find.text('None of these Printings gained or lost enough to rank.'),
      findsOneWidget,
    );
    expect(find.text('\$0.00'), findsNothing);
    expect(find.byKey(const Key('collectionStatsHeadline')), findsOneWidget);
  });

  testWidgets('movers error shows retry and leaves headline visible',
      (tester) async {
    final alpha = buildCard(id: 'a-Normal', name: 'Alpha', tcgMarket: 12.5);
    final container = await pumpApp(
      tester,
      const CollectionStatsScreen(),
      seed: _onboarded(),
      catalog: [alpha],
      recentMoversOwnedError: Exception('offline'),
    );
    container.read(binderProvider.notifier).add(alpha);
    await tester.pumpAndSettle();

    expect(find.text('Retry'), findsOneWidget);
    expect(find.byKey(const Key('collectionStatsHeadline')), findsOneWidget);
    expect(find.text('Total Value'), findsOneWidget);
  });

  testWidgets('Want List ids are never sent as movers', (tester) async {
    final owned = buildCard(id: 'a-Normal', name: 'Alpha', tcgMarket: 12.5);
    final wanted = buildCard(id: 'w-Normal', name: 'Wanted Card', tcgMarket: 9);
    final container = await pumpApp(
      tester,
      const CollectionStatsScreen(),
      seed: _onboarded(),
      catalog: [owned, wanted],
      recentMoversByOwnedKey: {
        'a-Normal': [mover(direction: 'gainer')],
      },
    );
    container.read(binderProvider.notifier).add(owned);
    container.read(binderProvider.notifier).add(wanted, isWanted: true);
    await tester.pumpAndSettle();

    expect(find.text('Alpha'), findsWidgets);
    expect(find.text('Wanted Card'), findsNothing);
  });
}
