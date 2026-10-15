import 'package:fabtrades/core/logic/review_prompt.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final t0 = DateTime.utc(2026, 1, 1);
  final later = t0.add(const Duration(days: 2));

  bool should(ReviewPromptState s,
          {DateTime? now, bool tradeInProgress = false}) =>
      ReviewPromptPolicy.shouldPrompt(s,
          now: now ?? later, tradeInProgress: tradeInProgress);

  ReviewPromptState trades(int n, {DateTime? at}) {
    var s = const ReviewPromptState();
    for (var i = 0; i < n; i++) {
      s = s.withTradeConfirmed(at ?? t0);
    }
    return s;
  }

  ReviewPromptState scans(int n, {DateTime? at}) {
    var s = const ReviewPromptState();
    for (var i = 0; i < n; i++) {
      s = s.withScanMatch(at ?? t0);
    }
    return s;
  }

  group('ReviewPromptPolicy.shouldPrompt', () {
    test('fires on the 3rd confirmed trade, not before', () {
      expect(should(trades(2)), isFalse);
      expect(should(trades(3)), isTrue);
    });

    test('fires on the 2nd scan match, not the 1st', () {
      expect(should(scans(1)), isFalse);
      expect(should(scans(2)), isTrue);
    });

    test('never with nothing recorded', () {
      expect(should(const ReviewPromptState()), isFalse);
    });

    test('never in the first day after the first moment', () {
      // Three trades in one session at a first event: no prompt that day.
      final s = trades(3);
      expect(should(s, now: t0.add(const Duration(hours: 23))), isFalse);
      expect(should(s, now: t0.add(const Duration(hours: 24))), isTrue);
    });

    test('never while a trade is in progress', () {
      expect(should(scans(5), tradeInProgress: true), isFalse);
    });

    test('quiet for a day after an error', () {
      final s = trades(3).withError(later.subtract(const Duration(hours: 2)));
      expect(should(s), isFalse);
      expect(should(s, now: later.add(const Duration(days: 1))), isTrue);
    });

    test('respects the 60-day cooldown and needs fresh moments after', () {
      final prompted = trades(3).withPrompted(later);
      expect(prompted.confirmedTrades, 0);
      expect(prompted.scanMatches, 0);

      var s = prompted;
      for (var i = 0; i < 3; i++) {
        s = s.withTradeConfirmed(later);
      }
      expect(should(s, now: later.add(const Duration(days: 59))), isFalse);
      expect(should(s, now: later.add(const Duration(days: 60))), isTrue);

      // Cooldown over but no new positive moments yet.
      expect(should(prompted, now: later.add(const Duration(days: 90))),
          isFalse);
    });
  });

  group('ReviewPromptState', () {
    test('firstSeenAt is set once, by the earliest moment', () {
      final s = const ReviewPromptState()
          .withScanMatch(t0)
          .withTradeConfirmed(later);
      expect(s.firstSeenAt, t0);
    });

    test('round-trips through JSON', () {
      final s = trades(2)
          .withScanMatch(t0)
          .withError(later)
          .withPrompted(later)
          .withTradeConfirmed(later);
      final back = ReviewPromptState.fromJson(s.toJson());
      expect(back.firstSeenAt, s.firstSeenAt);
      expect(back.confirmedTrades, 1);
      expect(back.scanMatches, 0);
      expect(back.lastPromptAt, later);
      expect(back.lastErrorAt, later);
    });

    test('malformed fields read as fresh', () {
      final s = ReviewPromptState.fromJson({
        'firstSeenAt': 42,
        'confirmedTrades': 'three',
        'scanMatches': -4,
        'lastPromptAt': 'not a date',
      });
      expect(s.firstSeenAt, isNull);
      expect(s.confirmedTrades, 0);
      expect(s.scanMatches, 0);
      expect(s.lastPromptAt, isNull);
    });
  });
}
