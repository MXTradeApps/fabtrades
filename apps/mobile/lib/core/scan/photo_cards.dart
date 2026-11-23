// Finds the separate cards in one still photo of several Flesh and Blood
// cards, from the text ML Kit read off it.
//
// Pure Dart (no Flutter / ML Kit imports) so it can be unit-tested with
// synthetic text boxes. The live scanner does not use this file: it reads one
// card inside an on-screen guide, while a photo has no guide and any number of
// cards. What carries over is the matching itself: `identifyCards` with a
// title band so a token named in rules text is not picked, set codes as an
// exact-match signal, and `expandScanMatchesToPrintings` so promos are offered.
// See docs/mobile/card-scanning-learnings.md.
//
// How a photo is split into cards:
//   1. A line is a card's printed name when most of its words are one catalog
//      name and it is not sitting inside a paragraph of rules text.
//   2. Every other line joins the nearest name line above it, within about one
//      card's size (estimated from the height of the name line).
//   3. Lines left over are clustered by proximity. A cluster big enough to be
//      a card's text box becomes a region of its own, so a card whose name
//      could not be read is reported as unrecognized instead of vanishing.
//
// The size ratios below are estimates from the card layout, not measured on
// real photos.

import '../data/card_repository.dart';
import '../models/card_model.dart';
import 'ocr_guide_filter.dart';

/// Share of a line's distinctive words that must belong to one card name for
/// the line to count as that card's printed name. Two thirds allows one stray
/// word next to a two-word name and none next to a one-word name, which keeps
/// "a Might token" in rules text from reading as the card Might.
const double kPhotoTitleCoverage = 0.66;

/// A card is roughly this many name-line heights tall. Lines further below a
/// name than this (plus [_kBelowSlack]) belong to another card.
const double kPhotoCardHeightInTitleHeights = 23;

/// Half a card's width in name-line heights, with slack for a name that is
/// not perfectly centred.
const double kPhotoCardHalfWidthInTitleHeights = 10;

const double _kBelowSlack = 1.1;

/// Leftover clusters need at least this many lines to be reported as a card
/// whose name could not be read; fewer is usually background text.
const int kPhotoMinOrphanLines = 3;

enum PhotoCardConfidence {
  /// The printed name was read in full and names one card.
  confident,

  /// Something matched, but the user should check it. See [PhotoCardNote].
  unsure,

  /// Text that looked like a card but matched nothing in the catalog.
  unrecognized,
}

/// Why a detection is not [PhotoCardConfidence.confident].
enum PhotoCardNote {
  none,

  /// The name is right but it has several versions that text cannot tell
  /// apart (Red / Yellow / Blue pitch) and no set code was read.
  pickVersion,

  /// The name line matched more than one card name.
  ambiguousName,

  /// The name was found in the card's text, not in its name line.
  nameOutsideTitle,

  /// Only the set code was read.
  setCodeOnly,

  /// Nothing matched.
  noMatch,
}

/// One card found in the photo.
class PhotoCardDetection {
  const PhotoCardDetection({
    required this.confidence,
    required this.note,
    required this.candidates,
    required this.suggested,
    required this.titleText,
    required this.text,
    required this.left,
    required this.top,
    required this.right,
    required this.bottom,
  });

  final PhotoCardConfidence confidence;
  final PhotoCardNote note;

  /// Every printing the user may pick from, best first. Empty when
  /// [confidence] is unrecognized.
  final List<CardModel> candidates;

  /// The printing to show first: the one whose set code was read, else the
  /// plainest non-foil printing. Null when unrecognized.
  final CardModel? suggested;

  /// Text of the name line, or empty when none was found.
  final String titleText;

  /// All text assigned to this card, in reading order.
  final String text;

  /// Extent of the text assigned to this card, in image pixels.
  final double left;
  final double top;
  final double right;
  final double bottom;
}

class PhotoCardsResult {
  const PhotoCardsResult({required this.detections, required this.lineCount});

  /// In reading order (top to bottom, then left to right).
  final List<PhotoCardDetection> detections;

  /// How many text lines went in.
  final int lineCount;

  int count(PhotoCardConfidence confidence) =>
      detections.where((d) => d.confidence == confidence).length;

  static const empty = PhotoCardsResult(detections: [], lineCount: 0);
}

class _NameEntry {
  _NameEntry(this.key, this.tokens);
  final String key;
  final List<String> tokens;
  final List<CardModel> cards = [];
}

/// Catalog lookups for [recognizePhotoCards], built once per catalog load.
///
/// `identifyCards` walks every row it is given, and a photo needs it once per
/// card. This index finds the few rows whose whole name appears in a piece of
/// text, so each call gets a short list instead of the full catalog. The
/// answer is the same: `identifyCards` only ever keeps rows whose every name
/// token is present.
class PhotoCatalogIndex {
  PhotoCatalogIndex._(this._byToken, this._byKey, this.tokenNames, this.setCodes);

  factory PhotoCatalogIndex.build(List<CardModel> catalog) {
    final byKey = <String, _NameEntry>{};
    final byToken = <String, List<_NameEntry>>{};
    final cards = <CardModel>[];
    for (final card in catalog) {
      if (isNonCardProduct(card)) continue;
      cards.add(card);
      final tokens = nameTokens(card.name);
      if (tokens.isEmpty) continue;
      final key = tokens.join(' ');
      var entry = byKey[key];
      if (entry == null) {
        entry = byKey[key] = _NameEntry(key, tokens);
        for (final token in tokens.toSet()) {
          (byToken[token] ??= []).add(entry);
        }
      }
      entry.cards.add(card);
    }
    return PhotoCatalogIndex._(
      byToken,
      byKey,
      tokenNameKeys(cards),
      buildSetCodeIndex(cards),
    );
  }

  final Map<String, List<_NameEntry>> _byToken;
  final Map<String, _NameEntry> _byKey;
  final Set<String> tokenNames;
  final SetCodeIndex setCodes;

  bool get isEmpty => _byKey.isEmpty;

  List<_NameEntry> _entriesIn(Set<String> words) {
    final seen = <String>{};
    final result = <_NameEntry>[];
    for (final word in words) {
      final entries = _byToken[word];
      if (entries == null) continue;
      for (final entry in entries) {
        if (seen.contains(entry.key)) continue;
        if (entry.tokens.every(words.contains)) {
          seen.add(entry.key);
          result.add(entry);
        }
      }
    }
    return result;
  }

  /// Every printing whose whole name appears in [words].
  List<CardModel> cardsNamedIn(Set<String> words) =>
      [for (final entry in _entriesIn(words)) ...entry.cards];

  /// Token count of the longest card name wholly inside [words], or 0.
  int longestNameIn(Set<String> words) {
    var best = 0;
    for (final entry in _entriesIn(words)) {
      if (entry.tokens.length > best) best = entry.tokens.length;
    }
    return best;
  }

  /// Every printing that shares its name tokens with one of [cards].
  List<CardModel> printingsNamedLike(Iterable<CardModel> cards) {
    final keys = <String>{};
    final result = <CardModel>[];
    for (final card in cards) {
      final key = _nameKey(card);
      if (!keys.add(key)) continue;
      result.addAll(_byKey[key]?.cards ?? const []);
    }
    return result;
  }
}

String _nameKey(CardModel card) => nameTokens(card.name).join(' ');

const Set<String> _stopwords = {
  'the', 'of', 'a', 'an', 'and', 'to', 'in', 'for', 'with',
};

List<String> _wordList(String text) => text
    .toLowerCase()
    .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
    .split(' ')
    .where((w) => w.isNotEmpty)
    .toList();

double _height(OcrLine l) => l.bottom - l.top;
double _cx(OcrLine l) => (l.left + l.right) / 2;
double _cy(OcrLine l) => (l.top + l.bottom) / 2;

int _readingOrder(OcrLine a, OcrLine b) {
  final dy = a.top.compareTo(b.top);
  return dy != 0 ? dy : a.left.compareTo(b.left);
}

/// True when [line] has a similar-sized line tight above or below it, i.e. it
/// sits inside a paragraph. A printed name has the art below it and at most
/// the small footer of another card above it.
bool _insideParagraph(OcrLine line, List<OcrLine> lines) {
  final h = _height(line);
  if (h <= 0) return false;
  for (final other in lines) {
    if (identical(other, line)) continue;
    final oh = _height(other);
    if (oh < h * 0.7 || oh > h * 1.4) continue;
    final overlap = (line.right < other.right ? line.right : other.right) -
        (line.left > other.left ? line.left : other.left);
    final narrower = (line.right - line.left) < (other.right - other.left)
        ? line.right - line.left
        : other.right - other.left;
    if (narrower <= 0 || overlap < narrower * 0.5) continue;
    final gap = other.top >= line.bottom
        ? other.top - line.bottom
        : line.top >= other.bottom
            ? line.top - other.bottom
            : 0.0;
    if (gap <= h * 0.6) return true;
  }
  return false;
}

bool _isTitleLine(OcrLine line, List<OcrLine> lines, PhotoCatalogIndex index) {
  final words = _wordList(line.text);
  final distinctive =
      words.where((w) => w.length >= 2 && !_stopwords.contains(w)).toList();
  if (distinctive.isEmpty) return false;
  final longest = index.longestNameIn(words.toSet());
  if (longest == 0) return false;
  if (longest / distinctive.length < kPhotoTitleCoverage) return false;
  return !_insideParagraph(line, lines);
}

class _Region {
  _Region(this.title);
  final OcrLine? title;
  final List<OcrLine> lines = [];
}

/// Splits [lines] into one group per card. Exposed for tests; callers want
/// [recognizePhotoCards].
List<({String titleText, List<OcrLine> lines})> groupPhotoLines(
  List<OcrLine> lines,
  PhotoCatalogIndex index,
) =>
    [
      for (final region in _group(lines, index))
        (titleText: region.title?.text ?? '', lines: region.lines),
    ];

List<_Region> _group(List<OcrLine> input, PhotoCatalogIndex index) {
  final lines = [
    for (final l in input)
      if (l.text.trim().isNotEmpty && _height(l) > 0) l,
  ];
  final regions = <_Region>[];
  final rest = <OcrLine>[];
  for (final line in lines) {
    if (_isTitleLine(line, lines, index)) {
      regions.add(_Region(line)..lines.add(line));
    } else {
      rest.add(line);
    }
  }

  final orphans = <OcrLine>[];
  for (final line in rest) {
    _Region? best;
    var bestCost = double.infinity;
    for (final region in regions) {
      final title = region.title!;
      final h = _height(title);
      final dy = (_cy(line) - _cy(title)) / h;
      if (dy < -1) continue;
      if (dy > kPhotoCardHeightInTitleHeights * _kBelowSlack) continue;
      final dx = (_cx(line) - _cx(title)).abs() / h;
      if (dx > kPhotoCardHalfWidthInTitleHeights) continue;
      final cost = dy.abs() + 2 * dx;
      if (cost < bestCost) {
        bestCost = cost;
        best = region;
      }
    }
    if (best == null) {
      orphans.add(line);
    } else {
      best.lines.add(line);
    }
  }

  for (final cluster in _cluster(orphans)) {
    if (cluster.length < kPhotoMinOrphanLines) continue;
    regions.add(_Region(null)..lines.addAll(cluster));
  }
  for (final region in regions) {
    region.lines.sort(_readingOrder);
  }
  return regions;
}

/// Groups lines that overlap horizontally and sit within about a line of each
/// other vertically.
List<List<OcrLine>> _cluster(List<OcrLine> lines) {
  final parent = List<int>.generate(lines.length, (i) => i);
  int find(int i) {
    while (parent[i] != i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  for (var i = 0; i < lines.length; i++) {
    for (var j = i + 1; j < lines.length; j++) {
      final a = lines[i];
      final b = lines[j];
      if (a.right < b.left || b.right < a.left) continue;
      final gap = b.top >= a.bottom
          ? b.top - a.bottom
          : a.top >= b.bottom
              ? a.top - b.bottom
              : 0.0;
      final h = _height(a) > _height(b) ? _height(a) : _height(b);
      if (gap <= h * 1.2) parent[find(i)] = find(j);
    }
  }
  final clusters = <int, List<OcrLine>>{};
  for (var i = 0; i < lines.length; i++) {
    (clusters[find(i)] ??= []).add(lines[i]);
  }
  return clusters.values.toList();
}

/// Plainest printing first: non-foil, then lowest rarity, then priced.
CardModel _plainest(List<CardModel> cards) {
  int score(CardModel c) =>
      (c.isFoil ? 1000 : 0) +
      rarityRank(c.rarity) * 2 +
      ((c.tcgMarket ?? c.tcgLow) == null ? 1 : 0);
  var best = cards.first;
  for (final c in cards.skip(1)) {
    if (score(c) < score(best)) best = c;
  }
  return best;
}

PhotoCardDetection _match(_Region region, PhotoCatalogIndex index) {
  final lines = region.lines;
  final text = lines.map((l) => l.text).join('\n');
  // Without a name line, the top of the text found stands in for it, as the
  // live scanner does when nothing lands in its guide.
  final title =
      region.title?.text ?? textInsideDetectedBounds(lines).titleBandText;

  var left = lines.first.left, top = lines.first.top;
  var right = lines.first.right, bottom = lines.first.bottom;
  for (final l in lines) {
    if (l.left < left) left = l.left;
    if (l.top < top) top = l.top;
    if (l.right > right) right = l.right;
    if (l.bottom > bottom) bottom = l.bottom;
  }

  PhotoCardDetection result(
    PhotoCardConfidence confidence,
    PhotoCardNote note,
    List<CardModel> candidates,
    CardModel? suggested,
  ) =>
      PhotoCardDetection(
        confidence: confidence,
        note: note,
        candidates: candidates,
        suggested: suggested,
        titleText: region.title?.text ?? '',
        text: text,
        left: left,
        top: top,
        right: right,
        bottom: bottom,
      );

  final pool = index.cardsNamedIn(_wordList(text).toSet());
  var named = title.trim().isEmpty
      ? const <CardModel>[]
      : identifyCards(
          pool,
          title,
          limit: 500,
          titleText: title,
          tokenNames: index.tokenNames,
        );
  final fromTitle = named.isNotEmpty;
  if (!fromTitle) {
    named = identifyCards(
      pool,
      text,
      limit: 500,
      titleText: title.trim().isEmpty ? null : title,
      tokenNames: index.tokenNames,
    );
  }
  // The longest name wins, so "Harmonized Kodachi" beats a bare "Kodachi".
  if (named.isNotEmpty) {
    var longest = 0;
    for (final c in named) {
      final n = nameTokens(c.name).length;
      if (n > longest) longest = n;
    }
    named = [
      for (final c in named)
        if (nameTokens(c.name).length == longest) c,
    ];
  }

  final codeCards = findBySetCodes(index.setCodes, parseSetCodes(text));

  if (named.isEmpty) {
    if (codeCards.isEmpty) {
      return result(
          PhotoCardConfidence.unrecognized, PhotoCardNote.noMatch, const [], null);
    }
    final expanded = expandScanMatchesToPrintings(
      index.printingsNamedLike(codeCards),
      codeCards,
      ocrText: text,
      limit: 200,
    ).cards;
    return result(PhotoCardConfidence.unsure, PhotoCardNote.setCodeOnly,
        expanded, codeCards.first);
  }

  final nameKeys = {for (final c in named) _nameKey(c)};
  // A set code only counts when it agrees with the name that was read.
  final agreeing = [
    for (final c in codeCards)
      if (nameKeys.contains(_nameKey(c))) c,
  ];
  final agreeingIds = {for (final c in agreeing) c.id};
  final ranked = [
    ...agreeing,
    for (final c in named)
      if (!agreeingIds.contains(c.id)) c,
  ];
  final candidates = expandScanMatchesToPrintings(
    index.printingsNamedLike(ranked),
    ranked,
    ocrText: text,
    limit: 200,
  ).cards;

  final CardModel suggested;
  final PhotoCardConfidence confidence;
  final PhotoCardNote note;
  if (!fromTitle) {
    suggested = _plainest(agreeing.isNotEmpty ? agreeing : candidates);
    confidence = PhotoCardConfidence.unsure;
    note = PhotoCardNote.nameOutsideTitle;
  } else if (nameKeys.length > 1) {
    suggested = _plainest(agreeing.isNotEmpty ? agreeing : candidates);
    confidence = PhotoCardConfidence.unsure;
    note = PhotoCardNote.ambiguousName;
  } else if (agreeing.isNotEmpty) {
    suggested = _plainest(agreeing);
    confidence = PhotoCardConfidence.confident;
    note = PhotoCardNote.none;
  } else {
    suggested = _plainest(candidates);
    // Pitch colour is part of which card this is, and it is not printed as
    // text. Without a set code the name alone cannot choose between them.
    final versions = {for (final c in candidates) cardGroupName(c)};
    final single = versions.length == 1;
    confidence =
        single ? PhotoCardConfidence.confident : PhotoCardConfidence.unsure;
    note = single ? PhotoCardNote.none : PhotoCardNote.pickVersion;
  }
  return result(confidence, note, candidates, suggested);
}

/// Finds the cards in a photo from its recognized text [lines] (boxes in
/// upright image pixels). Runs fully offline against [index].
PhotoCardsResult recognizePhotoCards(
  List<OcrLine> lines,
  PhotoCatalogIndex index,
) {
  if (lines.isEmpty || index.isEmpty) {
    return PhotoCardsResult(detections: const [], lineCount: lines.length);
  }
  final detections = [
    for (final region in _group(lines, index)) _match(region, index),
  ]..sort((a, b) {
      // Same row when the tops are within half the shorter region's height.
      final ha = a.bottom - a.top;
      final hb = b.bottom - b.top;
      final rowTolerance = (ha < hb ? ha : hb) / 2;
      if ((a.top - b.top).abs() > rowTolerance) return a.top.compareTo(b.top);
      return a.left.compareTo(b.left);
    });
  return PhotoCardsResult(detections: detections, lineCount: lines.length);
}
