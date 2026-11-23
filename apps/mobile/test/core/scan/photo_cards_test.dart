// Grouping and matching for "Post from photo", driven with synthetic text
// boxes laid out like real cards (see test/support/photo_layout.dart). These
// prove the logic, not how well ML Kit reads a real photo.

import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/core/scan/ocr_guide_filter.dart';
import 'package:fabtrades/core/scan/photo_cards.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/fixtures.dart';
import '../../support/photo_layout.dart';

final enlightened = buildCard(
  id: 'es',
  name: 'Enlightened Strike',
  collectorNumber: 'WTR159',
  rarity: 'Majestic',
);
final command = buildCard(
  id: 'cnc',
  name: 'Command and Conquer',
  collectorNumber: 'ARC159',
  rarity: 'Majestic',
);
final snatch = buildCard(id: 'sn', name: 'Snatch', collectorNumber: 'WTR167');
final readRunes = buildCard(
  id: 'rtr',
  name: 'Read the Runes',
  collectorNumber: 'ARC094',
);
final runechant = buildCard(
  id: 'rc',
  name: 'Runechant',
  collectorNumber: 'ARC112',
  rarity: 'Token',
  cardType: 'Token',
);
final kodachi = buildCard(id: 'k', name: 'Kodachi', collectorNumber: 'XXX001');
final harmonized = buildCard(
  id: 'hk',
  name: 'Harmonized Kodachi',
  collectorNumber: 'WTR078',
);
final sinkRed = buildCard(
  id: 'sb-r',
  name: 'Sink Below (Red)',
  collectorNumber: 'WTR215',
  pitch: '1',
);
final sinkYellow = buildCard(
  id: 'sb-y',
  name: 'Sink Below (Yellow)',
  collectorNumber: 'WTR216',
  pitch: '2',
);
final sinkBlue = buildCard(
  id: 'sb-b',
  name: 'Sink Below (Blue)',
  collectorNumber: 'WTR217',
  pitch: '3',
);
final sheath = buildCard(
  id: 'ls',
  name: 'Leaven Sheath',
  collectorNumber: 'PEN208',
);
final sheathFoil = buildCard(
  id: 'ls-f',
  name: 'Leaven Sheath',
  collectorNumber: 'PEN208',
  subTypeName: 'Rainbow Foil',
  isFoil: true,
);
final sheathPromo = buildCard(
  id: 'ls-promo',
  name: 'Leaven Sheath - FAB428',
  collectorNumber: 'FAB428',
  subTypeName: 'Rainbow Foil',
  isFoil: true,
  rarity: 'Promo',
);

final catalog = <CardModel>[
  enlightened,
  command,
  snatch,
  readRunes,
  runechant,
  kodachi,
  harmonized,
  sinkRed,
  sinkYellow,
  sinkBlue,
  sheath,
  sheathFoil,
  sheathPromo,
];

final index = PhotoCatalogIndex.build(catalog);

const attackRules = [
  'If this hits, draw a card.',
  'Go again',
  'Generic Attack Action',
];

List<String?> names(PhotoCardsResult result) =>
    [for (final d in result.detections) d.suggested?.name];

void main() {
  test('a grid of cards comes back as one confident card each, in order', () {
    final cells = [
      (photoGridCell(0, 0), 'Enlightened Strike', 'WTR159'),
      (photoGridCell(1, 0), 'Command and Conquer', 'ARC159'),
      (photoGridCell(0, 1), 'Snatch', 'WTR167'),
      (photoGridCell(1, 1), 'Harmonized Kodachi', 'WTR078'),
    ];
    final lines = <OcrLine>[
      for (final (cell, title, code) in cells)
        ...photoCard(
          x: cell.x,
          y: cell.y,
          title: title,
          rules: attackRules,
          code: code,
        ),
    ];

    final result = recognizePhotoCards(lines, index);

    expect(names(result), [
      'Enlightened Strike',
      'Command and Conquer',
      'Snatch',
      'Harmonized Kodachi',
    ]);
    expect(result.count(PhotoCardConfidence.confident), 4);
    expect(result.lineCount, lines.length);
    // Each card kept its own rules text and set code.
    for (final d in result.detections) {
      expect(d.text, contains('Go again'));
      expect(RegExp(r'[A-Z]{3}\d{3}').allMatches(d.text), hasLength(1));
    }
  });

  test('a fan of overlapping cards is read from the name lines alone', () {
    // Each card covers all but the name strip of the one before it.
    const step = photoTitleHeight * 2.5;
    final lines = <OcrLine>[
      ...photoCard(x: 40, y: 40, title: 'Enlightened Strike', titleOnly: true),
      ...photoCard(
          x: 40, y: 40 + step, title: 'Command and Conquer', titleOnly: true),
      ...photoCard(
        x: 40,
        y: 40 + step * 2,
        title: 'Snatch',
        rules: attackRules,
        code: 'WTR167',
      ),
    ];

    final result = recognizePhotoCards(lines, index);

    expect(names(result),
        ['Enlightened Strike', 'Command and Conquer', 'Snatch']);
    expect(result.count(PhotoCardConfidence.confident), 3);
    // The visible rules text belongs to the card on top.
    expect(result.detections[0].text, 'Enlightened Strike');
    expect(result.detections[2].text, contains('WTR167'));
  });

  test('a token named only in rules text is not picked', () {
    final lines = photoCard(
      x: 40,
      y: 40,
      title: 'Read the Runes',
      rules: const [
        'Create a Runechant token for each',
        'Runechant',
        'token you control.',
      ],
      code: 'ARC094',
    );

    final result = recognizePhotoCards(lines, index);

    expect(names(result), ['Read the Runes']);
    expect(result.detections.single.candidates.map((c) => c.name),
        isNot(contains('Runechant')));
  });

  test('a token card that is really in the photo is found', () {
    final lines = photoCard(
      x: 40,
      y: 40,
      title: 'Runechant',
      rules: const ['Aura Token', 'When you play an attack, destroy this.'],
    );

    final result = recognizePhotoCards(lines, index);

    expect(names(result), ['Runechant']);
    expect(result.detections.single.confidence, PhotoCardConfidence.confident);
  });

  test('a promo is chosen when its set code is read, and every printing of '
      'the card is offered', () {
    final lines = photoCard(
      x: 40,
      y: 40,
      title: 'Leaven Sheath',
      rules: const ['Once per turn, pay one resource.', 'Equipment'],
      code: 'FAB428',
    );

    final d = recognizePhotoCards(lines, index).detections.single;

    expect(d.confidence, PhotoCardConfidence.confident);
    expect(d.suggested?.id, 'ls-promo');
    expect(d.candidates.first.id, 'ls-promo');
    expect(d.candidates.map((c) => c.id).toSet(), {'ls-promo', 'ls', 'ls-f'});
  });

  test('without a set code the plain non-foil printing is suggested', () {
    final lines = photoCard(x: 40, y: 40, title: 'Leaven Sheath');

    final d = recognizePhotoCards(lines, index).detections.single;

    expect(d.confidence, PhotoCardConfidence.confident);
    expect(d.suggested?.id, 'ls');
  });

  test('pitch colours cannot be read, so the card is unsure until a set code '
      'settles it', () {
    final noCode = recognizePhotoCards(
      photoCard(x: 40, y: 40, title: 'Sink Below', rules: attackRules),
      index,
    ).detections.single;
    expect(noCode.confidence, PhotoCardConfidence.unsure);
    expect(noCode.note, PhotoCardNote.pickVersion);
    expect(noCode.candidates.map((c) => c.id).toSet(),
        {'sb-r', 'sb-y', 'sb-b'});

    final withCode = recognizePhotoCards(
      photoCard(
          x: 40, y: 40, title: 'Sink Below', rules: attackRules, code: 'WTR216'),
      index,
    ).detections.single;
    expect(withCode.confidence, PhotoCardConfidence.confident);
    expect(withCode.suggested?.id, 'sb-y');
  });

  test('a card whose name cannot be read is reported, not dropped', () {
    final a = photoGridCell(0, 0);
    final b = photoGridCell(1, 0);
    final lines = <OcrLine>[
      ...photoCard(
          x: a.x, y: a.y, title: 'Snatch', rules: attackRules, code: 'WTR167'),
      ...photoCard(
        x: b.x,
        y: b.y,
        title: 'Xq7 Zzvb',
        rules: const ['lorem ipsum dolor', 'sit amet consectetur', 'adipiscing'],
      ),
    ];

    final result = recognizePhotoCards(lines, index);

    expect(result.detections, hasLength(2));
    expect(result.detections[0].suggested?.name, 'Snatch');
    final unread = result.detections[1];
    expect(unread.confidence, PhotoCardConfidence.unrecognized);
    expect(unread.candidates, isEmpty);
    expect(unread.suggested, isNull);
    expect(unread.text, contains('lorem ipsum'));
    // The neighbour did not swallow the unreadable card's text.
    expect(result.detections[0].text, isNot(contains('lorem')));
  });

  test('a readable set code rescues an unreadable name, as unsure', () {
    final lines = photoCard(
      x: 40,
      y: 40,
      title: 'Xq7 Zzvb',
      rules: const ['lorem ipsum dolor', 'sit amet consectetur', 'WTR167'],
    );

    final d = recognizePhotoCards(lines, index).detections.single;

    expect(d.confidence, PhotoCardConfidence.unsure);
    expect(d.note, PhotoCardNote.setCodeOnly);
    expect(d.suggested?.name, 'Snatch');
  });

  test('the longer name wins over a shorter one inside it', () {
    final d = recognizePhotoCards(
      photoCard(x: 40, y: 40, title: 'Harmonized Kodachi'),
      index,
    ).detections.single;

    expect(d.suggested?.name, 'Harmonized Kodachi');
    expect(d.candidates.map((c) => c.name), isNot(contains('Kodachi')));
  });

  test('a card name inside a line of rules text does not start a new card',
      () {
    // "Create a Might token"-style lines: a one-word name has to be the whole
    // line to count as a printed name.
    final groups = groupPhotoLines(
      [
        ...photoCard(
          x: 40,
          y: 40,
          title: 'Enlightened Strike',
          rules: const ['Create a Snatch token', 'and draw a card.', 'Go again'],
        ),
      ],
      index,
    );

    expect(groups, hasLength(1));
    expect(groups.single.titleText, 'Enlightened Strike');
    expect(groups.single.lines, hasLength(4));
  });

  test('no text, or no catalog, finds nothing', () {
    expect(recognizePhotoCards(const [], index).detections, isEmpty);
    expect(
      recognizePhotoCards(
        photoCard(x: 0, y: 0, title: 'Snatch'),
        PhotoCatalogIndex.build(const []),
      ).detections,
      isEmpty,
    );
  });
}
