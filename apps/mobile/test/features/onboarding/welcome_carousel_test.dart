import 'dart:convert';

import 'package:fabtrades/app/app.dart';
import 'package:fabtrades/core/data/set_published_on.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';
import 'package:fabtrades/features/onboarding/tour_copy.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fixtures.dart';
import '../../support/harness.dart';

void main() {
  final catalog = [
    buildCard(id: 'vex', name: 'Vex - Apathetic', rarity: 'Rare', tcgMarket: 3.5),
  ];

  Future<ProviderContainer> launch(
    WidgetTester tester, {
    Map<String, Object> seed = const {},
  }) async {
    SharedPreferences.setMockInitialValues(seed);
    final prefs = await SharedPreferences.getInstance();
    final mockRepo = MockCardRepository();
    when(() => mockRepo.fetchAll()).thenAnswer((_) async => catalog);
    when(() => mockRepo.fetchSetPublishedOn())
        .thenAnswer((_) async => SetPublishedOnMap.empty);
    when(() => mockRepo.recentMovers(any())).thenAnswer((_) async => const []);
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
    return container;
  }

  testWidgets('shows welcome carousel on first launch', (tester) async {
    await launch(tester);
    expect(find.text(TourCopy.carousel1Title), findsOneWidget);
    expect(find.text('Browse'), findsNothing);
  });

  testWidgets('Maybe later dismisses carousel and reaches HomeShell',
      (tester) async {
    await launch(tester);

    // Page 1 → 2
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text(TourCopy.carousel2Title), findsOneWidget);

    // Page 2 → 3 (sign-in CTA)
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text(TourCopy.carouselSignIn), findsOneWidget);

    await tester.tap(find.text(TourCopy.carouselMaybeLater));
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsWidgets);
    expect(find.text(TourCopy.carousel1Title), findsNothing);
  });

  testWidgets('carousel is not shown again after welcome was seen',
      (tester) async {
    final seen = jsonEncode([OnboardingTourId.welcome]);
    await launch(tester, seed: {OnboardingRepository.storageKey: seen});

    expect(find.text(TourCopy.carousel1Title), findsNothing);
    expect(find.text('Home'), findsWidgets);
  });
}
