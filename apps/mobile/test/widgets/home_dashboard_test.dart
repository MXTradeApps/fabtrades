import 'package:fabtrades/core/logic/recent_movers.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/models/binder_entry.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/search/home_dashboard.dart';
import 'package:fabtrades/features/search/search_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

RecentLowChange change(
  String cardId, {
  double startLow = 10,
  double latestLow = 12,
}) => RecentLowChange(
  cardId: cardId,
  startOn: '2026-10-11',
  startLow: startLow,
  latestLow: latestLow,
  percentChange: (latestLow - startLow) / startLow,
  amountChange: latestLow - startLow,
);

BinderEntry owned(String id, {int qty = 1, DateTime? at, String? binder}) =>
    BinderEntry(
      card: buildCard(id: id, name: 'Card $id', tcgMarket: 10, tcgLow: 9),
      quantity: qty,
      addedAt: at ?? DateTime(2026, 10, 1),
      binderId: binder ?? BinderIds.trade,
    );

void main() {
  group('collection math', () {
    test('recent change is weighted by copies and skips unowned', () {
      final copies = {'a': 2, 'b': 1};
      final result = collectionRecentChange([
        change('a', startLow: 10, latestLow: 12), // +2 × 2
        change('b', startLow: 20, latestLow: 18), // −2 × 1
        change('x', startLow: 5, latestLow: 50), // not owned
      ], copies)!;
      expect(result.amount, closeTo(2, 1e-9));
      expect(result.percent, closeTo(2 / 40, 1e-9));
    });

    test('no owned changes means no change line', () {
      expect(collectionRecentChange([change('x')], {'a': 1}), isNull);
    });

    test('movers rank by total change and drop penny cards', () {
      final copies = {'a': 1, 'b': 5, 'c': 1, 'penny': 10};
      final rows = collectionMovers([
        change('a', startLow: 10, latestLow: 13), // 3
        change('b', startLow: 2, latestLow: 3), // 1 × 5 = 5
        change('c', startLow: 10, latestLow: 9), // −1
        change('penny', startLow: 0.2, latestLow: 0.9),
      ], copies);
      expect(rows.map((r) => r.cardId), ['b', 'a', 'c']);
    });

    test('recently added is newest first, one per printing, owned only', () {
      final rows = recentlyAdded([
        owned('old', at: DateTime(2026, 9, 1)),
        owned('new', at: DateTime(2026, 10, 10)),
        owned('new', at: DateTime(2026, 10, 9), binder: BinderIds.collection),
        BinderEntry(
          card: buildCard(id: 'want'),
          isWanted: true,
          addedAt: DateTime(2026, 10, 12),
        ),
      ]);
      expect(rows.map((e) => e.card.id), ['new', 'old']);
    });
  });

  testWidgets('empty collection shows a start prompt', (tester) async {
    await pumpApp(tester, const BrowseScreen());
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('homeStartCollection')), findsOneWidget);
    expect(find.byKey(const Key('homeCollectionSummary')), findsNothing);
    expect(find.byKey(const Key('seeTrending')), findsOneWidget);
  });

  testWidgets('owned cards show value, weekly change, movers and recents', (
    tester,
  ) async {
    final container = await pumpApp(
      tester,
      const BrowseScreen(),
      printingRecentChanges: [change('alpha', startLow: 10, latestLow: 14)],
    );
    container
        .read(binderProvider.notifier)
        .add(
          buildCard(id: 'alpha', name: 'Alpha', tcgMarket: 15, tcgLow: 14),
          quantity: 2,
          binderId: BinderIds.trade,
        );
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('homeCollectionSummary')), findsOneWidget);
    expect(
      tester.widget<Text>(find.byKey(const Key('homeCollectionValue'))).data,
      '\$30.00',
    );
    expect(find.text('2 cards · 2 binders'), findsOneWidget);
    expect(find.byKey(const Key('homeCollectionChange')), findsOneWidget);
    expect(find.textContaining('+\$8.00 (+40%) this week'), findsOneWidget);
    expect(find.byKey(const Key('homeOwnedMover-alpha')), findsOneWidget);
    expect(find.byKey(const Key('homeRecent-alpha')), findsOneWidget);
  });

  testWidgets('summary asks the shell to open the Binder tab', (tester) async {
    final container = await pumpApp(tester, const BrowseScreen());
    container
        .read(binderProvider.notifier)
        .add(
          buildCard(id: 'alpha', name: 'Alpha', tcgMarket: 15),
          binderId: BinderIds.trade,
        );
    container.read(openBinderIdProvider.notifier).open(BinderIds.trade);
    await tester.pump();
    await tester.pumpAndSettle();

    final requests = <int?>[];
    container.listen<int?>(shellTabProvider, (_, next) => requests.add(next));
    await tester.tap(find.byKey(const Key('homeCollectionSummary')));
    await tester.pump();

    expect(requests, contains(binderTabIndex));
    expect(container.read(openBinderIdProvider), isNull);
  });
}
