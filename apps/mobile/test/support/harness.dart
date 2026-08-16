import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fabtrades/core/data/card_repository.dart';
import 'package:fabtrades/core/models/account.dart';
import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/core/models/subscription_status.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/onboarding/onboarding_keys.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:showcaseview/showcaseview.dart';

import 'sync_stub.dart';

class MockCardRepository extends Mock implements CardRepository {}

class _ProSubscription extends SubscriptionNotifier {
  @override
  Future<SubscriptionStatus> build() async =>
      const SubscriptionStatus(isPro: true);
}

/// Pumps [child] inside a [MaterialApp] with a real (mock-backed) provider
/// scope so widgets that read providers work without touching Supabase.
///
/// The card catalog is served from [catalog] via a mocked [CardRepository];
/// SharedPreferences is initialized empty (or from [seed]).
///
/// Signed out by default. Pass [account] to render the signed-in variants;
/// either way [accountProvider] is overridden so nothing reaches Supabase Auth,
/// whose client does not exist under `flutter test`.
///
/// Also registers the home [ShowcaseView] scope so screens that wrap widgets in
/// coach marks can build outside [HomeShell].
Future<ProviderContainer> pumpApp(
  WidgetTester tester,
  Widget child, {
  List<CardModel> catalog = const [],
  Map<String, Object> seed = const {},
  Account? account,
  Map<String, List<PricePoint>> priceHistory = const {},
  Object? priceHistoryError,
  Future<List<PricePoint>> Function(String cardId)? onPriceHistory,
  bool isPro = false,
  List<Override> extraOverrides = const [],
}) async {
  SharedPreferences.setMockInitialValues(seed);
  final prefs = await SharedPreferences.getInstance();

  final mockRepo = MockCardRepository();
  when(() => mockRepo.fetchAll()).thenAnswer((_) async => catalog);
  when(() => mockRepo.priceHistory(any())).thenAnswer((inv) async {
    final id = inv.positionalArguments[0] as String;
    if (onPriceHistory != null) return onPriceHistory(id);
    if (priceHistoryError != null) throw priceHistoryError;
    return priceHistory[id] ?? const <PricePoint>[];
  });

  final container = ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      cardRepositoryProvider.overrideWithValue(mockRepo),
      accountProvider.overrideWith((ref) => Stream.value(account)),
      syncProvider.overrideWith(StubSyncNotifier.new),
      if (isPro) subscriptionProvider.overrideWith(_ProSubscription.new),
      ...extraOverrides,
    ],
  );
  addTearDown(container.dispose);

  ShowcaseView.register(scope: OnboardingKeys.homeScope, enableShowcase: false);
  addTearDown(() {
    try {
      ShowcaseView.getNamed(OnboardingKeys.homeScope).unregister();
    } catch (_) {}
  });

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(home: child),
    ),
  );
  return container;
}
