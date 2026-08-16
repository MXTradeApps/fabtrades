import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/trade/trade_screen.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

void main() {
  testWidgets('empty trade shows both add rows and an even balance',
      (tester) async {
    await pumpApp(tester, const TradeScreen());
    await tester.pump();

    expect(find.text('Add my cards'), findsOneWidget);
    expect(find.text('Add their cards'), findsOneWidget);
    expect(find.text('Even'), findsOneWidget);
    expect(find.text('Their 0 cards'), findsOneWidget);
    expect(find.text('My 0 cards'), findsOneWidget);
  });

  testWidgets('adding cards updates totals and the delta', (tester) async {
    final container = await pumpApp(tester, const TradeScreen());
    await tester.pump();

    container.read(tradeDraftProvider.notifier).addCard(
          TradeSide.want,
          buildCard(id: 'w', name: 'Their Card', tcgMarket: 10.0),
        );
    container.read(tradeDraftProvider.notifier).addCard(
          TradeSide.have,
          buildCard(id: 'h', name: 'My Card', tcgMarket: 4.0),
        );
    await tester.pump();

    expect(find.text('Their Card'), findsOneWidget);
    expect(find.text('My Card'), findsOneWidget);
    expect(find.text('Their 1 card'), findsOneWidget);
    expect(find.text('My 1 card'), findsOneWidget);
    // theirs 10 - mine 4 => +$6.00 in your favor
    expect(find.text('+\$6.00'), findsOneWidget);
  });

  testWidgets('clear action appears once the trade is non-empty',
      (tester) async {
    final container = await pumpApp(tester, const TradeScreen());
    await tester.pump();

    expect(find.byTooltip('Clear trade'), findsNothing);
    expect(find.text('Confirm Trade'), findsOneWidget);

    container.read(tradeDraftProvider.notifier).addCard(
          TradeSide.have,
          buildCard(id: 'h', tcgMarket: 1.0, tcgLow: 0.5),
        );
    await tester.pump();

    expect(find.text('Confirm Trade'), findsOneWidget);
    expect(find.byTooltip('Clear trade'), findsOneWidget);
    expect(find.text('Low \$0.50'), findsOneWidget);
  });

  testWidgets('totals show market and low for both sides', (tester) async {
    final container = await pumpApp(tester, const TradeScreen());
    await tester.pump();

    container.read(tradeDraftProvider.notifier).addCard(
          TradeSide.want,
          buildCard(id: 'w', name: 'Their Card', tcgMarket: 10.0, tcgLow: 8.0),
        );
    container.read(tradeDraftProvider.notifier).addCard(
          TradeSide.have,
          buildCard(id: 'h', name: 'My Card', tcgMarket: 4.0, tcgLow: 3.0),
        );
    await tester.pump();

    expect(find.text('\$10.00'), findsOneWidget);
    expect(find.text('\$4.00'), findsOneWidget);
    expect(find.text('Low \$8.00'), findsOneWidget);
    expect(find.text('Low \$3.00'), findsOneWidget);
    expect(find.text('+\$6.00'), findsOneWidget);
    expect(find.text('Low +\$5.00'), findsOneWidget);
  });

  testWidgets('Find Trade Filler is free and opens without a paywall',
      (tester) async {
    final container = await pumpApp(tester, const TradeScreen());
    await tester.pump();

    container.read(tradeDraftProvider.notifier).addCard(
          TradeSide.want,
          buildCard(id: 'w', name: 'Their Card', tcgMarket: 10.0),
        );
    container.read(tradeDraftProvider.notifier).addCard(
          TradeSide.have,
          buildCard(id: 'h', name: 'My Card', tcgMarket: 4.0),
        );
    await tester.pump();

    expect(find.text('Find Trade Filler'), findsOneWidget);
    expect(find.text('PRO'), findsNothing);

    await tester.tap(find.text('Find Trade Filler'));
    await tester.pumpAndSettle();

    expect(
      find.text('Your side needs \$6.00 more to balance.'),
      findsOneWidget,
    );
    expect(find.text('Subscriptions are unavailable in this build.'),
        findsNothing);
  });
}
