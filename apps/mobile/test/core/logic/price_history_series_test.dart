import 'package:fabtrades/core/logic/price_history_series.dart';
import 'package:fabtrades/core/logic/pricing.dart';
import 'package:fabtrades/core/models/app_settings.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/fixtures.dart';

void main() {
  final today = DateTime(2026, 8, 16);
  // today − 29 days = 2026-07-18 (inclusive 30-day span).
  final windowStart = DateTime(2026, 7, 18);
  const tcg = Pricing(AppSettings());
  const cm = Pricing(AppSettings(source: PriceSource.cardmarket));

  PriceHistorySeries series(
    List snapshots, {
    PriceSource source = PriceSource.tcgplayer,
    bool isPro = false,
    PriceHistoryWindow window = PriceHistoryWindow.last30,
  }) =>
      PriceHistorySeries.fromSnapshots(
        snapshots: List.from(snapshots),
        source: source,
        isPro: isPro,
        window: window,
        now: today,
      );

  test('window start is today minus 29 calendar days', () {
    expect(PriceHistorySeries.windowStartFor(today), windowStart);
  });

  test('Low is tcgLow for TCGplayer, never Market/Mid/High', () {
    final s = series([
      buildPricePoint(
        capturedOn: DateTime(2026, 8, 1),
        tcgLow: 1.25,
        tcgMarket: 9.0,
      ),
      buildPricePoint(
        capturedOn: DateTime(2026, 8, 10),
        tcgLow: 1.50,
        tcgMarket: 9.0,
      ),
    ]);
    expect(s.points.map((p) => p.low), [1.25, 1.50]);
  });

  test('Low is cmLow for CardMarket, never tcgLow', () {
    final s = series([
      buildPricePoint(
        capturedOn: DateTime(2026, 8, 1),
        tcgLow: 4.0,
        cmLow: 2.0,
      ),
      buildPricePoint(
        capturedOn: DateTime(2026, 8, 10),
        tcgLow: 5.0,
        cmLow: 2.5,
      ),
    ], source: PriceSource.cardmarket);
    expect(s.points.map((p) => p.low), [2.0, 2.5]);
  });

  test('null Low is dropped, never coerced to 0', () {
    final s = series([
      buildPricePoint(capturedOn: DateTime(2026, 8, 1), tcgLow: 1.0),
      buildPricePoint(
        capturedOn: DateTime(2026, 8, 5),
        tcgLow: null,
        tcgMarket: 3.0,
      ),
      buildPricePoint(capturedOn: DateTime(2026, 8, 10), tcgLow: 2.0),
    ]);
    expect(s.points.map((p) => p.low), [1.0, 2.0]);
    expect(s.points.any((p) => p.low == 0.0), isFalse);
    expect(s.delta, 1.0);
  });

  test('a Market-only row is a gap, not an observation', () {
    final obs = PriceHistorySeries.observations(
      [
        buildPricePoint(
          capturedOn: DateTime(2026, 8, 5),
          tcgMarket: 4.0,
        ),
      ],
      PriceSource.tcgplayer,
    );
    expect(obs, isEmpty);
  });

  test('default window clips to last 30 calendar days, date-only', () {
    final s = series([
      buildPricePoint(capturedOn: DateTime(2026, 7, 17), tcgLow: 1.0),
      buildPricePoint(capturedOn: DateTime(2026, 7, 18), tcgLow: 2.0),
      buildPricePoint(capturedOn: DateTime(2026, 8, 16), tcgLow: 3.0),
    ]);
    expect(s.windowStart, windowStart);
    expect(s.points.map((p) => p.low), [2.0, 3.0]);
    expect(s.hasOlder, isTrue);
  });

  test('delta is last visible Low minus first visible Low', () {
    final s = series([
      buildPricePoint(capturedOn: DateTime(2026, 7, 1), tcgLow: 10.0),
      buildPricePoint(capturedOn: DateTime(2026, 8, 1), tcgLow: 1.0),
      buildPricePoint(capturedOn: DateTime(2026, 8, 16), tcgLow: 3.5),
    ]);
    expect(s.delta, 2.5);
    expect(s.changeLabel(tcg), 'Low up \$2.50');
    expect(
      series([
        buildPricePoint(capturedOn: DateTime(2026, 8, 1), tcgLow: 4.0),
        buildPricePoint(capturedOn: DateTime(2026, 8, 16), tcgLow: 3.0),
      ]).changeLabel(tcg),
      'Low down \$1.00',
    );
    expect(
      series([
        buildPricePoint(capturedOn: DateTime(2026, 8, 1), tcgLow: 2.0),
        buildPricePoint(capturedOn: DateTime(2026, 8, 16), tcgLow: 2.0),
      ]).changeLabel(tcg),
      'Low unchanged',
    );
  });

  test('full window includes older Lows and recomputes delta', () {
    final snaps = [
      buildPricePoint(capturedOn: DateTime(2026, 6, 1), tcgLow: 1.0),
      buildPricePoint(capturedOn: DateTime(2026, 8, 16), tcgLow: 4.0),
    ];
    final clipped = series(snaps);
    expect(clipped.chartable, isFalse);
    expect(clipped.hasOlder, isTrue);

    final full = series(snaps, isPro: true, window: PriceHistoryWindow.full);
    expect(full.points.map((p) => p.low), [1.0, 4.0]);
    expect(full.delta, 3.0);
    expect(full.changeLabel(tcg), 'Low up \$3.00');
  });

  test('Pro CTA chrome is free + hasOlder + chartable', () {
    final snaps = [
      buildPricePoint(capturedOn: DateTime(2026, 6, 1), tcgLow: 1.0),
      buildPricePoint(capturedOn: DateTime(2026, 8, 1), tcgLow: 2.0),
      buildPricePoint(capturedOn: DateTime(2026, 8, 16), tcgLow: 3.0),
    ];
    expect(series(snaps).showProCta, isTrue);
    expect(series(snaps).showSpanControl, isFalse);
    expect(series(snaps, isPro: true).showProCta, isFalse);
    expect(series(snaps, isPro: true).showSpanControl, isTrue);
  });

  test('no chrome when not chartable, even if older snapshots exist', () {
    final s = series([
      buildPricePoint(capturedOn: DateTime(2026, 6, 1), tcgLow: 1.0),
      buildPricePoint(capturedOn: DateTime(2026, 8, 16), tcgLow: 2.0),
    ]);
    expect(s.chartable, isFalse);
    expect(s.hasOlder, isTrue);
    expect(s.showProCta, isFalse);
    expect(s.showSpanControl, isFalse);
    expect(s.changeLabel(tcg), isNull);
  });

  test('no chrome when every snapshot fits in 30 days', () {
    final s = series([
      buildPricePoint(capturedOn: DateTime(2026, 8, 1), tcgLow: 1.0),
      buildPricePoint(capturedOn: DateTime(2026, 8, 16), tcgLow: 2.0),
    ], isPro: true);
    expect(s.hasOlder, isFalse);
    expect(s.showProCta, isFalse);
    expect(s.showSpanControl, isFalse);
  });

  test('CardMarket never falls back to tcgLow', () {
    final s = series([
      buildPricePoint(capturedOn: DateTime(2026, 8, 1), tcgLow: 1.0),
      buildPricePoint(capturedOn: DateTime(2026, 8, 16), tcgLow: 2.0),
    ], source: PriceSource.cardmarket);
    expect(s.points, isEmpty);
    expect(s.chartable, isFalse);
    expect(s.changeLabel(cm), isNull);
  });

  test('<2 usable Lows is not chartable', () {
    expect(series([]).chartable, isFalse);
    expect(
      series([
        buildPricePoint(capturedOn: DateTime(2026, 8, 16), tcgLow: 1.0),
      ]).chartable,
      isFalse,
    );
  });
}
