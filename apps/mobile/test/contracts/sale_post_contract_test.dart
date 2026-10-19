import 'package:fabtrades/core/logic/sale_post.dart';
import 'package:flutter_test/flutter_test.dart';

import 'contract_fixtures.dart';

void main() {
  final contract = loadContract('sale_post');

  group('salePriceCents', () {
    for (final c in contractCases(contract, 'salePriceCents')) {
      test('prices ${c['price']} at ${c['percent']}%', () {
        expect(
          salePriceCents((c['price'] as num?)?.toDouble(), c['percent'] as int),
          c['expected'],
        );
      });
    }
  });

  group('buildSalePost', () {
    for (final c in contractCases(contract, 'buildSalePost')) {
      test(c['name'] as String, () {
        final input = Map<String, dynamic>.from(c['input'] as Map);
        final items = (input['items'] as List).map((raw) {
          final e = Map<String, dynamic>.from(raw as Map);
          return SaleItem(
            name: e['name'] as String,
            finish: e['finish'] as String?,
            condition: e['condition'] as String,
            quantity: e['quantity'] as int,
            price: (e['price'] as num?)?.toDouble(),
          );
        });
        final post = buildSalePost(
          platform: SalePlatform.values.byName(input['platform'] as String),
          items: items,
          percent: input['percent'] as int? ?? 100,
          symbol: input['symbol'] as String? ?? r'$',
          sourceLabel: input['sourceLabel'] as String? ?? 'TCGplayer',
          pricedOn: input['pricedOn'] as String? ?? '',
          link: input['link'] as String? ?? '',
          limit: input['limit'] as int? ?? discordMessageLimit,
        );
        expect(post, List<String>.from(c['expected'] as List));
      });
    }
  });
}
