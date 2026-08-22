import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/logic/pricing.dart';
import 'package:fabtrades/core/logic/trade_filler.dart';
import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/models/binder_entry.dart';
import 'package:fabtrades/core/models/trade.dart';

import '../../support/fixtures.dart';

void main() {
  final pricing = Pricing(const AppSettings());
  final now = DateTime.utc(2026, 7, 1);

  group('partitionFillerMatches', () {
    test('boosts binder cards when filling my (have) side', () {
      final catalog = [
        buildCard(id: 'cheap', tcgMarket: 1),
        buildCard(id: 'binder', tcgMarket: 5),
        buildCard(id: 'exact', tcgMarket: 4),
      ];
      final partition = partitionFillerMatches(
        catalog: catalog,
        pricing: pricing,
        target: 4,
        fillSide: TradeSide.have,
        binderEntries: [
          BinderEntry(
              card: catalog[1], quantity: 1, isWanted: false, addedAt: now),
        ],
      );
      expect(partition.boosted.map((m) => m.card.id), ['binder']);
      expect(partition.catalog.map((m) => m.card.id).first, 'exact');
      // Sparse binder still surfaces the rest of the catalog.
      expect(partition.catalog.length, 2);
    });

    test('boosts want-list cards when filling their (want) side', () {
      final catalog = [
        buildCard(id: 'a', tcgMarket: 3),
        buildCard(id: 'want', tcgMarket: 8),
        buildCard(id: 'b', tcgMarket: 10),
      ];
      final partition = partitionFillerMatches(
        catalog: catalog,
        pricing: pricing,
        target: 8,
        fillSide: TradeSide.want,
        binderEntries: [
          BinderEntry(
              card: catalog[1], quantity: 1, isWanted: true, addedAt: now),
          // Binder-owned card must NOT boost when filling their side.
          BinderEntry(
              card: catalog[0], quantity: 1, isWanted: false, addedAt: now),
        ],
      );
      expect(partition.boosted.map((m) => m.card.id), ['want']);
      expect(partition.catalog.map((m) => m.card.id), isNot(contains('want')));
    });

    test('does not boost Collection cards when filling my (have) side', () {
      final catalog = [
        buildCard(id: 'collection', tcgMarket: 4),
        buildCard(id: 'exact', tcgMarket: 4),
      ];
      final partition = partitionFillerMatches(
        catalog: catalog,
        pricing: pricing,
        target: 4,
        fillSide: TradeSide.have,
        binderEntries: [
          BinderEntry(
            card: catalog[0],
            quantity: 1,
            isWanted: false,
            binderId: BinderIds.collection,
            addedAt: now,
          ),
        ],
      );
      expect(partition.boosted, isEmpty);
      expect(partition.catalog.map((m) => m.card.id), contains('collection'));
    });
      final catalog = [
        buildCard(id: 'x', tcgMarket: 2),
        buildCard(id: 'y', tcgMarket: 6),
      ];
      final partition = partitionFillerMatches(
        catalog: catalog,
        pricing: pricing,
        target: 5,
        fillSide: TradeSide.have,
        binderEntries: const [],
      );
      expect(partition.boosted, isEmpty);
      expect(partition.catalog.length, 2);
    });
  });
}
