import '../models/app_settings.dart';
import '../models/card_model.dart';
import 'pricing.dart';

/// Visible window for the Low chart. Everyone defaults to [last30]; Pro may
/// opt in to [full] for one visit.
enum PriceHistoryWindow { last30, full }

/// One observed Low for the selected marketplace on a calendar day.
class LowObservation {
  const LowObservation({required this.date, required this.low});

  /// Date-only (`year/month/day`); time-of-day is ignored.
  final DateTime date;
  final double low;
}

/// Derived Low series for the history chart. [PricePoint] stays the snapshot;
/// this type names observed Low vs the clipped window vs the change summary.
class PriceHistorySeries {
  const PriceHistorySeries({
    required this.window,
    required this.windowStart,
    required this.points,
    required this.hasOlder,
    required this.isPro,
  });

  final PriceHistoryWindow window;
  final DateTime windowStart;
  final List<LowObservation> points;
  final bool hasOlder;
  final bool isPro;

  bool get chartable => points.length >= 2;

  /// Last visible Low minus first visible Low. Null when not [chartable].
  double? get delta =>
      chartable ? points.last.low - points.first.low : null;

  bool get showProCta => !isPro && hasOlder && chartable;

  bool get showSpanControl => isPro && hasOlder && chartable;

  String? changeLabel(Pricing pricing) {
    final d = delta;
    if (d == null) return null;
    if (d == 0) return 'Low unchanged';
    final amount = pricing.formatValue(d.abs());
    return d > 0 ? 'Low up $amount' : 'Low down $amount';
  }

  static DateTime dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  /// Inclusive start of the 30-calendar-day window (today minus 29 days).
  static DateTime windowStartFor(DateTime now) =>
      dateOnly(now).subtract(const Duration(days: 29));

  static double? _lowFor(PricePoint snap, PriceSource source) {
    switch (source) {
      case PriceSource.tcgplayer:
        return snap.tcgLow;
      case PriceSource.cardmarket:
        return snap.cmLow;
    }
  }

  static List<LowObservation> observations(
    List<PricePoint> snapshots,
    PriceSource source,
  ) {
    final out = <LowObservation>[];
    for (final snap in snapshots) {
      final low = _lowFor(snap, source);
      if (low == null) continue;
      out.add(LowObservation(date: dateOnly(snap.capturedOn), low: low));
    }
    return out;
  }

  factory PriceHistorySeries.fromSnapshots({
    required List<PricePoint> snapshots,
    required PriceSource source,
    required bool isPro,
    PriceHistoryWindow window = PriceHistoryWindow.last30,
    DateTime? now,
  }) {
    final today = now ?? DateTime.now();
    final windowStart = windowStartFor(today);
    final all = observations(snapshots, source);
    final hasOlder = all.any((o) => o.date.isBefore(windowStart));
    final points = window == PriceHistoryWindow.full
        ? all
        : all.where((o) => !o.date.isBefore(windowStart)).toList();
    return PriceHistorySeries(
      window: window,
      windowStart: windowStart,
      points: points,
      hasOlder: hasOlder,
      isPro: isPro,
    );
  }
}
