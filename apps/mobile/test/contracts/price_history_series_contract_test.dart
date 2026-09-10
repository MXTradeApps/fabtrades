// Contract tests for Low-series price-history math.
//
// These assert the shared fixtures in packages/contracts, which the JavaScript
// implementation in apps/web is held to as well. Overlay chrome is out of
// scope. See packages/contracts/README.md.
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/logic/price_history_series.dart';
import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/models/card_model.dart';

import 'contract_fixtures.dart';

void main() {
  final contract = loadContract('price_history_series');
  final now = _parseDay(contract['now'] as String);

  test('window start is today minus 29 calendar days', () {
    expect(
      _fmt(PriceHistorySeries.windowStartFor(now)),
      contract['windowStart'],
    );
  });

  for (final c in contractCases(contract, 'cases')) {
    test(c['name'] as String, () {
      final source = (c['source'] as String) == 'cardmarket'
          ? PriceSource.cardmarket
          : PriceSource.tcgplayer;
      final window = (c['window'] as String) == 'full'
          ? PriceHistoryWindow.full
          : PriceHistoryWindow.last30;
      final snapshots = (c['snapshots'] as List)
          .map((e) => _point(Map<String, dynamic>.from(e as Map)))
          .toList();
      final series = PriceHistorySeries.fromSnapshots(
        snapshots: snapshots,
        source: source,
        isPro: false,
        window: window,
        now: now,
      );
      final expected = Map<String, dynamic>.from(c['expected'] as Map);
      final wantPoints = expected['points'] as List;
      expect(series.points.length, wantPoints.length);
      for (var i = 0; i < wantPoints.length; i++) {
        final want = Map<String, dynamic>.from(wantPoints[i] as Map);
        expect(_fmt(series.points[i].date), want['date']);
        expect(series.points[i].low, (want['low'] as num).toDouble());
      }
      expect(series.hasOlder, expected['hasOlder']);
      expect(series.chartable, expected['chartable']);
      if (expected['delta'] == null) {
        expect(series.delta, isNull);
      } else {
        expect(series.delta, (expected['delta'] as num).toDouble());
      }
    });
  }

  test('never coerces a null Low to 0', () {
    final gap = contractCases(contract, 'cases')
        .firstWhere((c) => (c['name'] as String).contains('null Low'));
    expect(
      (gap['snapshots'] as List)
          .any((s) => (s as Map)['tcg_low'] == null),
      isTrue,
    );
    final series = PriceHistorySeries.fromSnapshots(
      snapshots: (gap['snapshots'] as List)
          .map((e) => _point(Map<String, dynamic>.from(e as Map)))
          .toList(),
      source: PriceSource.tcgplayer,
      isPro: false,
      now: now,
    );
    expect(series.points.any((p) => p.low == 0.0), isFalse);
  });
}

DateTime _parseDay(String s) {
  final parts = s.split('-');
  return DateTime(
    int.parse(parts[0]),
    int.parse(parts[1]),
    int.parse(parts[2]),
  );
}

String _fmt(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

PricePoint _point(Map<String, dynamic> snap) {
  return PricePoint(
    capturedOn: _parseDay(snap['captured_on'] as String),
    tcgLow: (snap['tcg_low'] as num?)?.toDouble(),
    tcgMarket: (snap['tcg_market'] as num?)?.toDouble(),
    cmLow: (snap['cm_low'] as num?)?.toDouble(),
    cmTrend: (snap['cm_trend'] as num?)?.toDouble(),
  );
}
