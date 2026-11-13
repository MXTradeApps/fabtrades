// Confirming, sharing and clearing a trade from the Trade tab.
//
// The binder math is covered by confirm_trade_test.dart. These drive the screen
// itself: the confirm sheet and its checkboxes, what is saved to history, what
// happens to the binder and the draft, and what the user is told.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/analytics/analytics.dart';
import 'package:fabtrades/core/data/review_prompt_repository.dart';
import 'package:fabtrades/core/data/trade_link_shortener.dart';
import 'package:fabtrades/core/logic/free_limits.dart';
import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/trade/trade_screen.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

class RecordingAnalytics extends Analytics {
  final events = <(String, Map<String, Object>?)>[];

  @override
  void capture(String event, [Map<String, Object>? properties]) =>
      events.add((event, properties));

  Map<String, Object>? propertiesOf(String event) =>
      events.lastWhere((e) => e.$1 == event).$2;

  bool saw(String event) => events.any((e) => e.$1 == event);
}

final mine = buildCard(id: 'mine', name: 'My Card', tcgMarket: 4.0);
final theirs = buildCard(id: 'theirs', name: 'Their Card', tcgMarket: 10.0);

int ownedCopies(ProviderContainer c, String cardId) => c
    .read(binderProvider)
    .where((e) => e.card.id == cardId && !e.isWanted)
    .fold(0, (sum, e) => sum + e.quantity);

int wantedCopies(ProviderContainer c, String cardId) => c
    .read(binderProvider)
    .where((e) => e.card.id == cardId && e.isWanted)
    .fold(0, (sum, e) => sum + e.quantity);

void main() {
  late RecordingAnalytics analytics;
  var reviewRequests = 0;

  /// Pumps the Trade tab with a draft of 2× [mine] for 1× [theirs] unless
  /// [have] / [want] say otherwise.
  Future<ProviderContainer> pumpTrade(
    WidgetTester tester, {
    List<(CardModel, int)>? have,
    List<(CardModel, int)>? want,
    List<Override> overrides = const [],
  }) async {
    analytics = RecordingAnalytics();
    reviewRequests = 0;
    final container = await pumpApp(
      tester,
      const TradeScreen(),
      extraOverrides: [
        analyticsProvider.overrideWithValue(analytics),
        // The store's rating sheet is a platform plugin; count requests instead.
        reviewPromptRepositoryProvider.overrideWith(
          (ref) => ReviewPromptRepository(
            ref.watch(sharedPreferencesProvider),
            isAvailable: () async => true,
            requestReview: () async => reviewRequests++,
          ),
        ),
        ...overrides,
      ],
    );
    await tester.pump();

    final draft = container.read(tradeDraftProvider.notifier);
    for (final (card, qty) in have ?? [(mine, 2)]) {
      draft.addCard(TradeSide.have, card, quantity: qty);
    }
    for (final (card, qty) in want ?? [(theirs, 1)]) {
      draft.addCard(TradeSide.want, card, quantity: qty);
    }
    await tester.pump();
    return container;
  }

  Future<void> openConfirmSheet(WidgetTester tester) async {
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Trade'));
    await tester.pumpAndSettle();
  }

  Future<void> tapConfirm(WidgetTester tester) async {
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm'));
    await tester.pumpAndSettle();
  }

  CheckboxListTile checkbox(WidgetTester tester, String label) =>
      tester.widget<CheckboxListTile>(
        find.widgetWithText(CheckboxListTile, label),
      );

  group('confirm sheet', () {
    testWidgets('Confirm Trade is disabled while the trade is empty',
        (tester) async {
      await pumpTrade(tester, have: [], want: []);

      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Confirm Trade'),
      );
      expect(button.onPressed, isNull);
    });

    testWidgets('summarises the trade with both binder options ticked',
        (tester) async {
      await pumpTrade(tester);
      await openConfirmSheet(tester);

      expect(find.text('Giving 2 cards · Receiving 1 card'), findsOneWidget);
      expect(checkbox(tester, 'Remove my 2 given cards from Binder').value,
          isTrue);
      expect(checkbox(tester, 'Add their 1 card to my Binder').value, isTrue);
      expect(find.text('Uncheck for deck-bound pulls'), findsOneWidget);
      expect(analytics.propertiesOf('trade_confirm_opened'), {
        'their_card_count': 1,
        'my_card_count': 2,
        'their_value': 10.0,
        'my_value': 8.0,
      });
    });

    testWidgets('a side with no cards has its option disabled', (tester) async {
      await pumpTrade(tester, want: []);
      await openConfirmSheet(tester);

      expect(find.text('Giving 2 cards · Receiving 0 cards'), findsOneWidget);
      expect(
          checkbox(tester, 'Add their 0 cards to my Binder').onChanged, isNull);
      expect(checkbox(tester, 'Remove my 2 given cards from Binder').onChanged,
          isNotNull);
    });

    testWidgets('Cancel changes nothing', (tester) async {
      final c = await pumpTrade(tester);
      c.read(binderProvider.notifier).add(mine, quantity: 3);
      await openConfirmSheet(tester);

      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();

      expect(c.read(tradeHistoryProvider), isEmpty);
      expect(c.read(tradeDraftProvider).haveCount, 2);
      expect(c.read(tradeDraftProvider).wantCount, 1);
      expect(ownedCopies(c, 'mine'), 3);
      expect(analytics.saw('trade_confirmed'), isFalse);
      expect(find.text('Trade confirmed'), findsNothing);
    });

    testWidgets('dismissing the sheet changes nothing', (tester) async {
      final c = await pumpTrade(tester);
      await openConfirmSheet(tester);

      // Tap the scrim above the sheet.
      await tester.tapAt(const Offset(20, 20));
      await tester.pumpAndSettle();

      expect(find.text('Giving 2 cards · Receiving 1 card'), findsNothing);
      expect(c.read(tradeHistoryProvider), isEmpty);
      expect(c.read(tradeDraftProvider).haveCount, 2);
    });
  });

  group('confirming', () {
    testWidgets('saves the trade to history and clears the draft',
        (tester) async {
      final c = await pumpTrade(tester);
      await openConfirmSheet(tester);
      await tapConfirm(tester);

      final saved = c.read(tradeHistoryProvider).single;
      expect(saved.haveItems.single.card.id, 'mine');
      expect(saved.haveItems.single.quantity, 2);
      expect(saved.haveItems.single.priceEach, 4.0);
      expect(saved.wantItems.single.card.id, 'theirs');
      expect(saved.wantItems.single.priceEach, 10.0);
      expect(saved.haveTotal, 8.0);
      expect(saved.wantTotal, 10.0);
      expect(saved.currencySymbol, r'$');
      expect(
          DateTime.now().difference(saved.createdAt).inMinutes.abs(), lessThan(1));

      final draft = c.read(tradeDraftProvider);
      expect(draft.haveItems, isEmpty);
      expect(draft.wantItems, isEmpty);

      expect(find.text('Trade confirmed'), findsOneWidget);
      expect(find.text('My Card'), findsNothing);
      expect(find.text('Even trade'), findsOneWidget);
    });

    testWidgets('the saved trade survives an app restart', (tester) async {
      final c = await pumpTrade(tester);
      await openConfirmSheet(tester);
      await tapConfirm(tester);

      final restarted = ProviderContainer(overrides: [
        sharedPreferencesProvider
            .overrideWithValue(c.read(sharedPreferencesProvider)),
      ]);
      addTearDown(restarted.dispose);

      final saved = restarted.read(tradeHistoryProvider).single;
      expect(saved.haveItems.single.card.name, 'My Card');
      expect(saved.wantItems.single.quantity, 1);
    });

    testWidgets('moves cards in the binder: given out, received in',
        (tester) async {
      final c = await pumpTrade(tester);
      final binder = c.read(binderProvider.notifier);
      binder.add(mine, quantity: 3);
      binder.add(theirs, quantity: 1, isWanted: true);

      await openConfirmSheet(tester);
      await tapConfirm(tester);

      expect(ownedCopies(c, 'mine'), 1);
      expect(ownedCopies(c, 'theirs'), 1);
      // It was on the Want List and has now arrived.
      expect(wantedCopies(c, 'theirs'), 0);
    });

    testWidgets('giving more copies than the binder holds stops at zero',
        (tester) async {
      final c = await pumpTrade(tester);
      c.read(binderProvider.notifier).add(mine, quantity: 1);

      await openConfirmSheet(tester);
      await tapConfirm(tester);

      expect(ownedCopies(c, 'mine'), 0);
      expect(c.read(tradeHistoryProvider).single.haveCount, 2);
    });

    testWidgets('unticking "remove given" keeps my copies', (tester) async {
      final c = await pumpTrade(tester);
      c.read(binderProvider.notifier).add(mine, quantity: 3);
      await openConfirmSheet(tester);

      await tester.tap(find.text('Remove my 2 given cards from Binder'));
      await tester.pump();
      expect(checkbox(tester, 'Remove my 2 given cards from Binder').value,
          isFalse);
      await tapConfirm(tester);

      expect(ownedCopies(c, 'mine'), 3);
      expect(ownedCopies(c, 'theirs'), 1);
      expect(c.read(tradeHistoryProvider), hasLength(1));
    });

    testWidgets('unticking "add received" keeps them out of the binder',
        (tester) async {
      final c = await pumpTrade(tester);
      c.read(binderProvider.notifier).add(mine, quantity: 3);
      await openConfirmSheet(tester);

      await tester.tap(find.text('Add their 1 card to my Binder'));
      await tester.pump();
      await tapConfirm(tester);

      expect(ownedCopies(c, 'theirs'), 0);
      expect(ownedCopies(c, 'mine'), 1);
    });

    testWidgets('with both unticked the trade is recorded and the binder kept',
        (tester) async {
      final c = await pumpTrade(tester);
      c.read(binderProvider.notifier).add(mine, quantity: 3);
      await openConfirmSheet(tester);

      await tester.tap(find.text('Remove my 2 given cards from Binder'));
      await tester.tap(find.text('Add their 1 card to my Binder'));
      await tester.pump();
      await tapConfirm(tester);

      expect(ownedCopies(c, 'mine'), 3);
      expect(ownedCopies(c, 'theirs'), 0);
      expect(c.read(tradeHistoryProvider), hasLength(1));
      expect(analytics.propertiesOf('trade_confirmed')!['binder_reconciled'],
          isFalse);
    });

    testWidgets('a one-sided trade confirms without touching the empty side',
        (tester) async {
      final c = await pumpTrade(tester, have: []);
      await openConfirmSheet(tester);
      expect(find.text('Giving 0 cards · Receiving 1 card'), findsOneWidget);
      await tapConfirm(tester);

      final saved = c.read(tradeHistoryProvider).single;
      expect(saved.haveItems, isEmpty);
      expect(saved.wantCount, 1);
      expect(ownedCopies(c, 'theirs'), 1);
    });

    testWidgets('reports the confirmed trade to analytics', (tester) async {
      await pumpTrade(tester);
      await openConfirmSheet(tester);
      await tapConfirm(tester);

      expect(analytics.propertiesOf('trade_confirmed'), {
        'their_card_count': 1,
        'my_card_count': 2,
        'their_value': 10.0,
        'my_value': 8.0,
        'cash_amount': 0.0,
        'value_diff': -2.0,
        'binder_reconciled': true,
        'price_source': 'tcgplayer',
      });
    });

    testWidgets('newest trade is listed first', (tester) async {
      final c = await pumpTrade(tester);
      await openConfirmSheet(tester);
      await tapConfirm(tester);

      // Let the "Trade confirmed" message leave; it sits over the button.
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      c
          .read(tradeDraftProvider.notifier)
          .addCard(TradeSide.have, theirs, quantity: 1);
      await tester.pump();
      await openConfirmSheet(tester);
      await tapConfirm(tester);

      final history = c.read(tradeHistoryProvider);
      expect(history, hasLength(2));
      expect(history.first.haveItems.single.card.id, 'theirs');
      expect(history.last.haveItems.single.card.id, 'mine');
    });

    testWidgets('on the free plan the oldest trade rolls off, and it says so',
        (tester) async {
      final c = await pumpTrade(
        tester,
        overrides: [isProProvider.overrideWithValue(false)],
      );
      final history = c.read(tradeHistoryProvider.notifier);
      for (var i = 0; i < FreeLimits.savedTrades; i++) {
        history.addTrade(Trade(
          id: 'old-$i',
          createdAt: DateTime.utc(2026, 1, 1 + i),
          haveItems: [TradeItem(card: mine, quantity: 1, priceEach: 1)],
        ));
      }

      await openConfirmSheet(tester);
      await tapConfirm(tester);

      expect(
        find.text('Trade confirmed. The free plan keeps your last '
            '${FreeLimits.savedTrades} trades.'),
        findsOneWidget,
      );
      final ids = c.read(tradeHistoryProvider).map((t) => t.id).toList();
      expect(ids, hasLength(FreeLimits.savedTrades));
      // Trades are stored newest first, so the one added first is the one lost.
      expect(ids, isNot(contains('old-0')));
    });

    testWidgets('counts toward the rating prompt without interrupting',
        (tester) async {
      final c = await pumpTrade(tester);
      await openConfirmSheet(tester);
      await tapConfirm(tester);

      final stored = c
          .read(sharedPreferencesProvider)
          .getString(ReviewPromptRepository.storageKey);
      expect(stored, isNotNull);
      // One trade is below the threshold, so nothing is asked yet.
      expect(reviewRequests, 0);
    });
  });

  group('sharing', () {
    late List<String> copied;

    setUp(() {
      copied = [];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') {
          copied.add((call.arguments as Map)['text'] as String);
        }
        return null;
      });
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null);
    });

    Override shortener(Future<String?> Function(Uri, String) post) =>
        tradeLinkShortenerProvider
            .overrideWithValue(TradeLinkShortener(post: post));

    testWidgets('is not offered for an empty trade', (tester) async {
      await pumpTrade(tester, have: [], want: []);
      expect(find.byKey(const Key('shareTrade')), findsNothing);
      expect(find.byTooltip('Clear trade'), findsNothing);
    });

    testWidgets('Copy link copies the short link', (tester) async {
      await pumpTrade(tester, overrides: [
        shortener((_, _) async => '{"url":"https://fabtrades.net/t/abc123"}'),
      ]);

      await tester.tap(find.byKey(const Key('shareTrade')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('copyTradeLink')));
      await tester.pumpAndSettle();

      expect(copied, ['https://fabtrades.net/t/abc123']);
      expect(find.text('Link copied'), findsOneWidget);
      expect(analytics.propertiesOf('trade_shared'), {
        'format': 'link',
        'their_card_count': 1,
        'my_card_count': 2,
        'value_diff': -2.0,
      });
    });

    testWidgets('falls back to the long link when the site cannot be reached',
        (tester) async {
      await pumpTrade(tester, overrides: [
        shortener((_, _) async => throw Exception('offline')),
      ]);

      await tester.tap(find.byKey(const Key('shareTrade')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('copyTradeLink')));
      await tester.pumpAndSettle();

      expect(copied.single, startsWith('https://fabtrades.net/?trade='));
      expect(find.text('Link copied'), findsOneWidget);
    });

    testWidgets('Copy for Discord copies the offer followed by the link',
        (tester) async {
      await pumpTrade(tester, overrides: [
        shortener((_, _) async => '{"url":"https://fabtrades.net/t/abc123"}'),
      ]);

      await tester.tap(find.byKey(const Key('shareTrade')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('copyTradeForDiscord')));
      await tester.pumpAndSettle();

      expect(copied.single, contains('My Card'));
      expect(copied.single, contains('Their Card'));
      expect(copied.single, endsWith('https://fabtrades.net/t/abc123'));
      expect(find.text('Trade copied. Paste it into Discord.'), findsOneWidget);
      expect(analytics.propertiesOf('trade_shared')!['format'], 'discord');
    });

    testWidgets('sharing leaves the draft and history alone', (tester) async {
      final c = await pumpTrade(tester, overrides: [
        shortener((_, _) async => null),
      ]);

      await tester.tap(find.byKey(const Key('shareTrade')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('copyTradeLink')));
      await tester.pumpAndSettle();

      expect(c.read(tradeDraftProvider).haveCount, 2);
      expect(c.read(tradeHistoryProvider), isEmpty);
    });
  });

  group('clearing', () {
    testWidgets('asks first, then empties both sides', (tester) async {
      final c = await pumpTrade(tester);

      await tester.tap(find.byTooltip('Clear trade'));
      await tester.pumpAndSettle();
      expect(find.text('Clear trade?'), findsOneWidget);
      expect(c.read(tradeDraftProvider).haveCount, 2);

      await tester.tap(find.widgetWithText(FilledButton, 'Clear'));
      await tester.pumpAndSettle();

      expect(c.read(tradeDraftProvider).haveItems, isEmpty);
      expect(c.read(tradeDraftProvider).wantItems, isEmpty);
      expect(c.read(tradeHistoryProvider), isEmpty);
      expect(find.text('My Card'), findsNothing);
    });

    testWidgets('Cancel keeps the trade', (tester) async {
      final c = await pumpTrade(tester);

      await tester.tap(find.byTooltip('Clear trade'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();

      expect(c.read(tradeDraftProvider).haveCount, 2);
      expect(find.text('My Card'), findsOneWidget);
    });
  });

  testWidgets('the history button opens Trade history', (tester) async {
    await pumpTrade(tester);

    await tester.tap(find.byTooltip('Trade history'));
    await tester.pumpAndSettle();

    expect(find.text('Trade history'), findsOneWidget);
    expect(find.text('No saved trades yet.'), findsOneWidget);
  });
}
