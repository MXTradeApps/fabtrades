// Contract tests for printing recent-change overlay lookup.
//
// These assert the shared fixtures in packages/contracts, which the JavaScript
// implementation in apps/web is held to as well. A failure here means either this
// package's logic drifted from web, or the agreed behaviour changed and both sides
// plus the fixture need updating. See packages/contracts/README.md.
import 'package:fabtrades/core/logic/recent_movers.dart';
import 'package:flutter_test/flutter_test.dart';

import 'contract_fixtures.dart';

void main() {
  final contract = loadContract('printing_recent_changes');
  final today = contract['today'] as String;

  Map<String, List<Map<String, dynamic>>> snapshots(
    Map<String, dynamic> c,
  ) {
    final raw = Map<String, dynamic>.from(c['snapshots_by_card'] as Map);
    return raw.map(
      (id, snaps) => MapEntry(
        id,
        (snaps as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
      ),
    );
  }

  Map<String, Map<String, dynamic>> currentLows(Map<String, dynamic> c) {
    final raw = Map<String, dynamic>.from(c['current_lows'] as Map);
    return raw.map(
      (id, row) => MapEntry(id, Map<String, dynamic>.from(row as Map)),
    );
  }

  List<String> cardIds(Map<String, dynamic> c) =>
      (c['card_ids'] as List).map((e) => e as String).toList();

  group('lookupPrintingRecentChanges', () {
    for (final c in contractCases(contract, 'lookup_cases')) {
      final name = c['name'] as String;
      test(name, () {
        final overlays = lookupPrintingRecentChanges(
          today: today,
          source: c['source'] as String,
          snapshotsByCard: snapshots(c),
          currentLows: currentLows(c),
          cardIds: cardIds(c),
        );
        expect(overlays.map((r) => r.toJson()).toList(), c['expected']);
        for (final row in overlays) {
          expect(row.percentChange, isNot(0));
          expect(
            row.amountChange,
            closeTo(row.latestLow - row.startLow, 1e-9),
          );
          expect(
            row.percentChange,
            closeTo((row.latestLow - row.startLow) / row.startLow, 1e-9),
          );
        }
      });
    }
  });

  test('under-floor cheap spike is included', () {
    final cheap = contractCases(contract, 'lookup_cases').firstWhere(
      (c) => (c['name'] as String).contains('0.30'),
    );
    final overlays = lookupPrintingRecentChanges(
      today: today,
      source: cheap['source'] as String,
      snapshotsByCard: snapshots(cheap),
      currentLows: currentLows(cheap),
      cardIds: cardIds(cheap),
    );
    expect(overlays, isNotEmpty);
    expect(overlays.single.cardId, 'cheap-spike');
    expect(overlays.single.startLow, lessThan(1));
  });

  test('0%, missing window, and outliers are omitted', () {
    for (final needle in ['2.00', '2-day', 'outlier']) {
      final c = contractCases(contract, 'lookup_cases').firstWhere(
        (row) => (row['name'] as String).contains(needle),
      );
      final overlays = lookupPrintingRecentChanges(
        today: today,
        source: c['source'] as String,
        snapshotsByCard: snapshots(c),
        currentLows: currentLows(c),
        cardIds: cardIds(c),
      );
      if (needle == '2.00') {
        expect(overlays, isEmpty);
      } else if (needle == '2-day') {
        expect(overlays.map((r) => r.cardId), ['in-window']);
      } else {
        expect(overlays.map((r) => r.cardId), ['at-percent-cap']);
      }
    }
  });

  test('null Low is never coerced to 0', () {
    final nullCase = contractCases(contract, 'lookup_cases').firstWhere(
      (c) => (c['name'] as String).contains('null Low'),
    );
    final snaps = snapshots(nullCase)['null-only']!;
    expect(snaps.first['tcg_low'], isNull);
    final overlays = lookupPrintingRecentChanges(
      today: today,
      source: nullCase['source'] as String,
      snapshotsByCard: snapshots(nullCase),
      currentLows: currentLows(nullCase),
      cardIds: cardIds(nullCase),
    );
    expect(overlays.map((r) => r.cardId), isNot(contains('null-only')));
    expect(overlays.any((r) => r.startLow == 0), isFalse);
    expect(overlays.any((r) => r.latestLow == 0), isFalse);
  });
}
