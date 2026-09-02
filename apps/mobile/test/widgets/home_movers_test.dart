import 'dart:convert';

import 'package:fabtrades/app/app.dart';
import 'package:fabtrades/app/widgets.dart';
import 'package:fabtrades/core/data/set_published_on.dart';
import 'package:fabtrades/core/logic/recent_movers.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/card_detail/card_detail_screen.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';
import 'package:fabtrades/features/search/mover_box.dart';
import 'package:fabtrades/features/search/search_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

RecentMoverRow mover({
  required String direction,
  int rank = 1,
  String cardId = 'aaa-normal',
  String name = 'Awakening',
  String setName = 'The Hunted',
  String finish = 'Rainbow Foil',
  double startLow = 4,
  String startOn = '2026-08-22',
  double latestLow = 6,
  double percentChange = 0.5,
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
  final awakening = buildCard(
    id: 'aaa-normal',
    name: 'Awakening',
    setName: 'The Hunted',
    subTypeName: 'Rainbow Foil',
    tcgLow: 6,
  );
  final unowned = buildCard(
    id: 'hot-unowned',
    name: 'Hot Catalog Card',
    setName: 'The Hunted',
    rarity: 'Rare',
  );
  final catalog = [awakening, unowned];

  final gainer = mover(direction: 'gainer');
  final loser = mover(
    direction: 'loser',
    rank: 1,
    cardId: 'hot-unowned',
    name: 'Hot Catalog Card',
    finish: 'Normal',
    startLow: 8,
    latestLow: 4,
    percentChange: -0.5,
    amountChange: -4,
  );

  Future<void> settle(WidgetTester tester) async {
    await tester.pump();
    await tester.pumpAndSettle();
  }

  testWidgets('tab and app bar say Home, not Browse, and there is no fifth tab',
      (tester) async {
    SharedPreferences.setMockInitialValues({
      OnboardingRepository.storageKey:
          jsonEncode(OnboardingTourId.all.toList()),
    });
    final prefs = await SharedPreferences.getInstance();
    final mockRepo = MockCardRepository();
    when(() => mockRepo.fetchAll()).thenAnswer((_) async => catalog);
    when(() => mockRepo.fetchSetPublishedOn())
        .thenAnswer((_) async => SetPublishedOnMap.empty);
    when(() => mockRepo.recentMovers(any())).thenAnswer((_) async => [gainer]);
    when(() => mockRepo.recentMovers(any(), cardIds: any(named: 'cardIds')))
        .thenAnswer((_) async => const []);
    when(() => mockRepo.printingRecentChanges(any(), any()))
        .thenAnswer((_) async => const []);
    registerFallbackValue(<String>[]);

    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        cardRepositoryProvider.overrideWithValue(mockRepo),
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

    expect(find.text('Home'), findsWidgets);
    expect(find.text('Browse'), findsNothing);
    expect(find.byType(NavigationDestination), findsNWidgets(4));
    expect(find.byIcon(Icons.home), findsOneWidget);
    expect(find.byIcon(Icons.grid_view), findsNothing);
  });

  Future<void> openTrending(WidgetTester tester) async {
    await tester.tap(find.byKey(const Key('seeTrending')));
    await tester.pumpAndSettle();
  }

  testWidgets('empty search shows See Trending above the set list',
      (tester) async {
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer, loser],
    );
    await settle(tester);

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('See Trending'), findsOneWidget);
    expect(find.text('Catalog-wide recent movers'), findsNothing);
    expect(find.text('Your recent movers'), findsNothing);
    expect(find.text('Gainers'), findsNothing);
    expect(find.text('Losers'), findsNothing);
    expect(find.text('Hot Catalog Card'), findsNothing);
    expect(find.text('Welcome to Rathe'), findsNothing);
    expect(find.text('The Hunted'), findsWidgets);
  });

  testWidgets('See Trending opens gainers and losers', (tester) async {
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer, loser],
    );
    await settle(tester);
    await openTrending(tester);

    expect(find.text('Trending'), findsOneWidget);
    expect(find.text('Catalog-wide recent movers'), findsOneWidget);
    expect(find.text('Your recent movers'), findsNothing);
    expect(find.text('Gainers'), findsOneWidget);
    expect(find.text('Losers'), findsOneWidget);
    expect(find.text('Awakening'), findsWidgets);
    expect(find.textContaining('Rainbow Foil'), findsWidgets);
    expect(find.textContaining('+50'), findsWidgets);
    expect(find.text('Hot Catalog Card'), findsWidgets);
    expect(find.textContaining('\$0.00'), findsNothing);
    expect(
      find.textContaining('Observed catalog Lows'),
      findsOneWidget,
    );
  });

  testWidgets('signed-out still shows catalog-wide movers with no sign-in wall',
      (tester) async {
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer],
    );
    await settle(tester);
    expect(find.text('See Trending'), findsOneWidget);
    expect(find.text('Sign in'), findsNothing);

    await openTrending(tester);
    expect(find.text('Catalog-wide recent movers'), findsOneWidget);
    expect(find.text('Sign in'), findsNothing);
  });

  testWidgets('catalog search covers movers and clear restores them',
      (tester) async {
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer],
    );
    await settle(tester);

    await tester.enterText(find.byType(TextField), 'Awakening');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    expect(find.text('See Trending'), findsNothing);
    expect(find.text('Catalog-wide recent movers'), findsNothing);
    expect(find.text('Awakening'), findsWidgets);

    await tester.tap(find.byTooltip('Clear search'));
    await tester.pumpAndSettle();
    expect(find.text('See Trending'), findsOneWidget);
    expect(find.text('Catalog-wide recent movers'), findsNothing);
  });

  testWidgets('Binder cards still show catalog-wide movers only',
      (tester) async {
    final ownedRow = mover(direction: 'gainer', name: 'Awakening');
    final catalogRow = mover(
      direction: 'gainer',
      cardId: 'hot-unowned',
      name: 'Hot Catalog Card',
      finish: 'Normal',
    );
    final container = await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [catalogRow],
      recentMoversByOwnedKey: {
        'aaa-normal': [ownedRow],
      },
    );
    container.read(binderProvider.notifier).add(awakening);
    await settle(tester);

    expect(find.text('Your recent movers'), findsNothing);
    expect(find.text('See Trending'), findsOneWidget);
    expect(find.text('Catalog-wide recent movers'), findsNothing);
    expect(find.text('Hot Catalog Card'), findsNothing);

    await openTrending(tester);
    expect(find.text('Your recent movers'), findsNothing);
    expect(find.text('Catalog-wide recent movers'), findsOneWidget);
    expect(find.text('Hot Catalog Card'), findsOneWidget);
  });

  testWidgets('Want List-only does not show owned movers', (tester) async {
    final container = await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer],
    );
    container.read(binderProvider.notifier).add(awakening, isWanted: true);
    await settle(tester);
    expect(find.text('Your recent movers'), findsNothing);
  });

  testWidgets('empty and full Binders stay catalog-wide only',
      (tester) async {
    final container = await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer],
      recentMoversByOwnedKey: {'aaa-normal': const []},
    );
    await settle(tester);
    expect(find.text('Your recent movers'), findsNothing);
    expect(find.text('See Trending'), findsOneWidget);

    container.read(binderProvider.notifier).add(awakening);
    await settle(tester);
    expect(find.text('Your recent movers'), findsNothing);
    expect(
      find.text('None of your Printings gained enough to rank.'),
      findsNothing,
    );
    expect(find.text('See Trending'), findsOneWidget);

    await openTrending(tester);
    expect(find.text('Your recent movers'), findsNothing);
    expect(find.text('Catalog-wide recent movers'), findsOneWidget);
  });

  testWidgets('same Printing in two Binders is fetched once', (tester) async {
    final container = await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer],
      recentMoversByOwnedKey: {
        'aaa-normal': [gainer],
      },
    );
    container.read(binderProvider.notifier).add(awakening);
    container.read(binderProvider.notifier).add(
          awakening,
          binderId: BinderIds.collection,
        );
    await settle(tester);
    expect(find.text('See Trending'), findsOneWidget);
    expect(find.text('Your recent movers'), findsNothing);

    await openTrending(tester);
    expect(find.text('Awakening'), findsWidgets);
    expect(find.text('Your recent movers'), findsNothing);
    expect(find.text('Catalog-wide recent movers'), findsOneWidget);
  });

  testWidgets('row opens CardDetailScreen for that Printing id',
      (tester) async {
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer],
    );
    await settle(tester);
    await openTrending(tester);

    await tester.tap(find.text('Awakening').first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(CardDetailScreen), findsOneWidget);
    expect(find.text('Awakening'), findsWidgets);
    expect(find.text('Trending'), findsWidgets);
  });

  testWidgets('short lists are not padded; empty copy does not invent \$0.00',
      (tester) async {
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [
        mover(direction: 'gainer', rank: 1, name: 'One'),
        mover(direction: 'gainer', rank: 2, cardId: 'b', name: 'Two'),
        mover(direction: 'gainer', rank: 3, cardId: 'c', name: 'Three'),
      ],
    );
    await settle(tester);
    await openTrending(tester);
    expect(find.text('One'), findsOneWidget);
    expect(find.text('Two'), findsOneWidget);
    expect(find.text('Three'), findsOneWidget);
    expect(find.text('Gainers'), findsOneWidget);
    expect(find.textContaining('No recent losers'), findsOneWidget);
    expect(find.textContaining('\$0.00'), findsNothing);
  });

  testWidgets('movers error shows retry while search stays usable',
      (tester) async {
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMoversError: Exception('offline'),
    );
    await settle(tester);

    expect(find.text('See Trending'), findsOneWidget);
    expect(find.text('Retry'), findsNothing);
    expect(find.text('Search all cards…'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Awakening');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Awakening'), findsWidgets);

    await tester.tap(find.byTooltip('Clear search'));
    await tester.pumpAndSettle();
    await openTrending(tester);
    expect(find.text('Retry'), findsOneWidget);
  });

  Future<void> typeQuery(WidgetTester tester, String query) async {
    await tester.enterText(find.byType(TextField).first, query);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
  }

  testWidgets('Home global search shows trend boxes and keeps sort',
      (tester) async {
    final cheap = buildCard(
      id: 'cheap-bolt',
      name: 'Alpha Bolt',
      setName: 'The Hunted',
      tcgLow: 0.5,
      tcgMarket: 1,
    );
    final pricey = buildCard(
      id: 'pricey-bolt',
      name: 'Zulu Bolt',
      setName: 'The Hunted',
      tcgLow: 20,
      tcgMarket: 40,
    );
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: [...catalog, cheap, pricey],
      recentMovers: [gainer],
      printingRecentChanges: [
        RecentLowChange(
          cardId: 'cheap-bolt',
          startOn: '2026-08-22',
          startLow: 0.3,
          latestLow: 0.6,
          percentChange: 1,
          amountChange: 0.3,
        ),
      ],
    );
    await settle(tester);

    await typeQuery(tester, 'Bolt');
    expect(find.byKey(const Key('search-trend-boxes')), findsOneWidget);
    expect(find.byType(MoverBox), findsWidgets);
    expect(find.byType(CardRow), findsNothing);
    expect(find.text('See Trending'), findsNothing);
    expect(find.text('Catalog-wide recent movers'), findsNothing);
    expect(find.text('Alpha Bolt'), findsOneWidget);
    expect(find.text('Zulu Bolt'), findsOneWidget);

    final alphaY = tester.getTopLeft(find.text('Alpha Bolt')).dy;
    final zuluY = tester.getTopLeft(find.text('Zulu Bolt')).dy;
    expect(alphaY, lessThan(zuluY));

    await tester.tap(find.byTooltip('Sort'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Price (high → low)'));
    await tester.pumpAndSettle();
    expect(
      tester.getTopLeft(find.text('Zulu Bolt')).dy,
      lessThan(tester.getTopLeft(find.text('Alpha Bolt')).dy),
    );

    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    expect(find.textContaining('+100'), findsWidgets);
  });

  testWidgets('in-set search remains a list, not trend boxes', (tester) async {
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer],
    );
    await settle(tester);

    await tester.tap(find.text('The Hunted'));
    await tester.pumpAndSettle();
    expect(find.text('Search in The Hunted…'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Awakening');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('search-trend-boxes')), findsNothing);
    expect(find.byType(CardRow), findsWidgets);
  });

  testWidgets('tapping a search-result box opens that Printing and back keeps query',
      (tester) async {
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer],
    );
    await settle(tester);

    await typeQuery(tester, 'Awakening');
    expect(find.byKey(const Key('search-trend-boxes')), findsOneWidget);
    await tester.tap(find.byType(MoverBox));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(CardDetailScreen), findsOneWidget);

    await tester.pageBack();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byKey(const Key('search-trend-boxes')), findsOneWidget);
    expect(find.text('Awakening'), findsWidgets);
    expect(find.text('See Trending'), findsNothing);
    expect(find.text('Catalog-wide recent movers'), findsNothing);
  });

  testWidgets('no match, omit-change, overlay error, and unpriced stay honest',
      (tester) async {
    final unpriced = buildCard(
      id: 'promo-1',
      name: 'New Promo',
      setName: 'Promos',
    );
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: [...catalog, unpriced],
      recentMovers: [gainer],
    );
    await settle(tester);

    await typeQuery(tester, 'zzzznope');
    expect(find.text('No cards match your filters.'), findsOneWidget);
    expect(find.byKey(const Key('search-trend-boxes')), findsNothing);
    expect(find.textContaining('\$0.00'), findsNothing);

    await tester.tap(find.byTooltip('Clear search'));
    await tester.pumpAndSettle();
    await typeQuery(tester, 'Awakening');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    expect(find.byType(MoverBox), findsWidgets);
    expect(find.textContaining('+50'), findsNothing);
    expect(find.text('No recent move'), findsNothing);

    await tester.tap(find.byTooltip('Clear search'));
    await tester.pumpAndSettle();
  });

  testWidgets('overlay error keeps boxes and offers retry on figures',
      (tester) async {
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: catalog,
      recentMovers: [gainer],
      printingRecentChangesError: Exception('offline'),
    );
    await settle(tester);

    await typeQuery(tester, 'Awakening');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('search-trend-boxes')), findsOneWidget);
    expect(find.text('Awakening'), findsWidgets);
    expect(find.text('Retry'), findsOneWidget);
    expect(find.textContaining('\$0.00'), findsNothing);
  });

  testWidgets('unpriced search box is not \$0.00', (tester) async {
    final unpriced = buildCard(
      id: 'promo-1',
      name: 'New Promo',
      setName: 'Promos',
    );
    await pumpApp(
      tester,
      const BrowseScreen(),
      catalog: [...catalog, unpriced],
      recentMovers: [gainer],
    );
    await settle(tester);
    await typeQuery(tester, 'Promo');
    expect(find.text('New Promo'), findsOneWidget);
    expect(find.textContaining('\$0.00'), findsNothing);
    expect(find.text('—'), findsWidgets);
  });
}
