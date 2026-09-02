import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fabtrades/app/app.dart';
import 'package:fabtrades/core/data/card_repository.dart';
import 'package:fabtrades/core/data/set_published_on.dart';
import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockCardRepository extends Mock implements CardRepository {}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final catalog = [
    CardModel(
      id: 'vex',
      name: 'Vex - Apathetic',
      setName: 'Origins',
      rarity: 'Rare',
      collectorNumber: '001/219',
      tcgMarket: 3.50,
    ),
    CardModel(
      id: 'ahri',
      name: 'Ahri - Inquisitive',
      setName: 'Origins',
      rarity: 'Champion',
      collectorNumber: '147/219',
      tcgMarket: 12.00,
    ),
  ];

  Future<ProviderContainer> launch(WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final mockRepo = MockCardRepository();
    registerFallbackValue(<String>[]);
    when(() => mockRepo.fetchAll()).thenAnswer((_) async => catalog);
    when(() => mockRepo.fetchSetPublishedOn())
        .thenAnswer((_) async => SetPublishedOnMap.empty);
    when(() => mockRepo.recentMovers(any())).thenAnswer((_) async => []);
    when(() => mockRepo.recentMovers(any(), cardIds: any(named: 'cardIds')))
        .thenAnswer((_) async => []);
    when(() => mockRepo.printingRecentChanges(any(), any()))
        .thenAnswer((_) async => []);

    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        cardRepositoryProvider.overrideWithValue(mockRepo),
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

  testWidgets('app boots on the Home tab with bottom navigation',
      (tester) async {
    await launch(tester);

    expect(find.text('Home'), findsWidgets);
    expect(find.text('Trade'), findsWidgets);
    expect(find.text('Binder'), findsWidgets);
    expect(find.text('Lend'), findsWidgets);
  });

  testWidgets('can navigate across the four main tabs', (tester) async {
    await launch(tester);

    await tester.tap(find.text('Trade'));
    await tester.pumpAndSettle();
    expect(find.text('Add my cards'), findsOneWidget);

    await tester.tap(find.text('Lend'));
    await tester.pumpAndSettle();
    // Lend screen renders without throwing.
    expect(find.byType(Scaffold), findsWidgets);

    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();
    expect(find.byType(Scaffold), findsWidgets);
  });

  testWidgets('adding a card to the draft surfaces the trade badge count',
      (tester) async {
    final container = await launch(tester);

    container.read(tradeDraftProvider.notifier).addCard(
          TradeSide.have,
          catalog.first,
        );
    await tester.pumpAndSettle();

    // Badge shows the total card count on the Trade destination.
    expect(find.text('1'), findsWidgets);

    await tester.tap(find.text('Trade'));
    await tester.pumpAndSettle();
    expect(find.text('Vex - Apathetic'), findsOneWidget);
  });

  testWidgets('opening settings from the trade tab changes the price source',
      (tester) async {
    final container = await launch(tester);

    await tester.tap(find.text('Trade'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();
    expect(find.text('Settings'), findsOneWidget);

    await tester.tap(find.text('CardMarket'));
    await tester.pumpAndSettle();
    expect(container.read(settingsProvider).source, PriceSource.cardmarket);
  });
}
