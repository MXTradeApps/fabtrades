import 'package:fabtrades/core/logic/trending_movers.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final map = <String, dynamic>{
    'direction': 'loser',
    'rank': 3,
    'direction_total': 57,
    'price_kind': 'market',
    'card_id': '123-Normal',
    'name': 'Usurp',
    'set_name': 'The Hunted',
    'finish': 'Normal',
    'image_url': null,
    'start_price': 8,
    'start_on': '2026-11-09',
    'latest_price': 6.5,
    'percent_change': -0.1875,
    'amount_change': -1.5,
    'history': [8, 7, 6.5],
  };

  test('parses a fab_trending_movers row', () {
    final row = TrendingMoverRow.fromMap(map);
    expect(row.isGainer, isFalse);
    expect(row.rank, 3);
    expect(row.directionTotal, 57);
    expect(row.priceKind, 'market');
    expect(row.startPrice, 8.0);
    expect(row.latestPrice, 6.5);
    expect(row.percentChange, -0.1875);
    expect(row.amountChange, -1.5);
  });

  test('rejects an unknown direction and a missing price', () {
    expect(
      () => TrendingMoverRow.fromMap({...map, 'direction': 'sideways'}),
      throwsFormatException,
    );
    expect(
      () => TrendingMoverRow.fromMap({...map, 'latest_price': null}),
      throwsFormatException,
    );
  });

  test('options default to the web page defaults and compare by value', () {
    const options = TrendingOptions();
    expect(options.days, 7);
    expect(options.sort, TrendingSort.percent);
    expect(options.minPrice, 0);
    expect(options.copyWith(days: 2), const TrendingOptions(days: 2));
    expect(trendingDayOptions, [2, 7, 30]);
    expect(trendingWindowLabel(7), 'this week');
    expect(trendingWindowLabel(2), 'in the last 2 days');
  });
}
