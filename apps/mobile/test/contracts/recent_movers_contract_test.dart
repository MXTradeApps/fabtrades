// Contract tests for recent movers ranking and owned Printing ids.
//
// These assert the shared fixtures in packages/contracts, which the JavaScript
// implementation in apps/web is held to as well. A failure here means either this
// package's logic drifted from web, or the agreed behaviour changed and both sides
// plus the fixture need updating. See packages/contracts/README.md.
import 'package:fabtrades/core/logic/recent_movers.dart';
import 'package:flutter_test/flutter_test.dart';

import 'contract_fixtures.dart';

void main() {
  final contract = loadContract('recent_movers');
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

  Map<String, dynamic> asJson(RecentLowChange row) => row.toJson();

  group('rankRecentMovers', () {
    for (final c in contractCases(contract, 'ranking_cases')) {
      final name = c['name'] as String;
      test(name, () {
        final ranked = rankRecentMovers(
          today: today,
          source: c['source'] as String,
          snapshotsByCard: snapshots(c),
          currentLows: currentLows(c),
        );
        final expected = Map<String, dynamic>.from(c['expected'] as Map);
        expect(
          ranked.gainers.map(asJson).toList(),
          expected['gainers'],
        );
        expect(
          ranked.losers.map(asJson).toList(),
          expected['losers'],
        );
        for (final row in [...ranked.gainers, ...ranked.losers]) {
          expect(row.startLow, isNot(0));
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

  group('ownedPrintingIds', () {
    for (final c in contractCases(contract, 'owned_id_cases')) {
      final name = c['name'] as String;
      test(name, () {
        final entries = (c['entries'] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        expect(ownedPrintingIds(entries), c['expected_ids']);
      });
    }
  });

  test('null Low is never coerced to 0 in ranking inputs', () {
    final nullCase = contractCases(contract, 'ranking_cases').firstWhere(
      (c) => (c['name'] as String).contains('null Low'),
    );
    final snaps = snapshots(nullCase)['null-only']!;
    expect(snaps.first['tcg_low'], isNull);
    final ranked = rankRecentMovers(
      today: today,
      source: nullCase['source'] as String,
      snapshotsByCard: snapshots(nullCase),
      currentLows: currentLows(nullCase),
    );
    expect(ranked.gainers.map((r) => r.cardId), isNot(contains('null-only')));
    expect(ranked.gainers.any((r) => r.startLow == 0), isFalse);
    expect(ranked.gainers.any((r) => r.latestLow == 0), isFalse);
  });
}
