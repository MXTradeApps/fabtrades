import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fabtrades/core/data/card_repository.dart';
import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fixtures.dart';

class MockCardRepository extends Mock implements CardRepository {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<ProviderContainer> makeContainer({
    Map<String, Object> seed = const {},
    CardRepository? cardRepository,
  }) async {
    SharedPreferences.setMockInitialValues(seed);
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        if (cardRepository != null)
          cardRepositoryProvider.overrideWithValue(cardRepository),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('SettingsNotifier', () {
    test('starts from persisted defaults', () async {
      final c = await makeContainer();
      expect(c.read(settingsProvider).source, PriceSource.tcgplayer);
    });

    test('setSource updates state and persists', () async {
      final c = await makeContainer();
      c.read(settingsProvider.notifier).setSource(PriceSource.cardmarket);
      expect(c.read(settingsProvider).source, PriceSource.cardmarket);

      // A fresh notifier built from the same prefs should read the saved value.
      final reloaded = c.read(settingsRepositoryProvider).load();
      expect(reloaded.source, PriceSource.cardmarket);
    });

    test('pricingProvider tracks the current settings symbol', () async {
      final c = await makeContainer();
      expect(c.read(pricingProvider).symbol, '\$');
      c.read(settingsProvider.notifier).setSource(PriceSource.cardmarket);
      expect(c.read(pricingProvider).symbol, '€');
    });
  });

  group('SearchFiltersNotifier', () {
    test('enterSet replaces filters with only the set', () async {
      final c = await makeContainer();
      final n = c.read(searchFiltersProvider.notifier);
      n.setFoilOnly(true);
      n.enterSet('Origins');
      final f = c.read(searchFiltersProvider);
      expect(f.setName, 'Origins');
      expect(f.foilOnly, isFalse);
    });

    test('clear keeps the current set but resets other filters', () async {
      final c = await makeContainer();
      final n = c.read(searchFiltersProvider.notifier);
      n.enterSet('Unleashed');
      n.setFoilOnly(true);
      n.setQuery('vex');
      n.clear();
      final f = c.read(searchFiltersProvider);
      expect(f.setName, 'Unleashed');
      expect(f.foilOnly, isFalse);
      expect(f.query, '');
    });
  });

  group('BinderNotifier', () {
    test('add merges quantity for a duplicate printing+list', () async {
      final c = await makeContainer();
      final n = c.read(binderProvider.notifier);
      final card = buildCard(id: 'k');
      n.add(card, quantity: 1);
      n.add(card, quantity: 2);
      expect(c.read(binderProvider).length, 1);
      expect(n.quantityOf('k'), 3);
    });

    test('same card in binder vs wanted are separate entries', () async {
      final c = await makeContainer();
      final n = c.read(binderProvider.notifier);
      final card = buildCard(id: 'k');
      n.add(card, isWanted: false);
      n.add(card, isWanted: true);
      expect(c.read(binderProvider).length, 2);
      expect(n.quantityOf('k', isWanted: false), 1);
      expect(n.quantityOf('k', isWanted: true), 1);
    });

    test('setQuantity to zero removes the entry', () async {
      final c = await makeContainer();
      final n = c.read(binderProvider.notifier);
      n.add(buildCard(id: 'k'));
      n.setQuantity('k', false, 0);
      expect(c.read(binderProvider), isEmpty);
    });

    test('setCondition updates only the matching entry', () async {
      final c = await makeContainer();
      final n = c.read(binderProvider.notifier);
      n.add(buildCard(id: 'k'));
      n.setCondition('k', false, 'HP');
      expect(c.read(binderProvider).single.condition, 'HP');
    });

    test('replaceCard swaps printing and keeps quantity/condition', () async {
      final c = await makeContainer();
      final n = c.read(binderProvider.notifier);
      n.add(buildCard(id: 'first', setName: 'Monarch'), quantity: 2);
      n.setCondition('first', false, 'LP');
      n.replaceCard(
          'first', false, buildCard(id: 'unltd', setName: 'Monarch Unlimited'));
      final entry = c.read(binderProvider).single;
      expect(entry.card.id, 'unltd');
      expect(entry.quantity, 2);
      expect(entry.condition, 'LP');
    });

    test('replaceCard merges when target printing already present', () async {
      final c = await makeContainer();
      final n = c.read(binderProvider.notifier);
      n.add(buildCard(id: 'a'), quantity: 2);
      n.add(buildCard(id: 'b'), quantity: 1);
      n.replaceCard('a', false, buildCard(id: 'b'));
      final entries = c.read(binderProvider);
      expect(entries.length, 1);
      expect(entries.single.card.id, 'b');
      expect(entries.single.quantity, 3);
    });

    test('state persists across a rebuilt container', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final c1 = ProviderContainer(overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
      ]);
      c1.read(binderProvider.notifier).add(buildCard(id: 'persist'));
      c1.dispose();

      final c2 = ProviderContainer(overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
      ]);
      addTearDown(c2.dispose);
      expect(c2.read(binderProvider).single.card.id, 'persist');
    });

    test('applyTradeConfirm decrements, adds, clears want list, clamps',
        () async {
      final c = await makeContainer();
      final n = c.read(binderProvider.notifier);
      final given = buildCard(id: 'give');
      final received = buildCard(id: 'recv');
      n.add(given, quantity: 1); // will clamp when decrementing 2
      n.add(received, quantity: 1, isWanted: true);

      final trade = Trade(
        id: 't1',
        createdAt: DateTime.utc(2026, 1, 1),
        haveItems: [TradeItem(card: given, quantity: 2, priceEach: 1)],
        wantItems: [TradeItem(card: received, quantity: 1, priceEach: 2)],
      );
      n.applyTradeConfirm(trade,
          removeGivenFromBinder: true, addReceivedToBinder: true);

      final state = c.read(binderProvider);
      expect(state.where((e) => e.card.id == 'give'), isEmpty);
      expect(
          state.where((e) => e.card.id == 'recv' && !e.isWanted).single.quantity,
          1);
      expect(state.where((e) => e.card.id == 'recv' && e.isWanted), isEmpty);
    });
  });

  group('LendNotifier', () {
    test('createGroup returns a lookupable id', () async {
      final c = await makeContainer();
      final n = c.read(lendProvider.notifier);
      final id = n.createGroup(personName: 'Alex');
      expect(c.read(lendGroupProvider(id))?.personName, 'Alex');
    });

    test('addCard merges quantities for the same printing', () async {
      final c = await makeContainer();
      final n = c.read(lendProvider.notifier);
      // Borrowing is uncapped; a lent group would refuse once
      // FreeLimits.loanedCards is reached. Merge itself is what this asserts.
      final id = n.createGroup(isBorrowing: true);
      n.addCard(id, buildCard(id: 'card'), quantity: 1);
      n.addCard(id, buildCard(id: 'card'), quantity: 2);
      expect(c.read(lendGroupProvider(id))!.items.single.quantity, 3);
    });

    test('setCardQuantity to zero removes the card', () async {
      final c = await makeContainer();
      final n = c.read(lendProvider.notifier);
      final id = n.createGroup();
      n.addCard(id, buildCard(id: 'card'));
      n.setCardQuantity(id, 'card', 0);
      expect(c.read(lendGroupProvider(id))!.items, isEmpty);
    });

    test('removeGroup deletes it', () async {
      final c = await makeContainer();
      final n = c.read(lendProvider.notifier);
      final id = n.createGroup();
      n.removeGroup(id);
      expect(c.read(lendGroupProvider(id)), isNull);
    });

    test('setPersonName clears when blank', () async {
      final c = await makeContainer();
      final n = c.read(lendProvider.notifier);
      final id = n.createGroup(personName: 'Alex');
      n.setPersonName(id, '   ');
      expect(c.read(lendGroupProvider(id))!.personName, isNull);
    });
  });

  group('TradeHistoryNotifier', () {
    test('addTrade prepends newest first', () async {
      final c = await makeContainer();
      final n = c.read(tradeHistoryProvider.notifier);
      n.addTrade(Trade(id: 'a', createdAt: DateTime(2026, 1, 1)));
      n.addTrade(Trade(id: 'b', createdAt: DateTime(2026, 1, 2)));
      expect(c.read(tradeHistoryProvider).map((t) => t.id), ['b', 'a']);
    });

    test('remove deletes by id', () async {
      final c = await makeContainer();
      final n = c.read(tradeHistoryProvider.notifier);
      n.addTrade(Trade(id: 'a', createdAt: DateTime(2026, 1, 1)));
      n.remove('a');
      expect(c.read(tradeHistoryProvider), isEmpty);
    });
  });

  group('TradeDraftNotifier', () {
    test('addCard captures the price at add time', () async {
      final c = await makeContainer();
      final n = c.read(tradeDraftProvider.notifier);
      n.addCard(TradeSide.have, buildCard(id: 'x', tcgMarket: 5.0));
      final draft = c.read(tradeDraftProvider);
      expect(draft.haveItems.single.priceEach, 5.0);
      expect(draft.haveTotal, 5.0);
    });

    test('adding the same card twice merges quantity', () async {
      final c = await makeContainer();
      final n = c.read(tradeDraftProvider.notifier);
      final card = buildCard(id: 'x', tcgMarket: 2.0);
      n.addCard(TradeSide.have, card);
      n.addCard(TradeSide.have, card);
      expect(c.read(tradeDraftProvider).haveItems.single.quantity, 2);
    });

    test('replaceCard swaps printing and keeps quantity', () async {
      final c = await makeContainer();
      final n = c.read(tradeDraftProvider.notifier);
      n.addCard(TradeSide.have, buildCard(id: 'normal', tcgMarket: 1.0),
          quantity: 3);
      n.replaceCard(
          TradeSide.have, 'normal', buildCard(id: 'foil', tcgMarket: 4.0));
      final item = c.read(tradeDraftProvider).haveItems.single;
      expect(item.card.id, 'foil');
      expect(item.quantity, 3);
      expect(item.priceEach, 4.0);
    });

    test('replaceCard merges when target printing already present', () async {
      final c = await makeContainer();
      final n = c.read(tradeDraftProvider.notifier);
      n.addCard(TradeSide.have, buildCard(id: 'a', tcgMarket: 1.0), quantity: 2);
      n.addCard(TradeSide.have, buildCard(id: 'b', tcgMarket: 1.0), quantity: 1);
      n.replaceCard(TradeSide.have, 'a', buildCard(id: 'b', tcgMarket: 1.0));
      final items = c.read(tradeDraftProvider).haveItems;
      expect(items.length, 1);
      expect(items.single.card.id, 'b');
      expect(items.single.quantity, 3);
    });

    test('setQuantity to zero removes the line', () async {
      final c = await makeContainer();
      final n = c.read(tradeDraftProvider.notifier);
      n.addCard(TradeSide.want, buildCard(id: 'x', tcgMarket: 1.0));
      n.setQuantity(TradeSide.want, 'x', 0);
      expect(c.read(tradeDraftProvider).wantItems, isEmpty);
    });

    test('clear empties the draft', () async {
      final c = await makeContainer();
      final n = c.read(tradeDraftProvider.notifier);
      n.addCard(TradeSide.have, buildCard(id: 'x', tcgMarket: 1.0));
      n.setCash(TradeSide.want, 10);
      n.clear();
      final draft = c.read(tradeDraftProvider);
      expect(draft.haveItems, isEmpty);
      expect(draft.wantCash, 0);
    });

    test('changing the price source re-prices existing lines & currency',
        () async {
      final c = await makeContainer();
      final n = c.read(tradeDraftProvider.notifier);
      n.addCard(
        TradeSide.have,
        buildCard(id: 'x', tcgMarket: 5.0, cmTrend: 9.0),
      );
      expect(c.read(tradeDraftProvider).haveItems.single.priceEach, 5.0);

      c.read(settingsProvider.notifier).setSource(PriceSource.cardmarket);

      final draft = c.read(tradeDraftProvider);
      expect(draft.haveItems.single.priceEach, 9.0);
      expect(draft.currencySymbol, '€');
    });
  });

  group('CatalogNotifier (mocked remote)', () {
    setUpAll(() {
      registerFallbackValue(<CardModel>[]);
    });

    test('fetches and caches when no local cache exists', () async {
      final mockRepo = MockCardRepository();
      final remote = [buildCard(id: 'remote-1'), buildCard(id: 'remote-2')];
      when(() => mockRepo.fetchAll()).thenAnswer((_) async => remote);

      final c = await makeContainer(cardRepository: mockRepo);

      final cards = await c.read(catalogProvider.future);
      expect(cards.map((e) => e.id), ['remote-1', 'remote-2']);
      // Should have been persisted for next launch.
      expect(c.read(catalogRepositoryProvider).load()!.map((e) => e.id),
          ['remote-1', 'remote-2']);
    });

    test('serves cached catalog immediately without a blocking fetch',
        () async {
      final mockRepo = MockCardRepository();
      // Background refresh may still be triggered; make it a no-op success.
      when(() => mockRepo.fetchAll())
          .thenAnswer((_) async => [buildCard(id: 'fresh')]);

      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      // Seed the cache directly through the repository.
      final container = ProviderContainer(overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        cardRepositoryProvider.overrideWithValue(mockRepo),
      ]);
      addTearDown(container.dispose);
      await container
          .read(catalogRepositoryProvider)
          .save([buildCard(id: 'cached')]);

      final cards = await container.read(catalogProvider.future);
      expect(cards.map((e) => e.id), ['cached']);
    });

    test('refresh re-fetches and replaces state', () async {
      final mockRepo = MockCardRepository();
      when(() => mockRepo.fetchAll())
          .thenAnswer((_) async => [buildCard(id: 'v1')]);

      final c = await makeContainer(cardRepository: mockRepo);
      await c.read(catalogProvider.future);

      when(() => mockRepo.fetchAll())
          .thenAnswer((_) async => [buildCard(id: 'v2')]);
      await c.read(catalogProvider.notifier).refresh();

      expect(c.read(catalogProvider).value!.map((e) => e.id), ['v2']);
    });
  });

  group('derived providers', () {
    test('browseResults and browseGroups derive from catalog + filters',
        () async {
      final mockRepo = MockCardRepository();
      when(() => mockRepo.fetchAll()).thenAnswer((_) async => [
            buildCard(id: 'n', name: 'Vex', isFoil: false),
            buildCard(id: 'f', name: 'Vex', isFoil: true),
            buildCard(id: 'a', name: 'Ahri'),
          ]);

      final c = await makeContainer(cardRepository: mockRepo);
      await c.read(catalogProvider.future);

      final results = c.read(browseResultsProvider).value!;
      expect(results.length, 3);

      final groups = c.read(browseGroupsProvider).value!;
      expect(groups.map((g) => g.name), ['Ahri', 'Vex']);
    });

    test('priceUpdatedAtProvider returns the latest timestamp', () async {
      final mockRepo = MockCardRepository();
      when(() => mockRepo.fetchAll()).thenAnswer((_) async => [
            buildCard(id: '1', priceUpdatedAt: DateTime.utc(2026, 1, 1)),
            buildCard(id: '2', priceUpdatedAt: DateTime.utc(2026, 6, 1)),
          ]);
      final c = await makeContainer(cardRepository: mockRepo);
      await c.read(catalogProvider.future);
      expect(c.read(priceUpdatedAtProvider), DateTime.utc(2026, 6, 1));
    });
  });
}
