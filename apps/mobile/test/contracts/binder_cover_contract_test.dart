// Contract tests for Binder tile cover pick.
//
// These assert the shared fixtures in packages/contracts, which the JavaScript
// implementation in apps/web is held to as well.
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/logic/binder_cover.dart';
import 'package:fabtrades/core/logic/binder_value_snapshot.dart';
import 'package:fabtrades/core/models/app_settings.dart';

import 'contract_fixtures.dart';

void main() {
  final contract = loadContract('binder_cover');

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

      final cover = pickBinderCover(rows, source: source, headline: headline);
      final expected = Map<String, dynamic>.from(c['expected'] as Map);
      expect(cover.printingId, expected['printingId']);
      if (expected.containsKey('condition') && expected['condition'] != null) {
        expect(cover.condition, expected['condition']);
      }
    });
  }
}
