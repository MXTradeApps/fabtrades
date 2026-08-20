// Contract tests for Binder-value snapshot math.
//
// These assert the shared fixtures in packages/contracts, which the JavaScript
// implementation in apps/web is held to as well. Overlay chrome is out of
// scope. See packages/contracts/README.md.
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/logic/binder_value_snapshot.dart';
import 'package:fabtrades/core/models/app_settings.dart';

import 'contract_fixtures.dart';

void main() {
  final contract = loadContract('binder_value_snapshot');
  final tolerance = (contract['tolerance'] as num).toDouble();

  for (final c in contractCases(contract, 'cases')) {
    test(c['name'] as String, () {
      final source = (c['source'] as String) == 'cardmarket'
          ? PriceSource.cardmarket
          : PriceSource.tcgplayer;
      final headline = (c['headline'] as String) == 'tcgMarketOnly'
          ? BinderValueHeadline.tcgMarketOnly
          : BinderValueHeadline.pricingValue;
      final rows = (c['entries'] as List)
          .map((e) => BinderValueRow.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();

      final snap = buildBinderValueSnapshot(
        rows,
        source: source,
        headline: headline,
      );
      final expected = Map<String, dynamic>.from(c['expected'] as Map);

      expect(snap.copies, expected['copies']);
      expect(snap.distinctPrintings, expected['distinctPrintings']);
      expect(snap.foilCopies, expected['foilCopies']);
      expect(snap.regularCopies, expected['regularCopies']);
      expect(snap.tcgUnpricedCopies, expected['tcgUnpricedCopies']);
      expect(snap.cmUnpricedCopies, expected['cmUnpricedCopies']);
      _expectMoney(snap.tcgMarket, expected['tcgMarket'], tolerance);
      _expectMoney(snap.tcgLow, expected['tcgLow'], tolerance);
      _expectMoney(snap.cmTrend, expected['cmTrend'], tolerance);
      _expectMoney(snap.cmLow, expected['cmLow'], tolerance);

      final top = expected['topPrintings'] as List;
      expect(snap.topPrintings.length, top.length);
      for (var i = 0; i < top.length; i++) {
        final want = Map<String, dynamic>.from(top[i] as Map);
        final got = snap.topPrintings[i];
        expect(got.printingId, want['printingId']);
        expect(got.name, want['name']);
        expect(got.finish, want['finish']);
        expect(got.quantity, want['quantity']);
        expect(
          got.contribution,
          closeTo((want['contribution'] as num).toDouble(), tolerance),
        );
      }
    });
  }
}

void _expectMoney(MoneyTotal got, Object? raw, double tolerance) {
  final want = Map<String, dynamic>.from(raw as Map);
  expect(got.pricedCopies, want['pricedCopies']);
  expect(got.unpricedCopies, want['unpricedCopies']);
  if (want['amount'] == null) {
    expect(got.amount, isNull);
  } else {
    expect(got.amount, isNotNull);
    expect(got.amount!, closeTo((want['amount'] as num).toDouble(), tolerance));
  }
}
