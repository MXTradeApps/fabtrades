import 'package:fabtrades/core/logic/trending_movers.dart';
import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/search/trends_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../support/harness.dart';

TrendingMoverRow row(String name, {String direction = 'gainer'}) =>
    TrendingMoverRow(
      direction: direction,
      rank: 1,
      directionTotal: 42,
      priceKind: direction == 'gainer' ? 'low' : 'market',
      cardId: name,
      name: name,
      setName: 'The Hunted',
      finish: 'Normal',
      startPrice: 4,
      startOn: '2026-11-09',
      latestPrice: 6,
      percentChange: direction == 'gainer' ? 0.5 : -0.5,
      amountChange: direction == 'gainer' ? 2 : -2,
    );

void main() {
  /// Answers with one row named after the request, and records each request.
  Future<List<({String source, TrendingOptions options})>> pumpTrends(
    WidgetTester tester, {
    Map<String, Object> seed = const {},
  }) async {
    final calls = <({String source, TrendingOptions options})>[];
    await pumpApp(
      tester,
      const TrendsScreen(),
      seed: seed,
      onTrendingMovers: (source, options) async {
        calls.add((source: source, options: options));
        return [
          row('$source ${options.days}d ${options.sort.param} '
              '${options.minPrice}+'),
        ];
      },
    );
    await tester.pumpAndSettle();
    return calls;
  }

  testWidgets('opens on 7 days, by percent, any price', (tester) async {
    final calls = await pumpTrends(tester);

    expect(calls, hasLength(1));
    expect(calls.single.source, 'tcgplayer');
    expect(calls.single.options, const TrendingOptions());
    expect(find.text('tcgplayer 7d percent 0+'), findsOneWidget);
    for (final label in [
      '2 days',
      '7 days',
      '30 days',
      'By %',
      'By \$',
      'Any price',
      '\$2+',
      '\$10+',
      '\$50+',
    ]) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.textContaining('Top 1 of 42 rising this week, by Low'),
        findsOneWidget);
  });

  testWidgets('each option refetches with that option', (tester) async {
    final calls = await pumpTrends(tester);

    await tester.tap(find.text('2 days'));
    await tester.pumpAndSettle();
    expect(calls.last.options, const TrendingOptions(days: 2));
    expect(find.text('tcgplayer 2d percent 0+'), findsOneWidget);
    expect(find.textContaining('in the last 2 days'), findsOneWidget);

    await tester.tap(find.text('By \$'));
    await tester.pumpAndSettle();
    expect(
      calls.last.options,
      const TrendingOptions(days: 2, sort: TrendingSort.amount),
    );

    await tester.tap(find.text('\$10+'));
    await tester.pumpAndSettle();
    expect(
      calls.last.options,
      const TrendingOptions(days: 2, sort: TrendingSort.amount, minPrice: 10),
    );
    expect(find.text('tcgplayer 2d amount 10+'), findsOneWidget);
    expect(calls, hasLength(4));
  });

  testWidgets('going back to an option already loaded does not refetch',
      (tester) async {
    final calls = await pumpTrends(tester);

    await tester.tap(find.text('30 days'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('7 days'));
    await tester.pumpAndSettle();

    expect(calls, hasLength(2));
    expect(find.text('tcgplayer 7d percent 0+'), findsOneWidget);
  });

  testWidgets('pull to refresh keeps the chosen options and refetches',
      (tester) async {
    final calls = await pumpTrends(tester);
    await tester.tap(find.text('30 days'));
    await tester.pumpAndSettle();

    await tester.fling(find.byType(ListView), const Offset(0, 400), 1000);
    await tester.pumpAndSettle();

    expect(calls.last.options, const TrendingOptions(days: 30));
    expect(calls, hasLength(3));
    expect(find.text('tcgplayer 30d percent 0+'), findsOneWidget);
  });

  testWidgets('CardMarket labels use euros and Trend', (tester) async {
    final calls = <String>[];
    final container = await pumpApp(
      tester,
      const TrendsScreen(),
      onTrendingMovers: (source, options) async {
        calls.add(source);
        return [row('faller', direction: 'loser')];
      },
    );
    await tester.pumpAndSettle();
    container.read(settingsProvider.notifier).setSource(PriceSource.cardmarket);
    await tester.pumpAndSettle();

    expect(calls, ['tcgplayer', 'cardmarket']);
    expect(find.text('By €'), findsOneWidget);
    expect(find.text('2 €+'), findsOneWidget);
    await tester.tap(find.text('Falling'));
    await tester.pumpAndSettle();
    expect(find.textContaining('falling this week, by Trend'), findsOneWidget);
    expect(find.byKey(const Key('trendRow-loser-faller')), findsOneWidget);
  });

  testWidgets('a failed load can be retried', (tester) async {
    var fail = true;
    await pumpApp(
      tester,
      const TrendsScreen(),
      onTrendingMovers: (source, options) async {
        if (fail) throw Exception('offline');
        return [row('Back online')];
      },
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Couldn’t load trending cards'), findsOneWidget);

    fail = false;
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Back online'), findsOneWidget);
  });

  testWidgets('controls and rows fit a narrow phone', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await pumpApp(
      tester,
      const TrendsScreen(),
      onTrendingMovers: (source, options) async => [
        row('Leave No Witnesses, Extended Art Cold Foil Marvel Printing'),
      ],
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('\$50+'), findsOneWidget);
  });
}
