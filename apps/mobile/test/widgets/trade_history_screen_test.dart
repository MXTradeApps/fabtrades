// The Trade history screen: what a saved trade shows and deleting one.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';
import 'package:fabtrades/core/analytics/analytics.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/trade/trade_history_screen.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

/// Where TradeRepository keeps confirmed trades.
const savedTradesKey = 'saved_trades';

class RecordingAnalytics extends Analytics {
  final events = <(String, Map<String, Object>?)>[];

  @override
  void capture(String event, [Map<String, Object>? properties]) =>
      events.add((event, properties));

  Map<String, Object>? propertiesOf(String event) =>
      events.lastWhere((e) => e.$1 == event).$2;
}

final mine = buildCard(id: 'mine', name: 'My Card', tcgMarket: 4.0);
final theirs = buildCard(
  id: 'theirs',
  name: 'Their Card',
  subTypeName: 'Rainbow Foil',
  isFoil: true,
  tcgMarket: 10.0,
);

Trade trade({
  String id = 't1',
  DateTime? createdAt,
  List<TradeItem>? have,
  List<TradeItem>? want,
  double haveCash = 0,
  double wantCash = 0,
  String notes = '',
  String currencySymbol = r'$',
}) =>
    Trade(
      id: id,
      createdAt: createdAt ?? DateTime(2026, 3, 9, 14, 30),
      notes: notes,
      haveItems: have ?? [TradeItem(card: mine, quantity: 2, priceEach: 4.0)],
      wantItems:
          want ?? [TradeItem(card: theirs, quantity: 1, priceEach: 10.0)],
      haveCash: haveCash,
      wantCash: wantCash,
      currencySymbol: currencySymbol,
    );

void main() {
  late RecordingAnalytics analytics;

  Future<ProviderContainer> pumpHistory(
    WidgetTester tester,
    List<Trade> trades,
  ) async {
    analytics = RecordingAnalytics();
    // A tall surface so every card in the list is built, not just the first.
    tester.view.physicalSize = const Size(1200, 4000);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    final container = await pumpApp(
      tester,
      const TradeHistoryScreen(),
      seed: {
        savedTradesKey: jsonEncode([for (final t in trades) t.toJson()]),
      },
      extraOverrides: [analyticsProvider.overrideWithValue(analytics)],
    );
    await tester.pump();
    return container;
  }

  testWidgets('an empty history says so', (tester) async {
    await pumpHistory(tester, []);

    expect(find.text('No saved trades yet.'), findsOneWidget);
    expect(analytics.propertiesOf('trade_history_viewed'), {'trade_count': 0});
  });

  testWidgets('a trade shows its date, both sides, lines and totals',
      (tester) async {
    final saved = trade();
    await pumpHistory(tester, [saved]);

    expect(find.text(DateFormat.yMMMd().add_jm().format(saved.createdAt)),
        findsOneWidget);
    // Side summaries.
    expect(find.text(r'$8.00'), findsNWidgets(2)); // summary and line total
    expect(find.text('2 cards'), findsOneWidget);
    expect(find.text(r'$10.00'), findsNWidgets(2));
    expect(find.text('1 cards'), findsOneWidget);
    // Lines.
    expect(find.text('My Card'), findsOneWidget);
    expect(find.text(r'×2 · $4.00 ea'), findsOneWidget);
    expect(find.text('Their Card'), findsOneWidget);
    expect(find.text(r'×1 · $10.00 ea'), findsOneWidget);
    expect(analytics.propertiesOf('trade_history_viewed'), {'trade_count': 1});
  });

  testWidgets('says who came out ahead', (tester) async {
    await pumpHistory(tester, [
      trade(id: 'gained'), // gave 8, got 10
      trade(
        id: 'gave-more',
        want: [TradeItem(card: theirs, quantity: 1, priceEach: 3.0)],
      ), // gave 8, got 3
      trade(
        id: 'even',
        want: [TradeItem(card: theirs, quantity: 1, priceEach: 8.0)],
      ),
    ]);

    expect(find.text(r'Gained $2.00'), findsOneWidget);
    expect(find.text(r'Gave $5.00 more'), findsOneWidget);
    expect(find.text('Even trade'), findsOneWidget);
  });

  testWidgets('a difference under a cent counts as even', (tester) async {
    await pumpHistory(tester, [
      trade(want: [TradeItem(card: theirs, quantity: 1, priceEach: 8.004)]),
    ]);

    expect(find.text('Even trade'), findsOneWidget);
  });

  testWidgets('shows cash, notes and the saved currency', (tester) async {
    await pumpHistory(tester, [
      trade(
        haveCash: 5,
        notes: 'Met at the armory',
        currencySymbol: '€',
      ),
    ]);

    expect(find.text('Met at the armory'), findsOneWidget);
    expect(find.text('Cash'), findsOneWidget);
    expect(find.text('€5.00'), findsOneWidget);
    // Cash counts toward the side total: 8 in cards + 5.
    expect(find.text('€13.00'), findsOneWidget);
    expect(find.text('Gave €3.00 more'), findsOneWidget);
    expect(find.textContaining(r'$'), findsNothing);
  });

  testWidgets('a cash-only side still gets its section', (tester) async {
    await pumpHistory(tester, [trade(want: [], wantCash: 8)]);

    expect(find.text('Got'), findsNWidgets(2)); // summary + section label
    expect(find.text('Cash'), findsOneWidget);
    expect(find.text('Even trade'), findsOneWidget);
  });

  testWidgets('a one-sided trade has no empty section', (tester) async {
    await pumpHistory(tester, [trade(want: [])]);

    expect(find.text('Gave'), findsNWidgets(2));
    expect(find.text('Got'), findsOneWidget); // the summary only
    expect(find.text('0 cards'), findsOneWidget);
    expect(find.text(r'Gave $8.00 more'), findsOneWidget);
  });

  testWidgets('lists trades in saved order, newest first', (tester) async {
    await pumpHistory(tester, [
      trade(id: 'new', notes: 'newer', createdAt: DateTime(2026, 5, 2, 9)),
      trade(id: 'old', notes: 'older', createdAt: DateTime(2026, 5, 1, 9)),
    ]);

    final newer = tester.getTopLeft(find.text('newer')).dy;
    final older = tester.getTopLeft(find.text('older')).dy;
    expect(newer, lessThan(older));
  });

  testWidgets('deleting removes only that trade, and it stays removed',
      (tester) async {
    final c = await pumpHistory(tester, [
      trade(id: 'keep', notes: 'keep me'),
      trade(id: 'drop', notes: 'drop me'),
    ]);

    final dropCard = find.ancestor(
      of: find.text('drop me'),
      matching: find.byType(Card),
    );
    await tester.tap(find.descendant(
      of: dropCard,
      matching: find.byIcon(Icons.delete_outline),
    ));
    await tester.pump();

    expect(find.text('drop me'), findsNothing);
    expect(find.text('keep me'), findsOneWidget);
    expect(c.read(tradeHistoryProvider).map((t) => t.id), ['keep']);
    expect(analytics.propertiesOf('trade_deleted'), {
      'their_card_count': 1,
      'my_card_count': 2,
    });

    final restarted = ProviderContainer(overrides: [
      sharedPreferencesProvider
          .overrideWithValue(c.read(sharedPreferencesProvider)),
    ]);
    addTearDown(restarted.dispose);
    expect(restarted.read(tradeHistoryProvider).map((t) => t.id), ['keep']);
  });

  testWidgets('deleting the last trade shows the empty state', (tester) async {
    await pumpHistory(tester, [trade()]);

    await tester.tap(find.byIcon(Icons.delete_outline));
    await tester.pump();

    expect(find.text('No saved trades yet.'), findsOneWidget);
  });

  testWidgets('deleting a trade leaves the binder alone', (tester) async {
    final c = await pumpHistory(tester, [trade()]);
    c.read(binderProvider.notifier).add(theirs, quantity: 1);

    await tester.tap(find.byIcon(Icons.delete_outline));
    await tester.pump();

    expect(c.read(binderProvider).single.card.id, 'theirs');
  });

  testWidgets('unreadable saved data opens as an empty history',
      (tester) async {
    analytics = RecordingAnalytics();
    await pumpApp(
      tester,
      const TradeHistoryScreen(),
      seed: {savedTradesKey: '{not json'},
      extraOverrides: [analyticsProvider.overrideWithValue(analytics)],
    );
    await tester.pump();

    expect(find.text('No saved trades yet.'), findsOneWidget);
  });
}
