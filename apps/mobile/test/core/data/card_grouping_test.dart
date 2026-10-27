import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/data/card_repository.dart';
import 'package:fabtrades/core/models/card_model.dart';

import '../../support/fixtures.dart';

void main() {
  group('isNonCardProduct', () {
    test('true when both rarity and collector number are missing', () {
      expect(
        isNonCardProduct(buildCard(rarity: null, collectorNumber: null)),
        isTrue,
      );
    });

    test('treats "None" rarity and blank number as missing', () {
      expect(
        isNonCardProduct(buildCard(rarity: 'None', collectorNumber: '  ')),
        isTrue,
      );
    });

    test('false when a rarity exists', () {
      expect(
        isNonCardProduct(buildCard(rarity: 'Common', collectorNumber: null)),
        isFalse,
      );
    });

    test('false when a collector number exists', () {
      expect(
        isNonCardProduct(buildCard(rarity: null, collectorNumber: '015/219')),
        isFalse,
      );
    });
  });

  group('nameSetCode / stripNameSetCode', () {
    test('extracts promo set-code suffixes from real catalog shapes', () {
      expect(nameSetCode('Leaven Sheath - FAB428'), 'FAB428');
      expect(nameSetCode('Sap (Yellow) - FAB116'), 'FAB116');
      expect(nameSetCode('Zipper Hit (Yellow) (Marvel) - TNP029'), 'TNP029');
      expect(
        nameSetCode('Victor Goldmane, High and Mighty - HER145'),
        'HER145',
      );
      expect(nameSetCode('Rampant Growth // Life - LGS341'), 'LGS341');
      expect(nameSetCode('Dash I/O - HER156'), 'HER156');
    });

    test('does not match hero-style lowercase suffixes or bare codes', () {
      expect(nameSetCode('Ahri - Inquisitive'), isNull);
      expect(nameSetCode('Vex - Apathetic'), isNull);
      expect(nameSetCode('FAB428'), isNull);
      expect(stripNameSetCode('Ahri - Inquisitive'), 'Ahri - Inquisitive');
      expect(stripNameSetCode('Vex - Apathetic'), 'Vex - Apathetic');
      expect(stripNameSetCode('FAB428'), 'FAB428');
    });

    test('stripNameSetCode removes only the trailing set code', () {
      expect(stripNameSetCode('Leaven Sheath - FAB428'), 'Leaven Sheath');
      expect(
        stripNameSetCode('Victor Goldmane, High and Mighty - HER145'),
        'Victor Goldmane, High and Mighty',
      );
      expect(
        stripNameSetCode('Zipper Hit (Yellow) (Marvel) - TNP029'),
        'Zipper Hit (Yellow) (Marvel)',
      );
    });
  });

  group('nameQualifier', () {
    test('extracts trailing parenthetical', () {
      expect(nameQualifier('Ahri - Inquisitive (Overnumbered)'), 'Overnumbered');
    });

    test('returns null when there is no qualifier', () {
      expect(nameQualifier('Ahri - Inquisitive'), isNull);
    });

    test('strips set code before reading the art qualifier', () {
      expect(
        nameQualifier('Zipper Hit (Yellow) (Marvel) - TNP029'),
        'Marvel',
      );
    });
  });

  group('baseCardName', () {
    test('strips a single trailing qualifier', () {
      expect(baseCardName('Vex (Alternate Art)'), 'Vex');
    });

    test('strips multiple stacked qualifiers', () {
      expect(baseCardName('Vex (Alternate Art) (Signature)'), 'Vex');
    });

    test('leaves a plain name untouched', () {
      expect(baseCardName('Vex - Apathetic'), 'Vex - Apathetic');
    });

    test('does not strip a name that is only a parenthetical', () {
      expect(baseCardName('(Buff)'), '(Buff)');
    });

    test('keeps pitch-color qualifiers (distinct FAB cards)', () {
      expect(baseCardName('Sink Below (Red)'), 'Sink Below (Red)');
      expect(baseCardName('Sink Below (Yellow)'), 'Sink Below (Yellow)');
      expect(baseCardName('Sink Below (Blue)'), 'Sink Below (Blue)');
    });

    test('strips art qualifiers but keeps the pitch color', () {
      expect(baseCardName('Sink Below (Red) (Extended Art)'), 'Sink Below (Red)');
    });

    test('strips promo set-code suffixes so promos join their base card', () {
      expect(baseCardName('Leaven Sheath - FAB428'), 'Leaven Sheath');
      // Code first, then art qualifier, pitch kept.
      expect(
        baseCardName('Zipper Hit (Yellow) (Marvel) - TNP029'),
        'Zipper Hit (Yellow)',
      );
    });
  });

  group('rarityRank', () {
    test('orders common below rare below majestic below legendary', () {
      expect(rarityRank('Common') < rarityRank('Rare'), isTrue);
      expect(rarityRank('Rare') < rarityRank('Majestic'), isTrue);
      expect(rarityRank('Majestic') < rarityRank('Legendary'), isTrue);
    });

    test('super rare sits between rare and majestic', () {
      expect(rarityRank('Rare') < rarityRank('Super Rare'), isTrue);
      expect(rarityRank('Super Rare') < rarityRank('Majestic'), isTrue);
    });

    test('unknown rarities sort last', () {
      expect(rarityRank('mythic'), 9);
      expect(rarityRank(null), 9);
    });
  });

  group('groupCardsByName', () {
    test('collapses art/finish variants into one group', () {
      final cards = [
        buildCard(id: 'n', name: 'Vex', isFoil: false),
        buildCard(id: 'f', name: 'Vex', isFoil: true),
        buildCard(id: 'alt', name: 'Vex (Alternate Art)'),
      ];
      final groups = groupCardsByName(cards, CardSort.nameAsc);
      expect(groups.length, 1);
      expect(groups.single.name, 'Vex');
      expect(groups.single.versions.length, 3);
      expect(groups.single.hasMultiple, isTrue);
    });

    test('merges name-embedded promo set codes into the base card group', () {
      final cards = [
        buildCard(
          id: '664629-normal',
          name: 'Leaven Sheath',
          setName: 'Compendium of Rathe',
          collectorNumber: 'PEN208',
        ),
        buildCard(
          id: '664629-rainbow-foil',
          name: 'Leaven Sheath',
          setName: 'Compendium of Rathe',
          isFoil: true,
          collectorNumber: 'PEN208',
        ),
        buildCard(
          id: '664630-rainbow-foil',
          name: 'Leaven Sheath - FAB428',
          setName: 'Flesh and Blood: Promo Cards',
          rarity: 'Promo',
          isFoil: true,
          collectorNumber: 'FAB428',
        ),
      ];
      final groups = groupCardsByName(cards, CardSort.nameAsc);
      expect(groups.length, 1);
      expect(groups.single.name, 'Leaven Sheath');
      expect(groups.single.versions.map((c) => c.id), contains('664630-rainbow-foil'));
    });

    test('representative is the non-foil base printing', () {
      final cards = [
        buildCard(id: 'f', name: 'Vex', isFoil: true, rarity: 'Common'),
        buildCard(id: 'n', name: 'Vex', isFoil: false, rarity: 'Common'),
      ];
      final groups = groupCardsByName(cards, CardSort.nameAsc);
      expect(groups.single.representative.id, 'n');
    });

    test('nameAsc orders groups alphabetically', () {
      final cards = [
        buildCard(id: '1', name: 'Zed'),
        buildCard(id: '2', name: 'Ahri'),
      ];
      final groups = groupCardsByName(cards, CardSort.nameAsc);
      expect(groups.map((g) => g.name), ['Ahri', 'Zed']);
    });

    test('priceDesc orders by representative price, nulls last', () {
      final cards = [
        buildCard(id: '1', name: 'Cheap', tcgMarket: 1),
        buildCard(id: '2', name: 'Pricey', tcgMarket: 10),
        buildCard(id: '3', name: 'Unpriced'),
      ];
      final groups = groupCardsByName(cards, CardSort.priceDesc);
      expect(groups.map((g) => g.name), ['Pricey', 'Cheap', 'Unpriced']);
    });
  });

  group('printingsForCard', () {
    test('returns every variant sharing the base name, base-first', () {
      final target = buildCard(id: 'n', name: 'Vex');
      final catalog = [
        buildCard(id: 'f', name: 'Vex', isFoil: true),
        target,
        buildCard(id: 'other', name: 'Ahri'),
      ];
      final printings = printingsForCard(catalog, target);
      expect(printings.map((c) => c.id), ['n', 'f']);
    });

    test('includes FAB428 promo when starting from a PEN208 printing', () {
      final pen = buildCard(
        id: '664629-normal',
        name: 'Leaven Sheath',
        setName: 'Compendium of Rathe',
        collectorNumber: 'PEN208',
      );
      final promo = buildCard(
        id: '664630-rainbow-foil',
        name: 'Leaven Sheath - FAB428',
        setName: 'Flesh and Blood: Promo Cards',
        rarity: 'Promo',
        isFoil: true,
        collectorNumber: 'FAB428',
      );
      final printings = printingsForCard([pen, promo], pen);
      expect(printings.map((c) => c.id), contains('664630-rainbow-foil'));
    });

    test('falls back to the card itself when not in catalog', () {
      final target = buildCard(id: 'lonely', name: 'Nobody');
      final printings = printingsForCard(const [], target);
      expect(printings.single.id, 'lonely');
    });
  });

  group('oppositeFinish', () {
    test('finds the foil sharing a productId', () {
      final normal = buildCard(id: 'n', productId: 100, isFoil: false);
      final foil = buildCard(id: 'f', productId: 100, isFoil: true);
      expect(oppositeFinish([normal, foil], normal)?.id, 'f');
    });

    test('matches on name + number when no productId', () {
      final normal =
          buildCard(id: 'n', name: 'Vex', collectorNumber: '5', isFoil: false);
      final foil =
          buildCard(id: 'f', name: 'Vex', collectorNumber: '5', isFoil: true);
      expect(oppositeFinish([normal, foil], normal)?.id, 'f');
    });

    test('returns null when there is no alternate finish', () {
      final normal = buildCard(id: 'n', productId: 1, isFoil: false);
      expect(oppositeFinish([normal], normal), isNull);
    });
  });

  group('finishesForCard', () {
    test('lists every finish for a productId, Normal first', () {
      final normal = buildCard(
          id: 'n', productId: 100, isFoil: false, subTypeName: 'Normal');
      final rainbow = buildCard(
          id: 'rf',
          productId: 100,
          isFoil: true,
          subTypeName: 'Rainbow Foil');
      final cold = buildCard(
          id: 'cf', productId: 100, isFoil: true, subTypeName: 'Cold Foil');
      final finishes = finishesForCard([cold, rainbow, normal], rainbow);
      expect(finishes.map((c) => c.id), ['n', 'cf', 'rf']);
    });

    test('always includes the requested card', () {
      final card = buildCard(id: 'lonely', productId: 9, isFoil: true);
      expect(finishesForCard(const [], card).single.id, 'lonely');
    });
  });

  group('cardGroupName across inconsistent catalog names', () {
    CardModel usurp(String id, String name, {double? market}) => buildCard(
          id: id,
          productId: int.parse(id.split('-').first),
          name: name,
          pitch: '3',
          collectorNumber: 'IAR110',
          tcgMarket: market,
        );

    test('adds the pitch color when the name leaves it out', () {
      expect(cardGroupName(usurp('1-base', 'Usurp the Shadow Throne')),
          'Usurp the Shadow Throne (Blue)');
      expect(
          cardGroupName(
              usurp('1-cold-foil', 'Usurp the Shadow Throne (Blue) (Marvel)')),
          'Usurp the Shadow Throne (Blue)');
      expect(cardGroupName(usurp('2-x', 'Usurp the Shadow Throne (Marvel)')),
          'Usurp the Shadow Throne (Blue)');
      expect(cardGroupName(buildCard(name: 'Anothos (Golden) - FAB061')),
          'Anothos');
    });

    test('a pitch color in the name wins over the pitch column', () {
      expect(cardGroupName(buildCard(name: 'Snatch (Red)', pitch: '3')),
          'Snatch (Red)');
    });

    test('every Usurp version is one group and one printing list', () {
      final catalog = [
        usurp('711437-rainbow-foil', 'Usurp the Shadow Throne (Blue)',
            market: 59.18),
        usurp('711436-cold-foil', 'Usurp the Shadow Throne (Blue) (Marvel)',
            market: 248.53),
        usurp('9-normal', 'Usurp the Shadow Throne'),
      ];
      final groups = groupCardsByName(catalog, CardSort.nameAsc);
      expect(groups, hasLength(1));
      expect(groups.single.name, 'Usurp the Shadow Throne (Blue)');
      expect(groups.single.versions, hasLength(3));
      expect(printingsForCard(catalog, catalog.last), hasLength(3));
    });
  });

  group('linkBaseToNormal', () {
    CardModel row(String id, {double? market}) => buildCard(
          id: id,
          productId: int.parse(id.split('-').first),
          name: 'Usurp the Shadow Throne',
          tcgMarket: market,
        );

    test('drops an unpriced blank row next to any real finish', () {
      final kept = linkBaseToNormal([
        row('711436-base'),
        row('711436-cold-foil', market: 248.53),
        row('711437-base'),
        row('711437-rainbow-foil', market: 59.18),
      ]);
      expect(kept.map((c) => c.id),
          ['711436-cold-foil', '711437-rainbow-foil']);
    });

    test('keeps a priced blank row, and a blank row on its own', () {
      final kept = linkBaseToNormal([
        row('9-base', market: 2),
        row('9-rainbow-foil', market: 20),
        row('42-base'),
      ]);
      expect(kept.map((c) => c.id), ['9-base', '9-rainbow-foil', '42-base']);
    });

    test('still drops a blank row when Normal exists', () {
      final kept = linkBaseToNormal([
        row('5-base', market: 1),
        row('5-normal', market: 1),
      ]);
      expect(kept.map((c) => c.id), ['5-normal']);
    });
  });
}
