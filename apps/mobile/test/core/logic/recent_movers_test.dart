import 'package:fabtrades/core/logic/recent_movers.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/models/binder_entry.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/fixtures.dart';

void main() {
  group('startLowWindow', () {
    test('is today minus 5 through today minus 3 inclusive', () {
      final window = startLowWindow('2026-08-26');
      expect(window.from, '2026-08-21');
      expect(window.to, '2026-08-23');
    });
  });

  group('rankRecentMovers helper-level', () {
    test('distinguishes start Low from latest Low from derived percent', () {
      final ranked = rankRecentMovers(
        today: '2026-08-26',
        source: 'tcgplayer',
        snapshotsByCard: {
          'card-a': [
            {'captured_on': '2026-08-23', 'tcg_low': 2.0, 'cm_low': 9.0},
          ],
        },
        currentLows: {
          'card-a': {'tcg_low': 5.0, 'cm_low': 9.0, 'is_sealed': false},
        },
      );
      final row = ranked.gainers.single;
      expect(row.startLow, 2.0);
      expect(row.latestLow, 5.0);
      expect(row.percentChange, 1.5);
      expect(row.amountChange, 3.0);
    });

    test('omits implausible Lows and 1000%+ spikes', () {
      final ranked = rankRecentMovers(
        today: '2026-08-26',
        source: 'tcgplayer',
        snapshotsByCard: {
          'bogus': [
            {'captured_on': '2026-08-23', 'tcg_low': 2.0},
          ],
          'spike': [
            {'captured_on': '2026-08-23', 'tcg_low': 1.0},
          ],
          'ok': [
            {'captured_on': '2026-08-23', 'tcg_low': 2.0},
          ],
        },
        currentLows: {
          'bogus': {'tcg_low': 150000.0, 'cm_low': null, 'is_sealed': false},
          'spike': {'tcg_low': 50.0, 'cm_low': null, 'is_sealed': false},
          'ok': {'tcg_low': 4.0, 'cm_low': null, 'is_sealed': false},
        },
      );
      expect(ranked.gainers.single.cardId, 'ok');
    });

    test('does not invent a Low for a missing start day', () {
      final ranked = rankRecentMovers(
        today: '2026-08-26',
        source: 'tcgplayer',
        snapshotsByCard: {
          'gap': [
            {'captured_on': '2026-08-24', 'tcg_low': 2.0},
          ],
        },
        currentLows: {
          'gap': {'tcg_low': 4.0, 'cm_low': null, 'is_sealed': false},
        },
      );
      expect(ranked.gainers, isEmpty);
      expect(ranked.losers, isEmpty);
    });
  });

  group('lookupPrintingRecentChanges helper-level', () {
    test('includes under-floor 0.30 to 0.60 and names start vs latest', () {
      final overlays = lookupPrintingRecentChanges(
        today: '2026-08-26',
        source: 'tcgplayer',
        snapshotsByCard: {
          'cheap-spike': [
            {'captured_on': '2026-08-23', 'tcg_low': 0.3},
          ],
        },
        currentLows: {
          'cheap-spike': {'tcg_low': 0.6, 'cm_low': null, 'is_sealed': false},
        },
        cardIds: ['cheap-spike'],
      );
      final row = overlays.single;
      expect(row.startLow, 0.3);
      expect(row.latestLow, 0.6);
      expect(row.percentChange, 1.0);
      expect(row.amountChange, 0.3);
    });

    test('does not apply the ranked floor or top-10 cut', () {
      final overlays = lookupPrintingRecentChanges(
        today: '2026-08-26',
        source: 'tcgplayer',
        snapshotsByCard: {
          'cheap': [
            {'captured_on': '2026-08-23', 'tcg_low': 0.5},
          ],
        },
        currentLows: {
          'cheap': {'tcg_low': 0.8, 'cm_low': null, 'is_sealed': false},
        },
        cardIds: ['cheap'],
      );
      expect(overlays.single.cardId, 'cheap');
    });
  });

  group('copiesByPrintingId', () {
    test('sums two condition rows for one Printing', () {
      final card = buildCard(id: 'print-1');
      final entries = [
        BinderEntry(
          card: card,
          quantity: 2,
          condition: 'NM',
          isWanted: false,
          binderId: BinderIds.trade,
          addedAt: DateTime(2026, 8, 1),
        ),
        BinderEntry(
          card: card,
          quantity: 3,
          condition: 'LP',
          isWanted: false,
          binderId: BinderIds.trade,
          addedAt: DateTime(2026, 8, 1),
        ),
      ];
      expect(copiesByPrintingId(entries), {'print-1': 5});
    });

    test('omits Want List and qty 0', () {
      final card = buildCard(id: 'print-1');
      final other = buildCard(id: 'print-2');
      final entries = [
        BinderEntry(
          card: card,
          quantity: 2,
          isWanted: true,
          binderId: BinderIds.trade,
          addedAt: DateTime(2026, 8, 1),
        ),
        BinderEntry(
          card: other,
          quantity: 0,
          isWanted: false,
          binderId: BinderIds.trade,
          addedAt: DateTime(2026, 8, 1),
        ),
      ];
      expect(copiesByPrintingId(entries), isEmpty);
    });
  });

  group('ownedPrintingIds from BinderEntry', () {
    test('uses the Printing id, not Binder name', () {
      final card = buildCard(id: 'print-1');
      final entries = [
        BinderEntry(
          card: card,
          quantity: 1,
          isWanted: false,
          binderId: BinderIds.trade,
          addedAt: DateTime(2026, 8, 1),
        ),
        BinderEntry(
          card: card,
          quantity: 2,
          isWanted: false,
          binderId: BinderIds.collection,
          addedAt: DateTime(2026, 8, 1),
        ),
      ];
      expect(ownedPrintingIds(entries), ['print-1']);
    });
  });
}
