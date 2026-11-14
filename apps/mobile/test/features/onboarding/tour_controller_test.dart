import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/onboarding/onboarding_keys.dart';
import 'package:fabtrades/features/onboarding/tour_controller.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fixtures.dart';
import '../../support/harness.dart';

void main() {
  final catalog = [
    buildCard(id: 'a', name: 'Alpha', tcgMarket: 2, imageUrl: 'https://x/a'),
    buildCard(id: 'b', name: 'Beta', tcgMarket: 3, imageUrl: 'https://x/b'),
    buildCard(id: 'c', name: 'Gamma', tcgMarket: 4),
  ];

  Future<({ProviderContainer container, WidgetRef ref})> mount(
    WidgetTester tester, {
    List<CardModel>? cards,
  }) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final mockRepo = MockCardRepository();
    when(() => mockRepo.fetchAll()).thenAnswer((_) async => cards ?? catalog);

    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        cardRepositoryProvider.overrideWithValue(mockRepo),
        catalogProvider.overrideWith(() => _FixedCatalog(cards ?? catalog)),
      ],
    );
    addTearDown(container.dispose);

    late WidgetRef widgetRef;
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Consumer(
            builder: (context, ref, _) {
              widgetRef = ref;
              return const SizedBox.shrink();
            },
          ),
        ),
      ),
    );
    await container.read(catalogProvider.future);
    await tester.pump();
    return (container: container, ref: widgetRef);
  }

  testWidgets('seeds one card per side when draft is empty', (tester) async {
    final (:container, :ref) = await mount(tester);
    final tours = TourController(ref);

    final keys = tours.prepareTradeTour();

    expect(tours.tradeSeeded, isTrue);
    final draft = container.read(tradeDraftProvider);
    expect(draft.wantItems, hasLength(1));
    expect(draft.haveItems, hasLength(1));
    expect(draft.wantItems.single.card.id, isNot(draft.haveItems.single.card.id));
    expect(keys, contains(OnboardingKeys.tradeConfirm));
  });

  testWidgets('does not seed when the draft already has cards', (tester) async {
    final (:container, :ref) = await mount(tester);
    container
        .read(tradeDraftProvider.notifier)
        .addCard(TradeSide.have, catalog.first);
    final tours = TourController(ref);

    tours.prepareTradeTour();

    expect(tours.tradeSeeded, isFalse);
    expect(container.read(tradeDraftProvider).haveCount, 1);
    expect(container.read(tradeDraftProvider).wantCount, 0);
  });

  testWidgets('cleanupTradeSeed clears only when it seeded', (tester) async {
    final (:container, :ref) = await mount(tester);
    final tours = TourController(ref);
    tours.prepareTradeTour();
    expect(container.read(tradeDraftProvider).haveCount, greaterThan(0));

    tours.cleanupTradeSeed();
    expect(container.read(tradeDraftProvider).haveCount, 0);
    expect(container.read(tradeDraftProvider).wantCount, 0);
    expect(tours.tradeSeeded, isFalse);

    container
        .read(tradeDraftProvider.notifier)
        .addCard(TradeSide.have, catalog.first);
    tours.cleanupTradeSeed();
    expect(container.read(tradeDraftProvider).haveCount, 1);
  });

  testWidgets('skips Confirm key when draft stays empty (no catalog)',
      (tester) async {
    final (:container, :ref) = await mount(tester, cards: const []);
    final tours = TourController(ref);
    final keys = tours.prepareTradeTour();

    expect(tours.tradeSeeded, isFalse);
    expect(keys, isNot(contains(OnboardingKeys.tradeConfirm)));
    expect(container.read(tradeDraftProvider).haveCount, 0);
  });
}

class _FixedCatalog extends CatalogNotifier {
  _FixedCatalog(this._cards);
  final List<CardModel> _cards;

  @override
  Future<List<CardModel>> build() async => _cards;
}
