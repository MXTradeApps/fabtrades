import 'dart:convert';

import 'package:fabtrades/core/logic/trade_offer.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/fixtures.dart';

// Expectations mirror apps/web/tests/utils/tradeOffer.test.js, so the phone
// and the website write the same offer.

TradeItem _item(
  String name, {
  String id = 'card-1',
  String? subTypeName,
  double price = 0,
  int quantity = 1,
}) =>
    TradeItem(
      card: buildCard(id: id, name: name, subTypeName: subTypeName),
      priceEach: price,
      quantity: quantity,
    );

Trade _trade({
  List<TradeItem> have = const [],
  List<TradeItem> want = const [],
}) =>
    Trade(
      id: 'draft',
      createdAt: DateTime(2026, 10, 19),
      haveItems: have,
      wantItems: want,
    );

void main() {
  group('foilAbbrev', () {
    test('maps foil types to Discord shorthand', () {
      expect(TradeOffer.foilAbbrev('Cold Foil'), 'CF');
      expect(TradeOffer.foilAbbrev('Rainbow Foil'), 'RF');
      expect(TradeOffer.foilAbbrev('Gold Foil'), 'GF');
      expect(TradeOffer.foilAbbrev('Normal'), 'NF');
      expect(TradeOffer.foilAbbrev(''), 'NF');
      expect(TradeOffer.foilAbbrev(null), 'NF');
    });
  });

  group('parseCardName', () {
    test('strips set codes and extracts the art variant', () {
      final parsed =
          TradeOffer.parseCardName('Fleeing Starbreeze (Extended Art) (MST040)');
      expect(parsed.baseName, 'Fleeing Starbreeze');
      expect(parsed.artAbbrev, 'EA');
    });

    test('keeps pitch colors attached', () {
      final parsed = TradeOffer.parseCardName('Spellbound Creepers (Red)');
      expect(parsed.baseName, 'Spellbound Creepers (Red)');
      expect(parsed.artAbbrev, isNull);
    });
  });

  group('cardLine', () {
    test('formats a CF EA line with a rounded price', () {
      expect(
        TradeOffer.cardLine(_item(
          'Fleeing Starbreeze (Extended Art) (MST040)',
          subTypeName: 'Cold Foil',
          price: 40.2,
        )),
        'CF EA Fleeing Starbreeze 40',
      );
    });

    test('prefixes the quantity when more than one', () {
      expect(
        TradeOffer.cardLine(_item(
          'Nourishing Glow (MST012)',
          subTypeName: 'Cold Foil',
          price: 12,
          quantity: 3,
        )),
        '3x CF Nourishing Glow 12',
      );
    });
  });

  group('message', () {
    test('is empty for an empty trade', () {
      expect(TradeOffer.message(_trade()), '');
    });

    test('offers my cards for theirs with the cash difference', () {
      final text = TradeOffer.message(
        _trade(
          have: [_item('Voltaris (DYN001)', subTypeName: 'Normal', price: 20)],
          want: [
            _item('Fleeing Starbreeze (MST040)',
                subTypeName: 'Cold Foil', price: 30),
          ],
        ),
        pricedAsOf: DateTime(2026, 10, 19),
      );
      expect(
        text,
        'Hey — I can do this trade:\n'
        '\n'
        '**I can offer**\n'
        'NF Voltaris 20\n'
        '+ \$10 cash from me\n'
        '\n'
        '**For your**\n'
        'CF Fleeing Starbreeze 30\n'
        '\n'
        'Priced via TCGPlayer, Oct 19, 2026\n'
        'Balanced on fabtrades.net\n',
      );
    });

    test('asks for anything back when only my side has cards', () {
      final text = TradeOffer.message(
        _trade(have: [_item('Voltaris', price: 20)]),
        pricedAsOf: DateTime(2026, 10, 19),
      );
      expect(text, contains('**For**\nwhatever you want to send back / cash'));
    });
  });

  group('link', () {
    test('is null for an empty trade', () {
      expect(TradeOffer.link(_trade()), isNull);
    });

    test('encodes the payload the website decodes', () {
      final now = DateTime.fromMillisecondsSinceEpoch(60000 * 1000);
      final link = TradeOffer.link(
        _trade(
          have: [_item('Mine', id: '684123-Normal', price: 2.5, quantity: 2)],
          want: [_item('Theirs', id: '700001-Cold Foil', price: 9)],
        ),
        now: now,
      )!;

      final uri = Uri.parse(link);
      expect(uri.origin, 'https://fabtrades.net');
      final payload =
          jsonDecode(utf8.decode(base64Decode(uri.queryParameters['trade']!)));
      expect(payload, {
        'v': 1,
        't': 1000,
        'h': [
          ['684123-Normal', 2.5, 2],
        ],
        'w': [
          ['700001-Cold Foil', 9.0, 1],
        ],
      });
    });
  });
}
