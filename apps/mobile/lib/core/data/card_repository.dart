import 'package:supabase_flutter/supabase_flutter.dart';

import '../logic/recent_movers.dart';
import '../logic/set_sort.dart';
import '../models/card_model.dart';
import 'set_published_on.dart';

enum CardSort {
  nameAsc('Name (A–Z)'),
  priceDesc('Price (high → low)'),
  priceAsc('Price (low → high)'),
  numberAsc('Collector #');

  const CardSort(this.label);
  final String label;
}

class CardFilters {
  final String query;
  final String? setName;
  final bool foilOnly;
  final CardSort sort;

  const CardFilters({
    this.query = '',
    this.setName,
    this.foilOnly = false,
    this.sort = CardSort.nameAsc,
  });

  /// Filters the user can toggle while browsing a set (set itself excluded).
  bool get hasActiveFilters => foilOnly || sort != CardSort.nameAsc;

  CardFilters copyWith({
    String? query,
    Object? setName = _sentinel,
    bool? foilOnly,
    CardSort? sort,
  }) =>
      CardFilters(
        query: query ?? this.query,
        setName: setName == _sentinel ? this.setName : setName as String?,
        foilOnly: foilOnly ?? this.foilOnly,
        sort: sort ?? this.sort,
      );

  static const _sentinel = Object();
}

/// Builds the lowercased text a card is searched against: its name, plus
/// cleanName and collectorNumber when present (so number lookups still work).
String _searchableText(CardModel c) {
  final buffer = StringBuffer(c.name);
  if (c.cleanName != null) buffer..write(' ')..write(c.cleanName);
  if (c.collectorNumber != null) buffer..write(' ')..write(c.collectorNumber);
  return buffer.toString().toLowerCase();
}

/// Natural, token-based query matching: the query is split on whitespace into
/// tokens and a card matches when EVERY token appears somewhere in its
/// searchable text. This lets "Vex a" match "Vex - Apathetic" even though the
/// separator means "vex a" isn't a contiguous substring of the name.
bool _matchesQuery(CardModel c, List<String> tokens) {
  if (tokens.isEmpty) return true;
  final text = _searchableText(c);
  for (final t in tokens) {
    if (!text.contains(t)) return false;
  }
  return true;
}

/// Tokenizes a search query the same way Browse and Binder do (whitespace-
/// split, lowercased, empty tokens dropped).
List<String> queryTokens(String query) => query
    .toLowerCase()
    .split(RegExp(r'\s+'))
    .where((t) => t.isNotEmpty)
    .toList();

/// Whether [card] passes the non-sort parts of [filters] (query / set / foil).
/// When [excludeNonCards] is true, sealed-style products are dropped (Browse).
bool cardPassesFilters(
  CardModel card,
  CardFilters filters, {
  List<String>? tokens,
  bool excludeNonCards = true,
}) {
  if (excludeNonCards && isNonCardProduct(card)) return false;
  if (!_matchesQuery(card, tokens ?? queryTokens(filters.query))) return false;
  if (filters.setName != null && card.setName != filters.setName) return false;
  if (filters.foilOnly && !card.isFoil) return false;
  return true;
}

int _compareNullablePrice(double? a, double? b, {required bool asc}) {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last
  if (b == null) return -1;
  return asc ? a.compareTo(b) : b.compareTo(a);
}

/// Shared card ordering for Browse, Binder, and grouped browse views.
int compareCards(CardModel a, CardModel b, CardSort sort) {
  switch (sort) {
    case CardSort.nameAsc:
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    case CardSort.priceDesc:
      return _compareNullablePrice(a.tcgMarket, b.tcgMarket, asc: false);
    case CardSort.priceAsc:
      return _compareNullablePrice(a.tcgMarket, b.tcgMarket, asc: true);
    case CardSort.numberAsc:
      final an = a.collectorNumber;
      final bn = b.collectorNumber;
      if (an == null && bn == null) return 0;
      if (an == null) return 1;
      if (bn == null) return -1;
      return an.compareTo(bn);
  }
}

/// Filters and sorts any list by its associated [CardModel], reusing the same
/// query / foil / set / sort rules as Browse.
List<T> filterByCardFilters<T>(
  Iterable<T> items,
  CardModel Function(T) toCard,
  CardFilters filters, {
  bool excludeNonCards = true,
}) {
  final tokens = queryTokens(filters.query);
  final list = items
      .where((item) => cardPassesFilters(
            toCard(item),
            filters,
            tokens: tokens,
            excludeNonCards: excludeNonCards,
          ))
      .toList();
  list.sort(
      (a, b) => compareCards(toCard(a), toCard(b), filters.sort));
  return list;
}

/// Applies [filters] to an in-memory catalog (used for instant, offline
/// browsing). Mirrors the ordering the database previously produced.
List<CardModel> filterCards(List<CardModel> all, CardFilters filters) =>
    filterByCardFilters(all, (c) => c, filters);

// ---------------------------------------------------------------------------
// Grouping printings by card name (for the grouped Browse view)
// ---------------------------------------------------------------------------

/// All printings/versions that share a single card name, plus the
/// "representative" printing whose price/art is shown on the collapsed row.
class CardGroup {
  const CardGroup({
    required this.name,
    required this.representative,
    required this.versions,
  });

  final String name;

  /// The base-rarity printing used for the collapsed row (see [_baseFirst]).
  final CardModel representative;

  /// Every printing in this group (base first), e.g. Normal / Foil / alt-art.
  final List<CardModel> versions;

  bool get hasMultiple => versions.length > 1;
}

/// Whether a catalog row is a sealed-style *product* rather than a real card —
/// e.g. "Origins - Champion Deck (Jinx)", box sets, Nexus Night promo packs,
/// pre-rift kits or bulk runes. These slip past the `is_sealed` filter but
/// uniquely lack BOTH a rarity and a collector number (real cards, including
/// numberless promos like "Buff", always have at least a rarity), so they are
/// hidden from browse/search and version lists.
bool isNonCardProduct(CardModel c) {
  final noRarity =
      c.rarity == null || c.rarity!.trim().isEmpty || c.rarity == 'None';
  final noNumber =
      c.collectorNumber == null || c.collectorNumber!.trim().isEmpty;
  return noRarity && noNumber;
}

/// True when this printing is a Flesh and Blood token (Runechant, Frostbite,
/// Gold, …). `card_type` is a semicolon-delimited multi-value field, so a
/// double-faced token reads "Hero;Token" or "Token;Weapon".
///
/// Rarity alone is not trustworthy: TCGplayer stamps `rarity = 'Token'` on
/// ordinary playable cards printed on token/deck-insert sheets (Harmonized
/// Kodachi, Phoenix Flame, Dorinthea, …). Treating that as token-ness poisons
/// ~255 real card names into [tokenNameKeys], which then forces every scan of
/// those cards through the title-band gate and makes them unmatchable from
/// guide OCR. Rarity is consulted only when `card_type` is null/blank, which
/// recovers a handful of token-only rows (Marked, Fealty) that lack a type.
bool isTokenCard(CardModel card) {
  final type = card.cardType;
  if (type == null || type.trim().isEmpty) {
    return card.rarity?.toLowerCase() == 'token';
  }
  for (final part in type.split(';')) {
    if (part.trim().toLowerCase() == 'token') return true;
  }
  return false;
}

/// Lowercase alphanumeric key for name-set membership. Built from
/// [baseCardName] so pitch qualifiers like "(Red)" stay in the key when
/// present; token names have no pitch, so they collapse to a bare slug
/// (e.g. "Runechant" → "runechant").
String _cardNameMatchKey(String name) {
  return baseCardName(name)
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
      .trim()
      .replaceAll(RegExp(r'\s+'), ' ');
}

/// The [baseCardName] keys (normalized via [_cardNameMatchKey]) of every card
/// that names a token somewhere in [catalog]. Derived across printings because
/// `card_type` is null on a few token rows — a sibling printing of the same
/// name supplies the type. Used so a null-typed "Runechant" row is still
/// treated as a token when matching OCR that only mentions it in rules text.
Set<String> tokenNameKeys(List<CardModel> catalog) {
  final keys = <String>{};
  for (final card in catalog) {
    if (isTokenCard(card)) keys.add(_cardNameMatchKey(card.name));
  }
  return keys;
}

/// Trailing ` - <SETCODE>` that TCGplayer appends to promo card names
/// (`"Leaven Sheath - FAB428"`, `"Sap (Yellow) - FAB116"`). Letters in the
/// code must be uppercase so hero-style names (`"Ahri - Inquisitive"`,
/// `"Vex - Apathetic"`) never match. Optional leading digit covers
/// `1HB001`-style codes. Verified against the live `fab_cards_with_prices`
/// catalog: 1,185 of 1,263 names containing `" - "` match this shape, and a
/// manual review of the 21 rows whose suffix differs from `collector_number`
/// found zero false positives (only source typos, composites, or finish
/// suffixes). Parentheticals always precede the code when both are present
/// (`"Zipper Hit (Yellow) (Marvel) - TNP029"`).
final RegExp _nameSetCodeSuffixRe =
    RegExp(r'\s+-\s+([A-Z0-9]*[A-Z]+[0-9]+)\s*$');

/// The trailing ` - <SETCODE>` suffix TCGplayer appends to promo card names
/// (`"Leaven Sheath - FAB428"`, `"Sap (Yellow) - FAB116"`), or null when the
/// name carries none.
///
/// Of ~16.8k non-sealed catalog rows, 1,185 embed a set code this way — almost
/// all in "Flesh and Blood: Promo Cards". The shape is capital letters (at
/// least one) followed by digits, optionally preceded by a digit so codes like
/// `1HB001` match; lowercase hero-name suffixes (`"Ahri - Inquisitive"`) are
/// deliberately excluded. When present, the suffix is a catalog convention
/// that is also printed on the card as the collector number, but it is NOT
/// part of the card's identity for grouping or name matching.
String? nameSetCode(String name) =>
    _nameSetCodeSuffixRe.firstMatch(name.trim())?.group(1);

/// [name] with any trailing ` - <SETCODE>` suffix removed. Returns [name]
/// unchanged when there is no suffix, or when stripping would leave only
/// whitespace (a name that is somehow only a code separator).
///
/// Used by [baseCardName], [nameQualifier], and [nameTokens] so promo rows
/// like `"Leaven Sheath - FAB428"` join their base card for Browse grouping,
/// the printing selector, and scan matching — without requiring OCR to resolve
/// the tiny bottom-left set code.
String stripNameSetCode(String name) {
  final trimmed = name.trim();
  final stripped = trimmed.replaceFirst(_nameSetCodeSuffixRe, '').trim();
  return stripped.isEmpty ? trimmed : stripped;
}

/// The trailing parenthetical qualifier of a variant name, e.g.
/// "Ahri - Inquisitive (Overnumbered)" -> "Overnumbered", or null when the name
/// carries no qualifier. A trailing set-code suffix is stripped first so
/// `"Zipper Hit (Yellow) (Marvel) - TNP029"` yields `"Marvel"` (the art
/// qualifier chip on the printing selector) rather than null.
String? nameQualifier(String name) {
  final match =
      RegExp(r'\(([^)]*)\)\s*$').firstMatch(stripNameSetCode(name).trim());
  return match?.group(1);
}

/// Pitch colors are part of a Flesh and Blood card's identity: "Sink Below
/// (Red)", "Sink Below (Yellow)" and "Sink Below (Blue)" are three DIFFERENT
/// cards, so their parenthetical must be preserved when grouping.
const Set<String> _pitchQualifiers = {'red', 'yellow', 'blue'};

/// The base card name shared by every art/finish variant of a card, produced by
/// first stripping any trailing ` - <SETCODE>` promo suffix (see
/// [stripNameSetCode]), then stripping trailing parenthetical qualifiers like
/// "(Alternate Art)", "(Extended Art)" or "(1st Edition)" — catalog conventions
/// that are not part of the real card name. Pitch-color qualifiers ("(Red)",
/// "(Yellow)", "(Blue)") are deliberately KEPT so the three pitch versions of a
/// card stay distinct groups.
///
/// Order matters: set codes come after parentheticals in real names
/// (`"Zipper Hit (Yellow) (Marvel) - TNP029"`), so stripping the code first
/// leaves `"(Marvel)"` for the art-qualifier loop and keeps `"(Yellow)"` as
/// pitch. Without the code strip, 1,185 promo rows were orphaned from their
/// base card in Browse grouping, [printingsForCard], and scan expansion.
String baseCardName(String name) {
  var s = stripNameSetCode(name);
  final re = RegExp(r'\s*\(([^)]*)\)\s*$');
  while (true) {
    final m = re.firstMatch(s);
    if (m == null) break;
    final inner = m.group(1)!.trim().toLowerCase();
    if (_pitchQualifiers.contains(inner)) break; // keep pitch color in the key
    final stripped = s.replaceFirst(re, '').trim();
    if (stripped.isEmpty) break; // don't strip a name that is only "(...)"
    s = stripped;
  }
  return s;
}

/// Ordering of Flesh and Blood rarities from most "base"/standard (0) to most
/// premium, used to choose which printing represents a group. Unknown rarities
/// sort last.
int rarityRank(String? rarity) {
  switch (rarity?.toLowerCase()) {
    case 'token':
    case 'basic':
      return 0;
    case 'common':
      return 1;
    case 'rare':
      return 2;
    case 'super rare':
      return 3;
    case 'majestic':
      return 4;
    case 'legendary':
      return 5;
    case 'fabled':
      return 6;
    case 'marvel':
      return 7;
    case 'promo':
      return 8;
    default:
      return 9;
  }
}

/// First run of digits in a collector number like "147/219" -> 147, used to
/// order printings within a group. Returns null when there is no number.
int? _leadingNumber(String? raw) {
  if (raw == null) return null;
  final match = RegExp(r'\d+').firstMatch(raw);
  return match == null ? null : int.tryParse(match.group(0)!);
}

/// Comparator that puts the most "base" printing first: non-foil before foil,
/// then lowest rarity, then a printing that actually has a price, then lowest
/// collector number. Used both to pick the representative and to order the
/// version list.
int _baseFirst(CardModel a, CardModel b) {
  if (a.isFoil != b.isFoil) return a.isFoil ? 1 : -1;
  final ra = rarityRank(a.rarity);
  final rb = rarityRank(b.rarity);
  if (ra != rb) return ra.compareTo(rb);
  final ap = a.tcgMarket ?? a.tcgLow;
  final bp = b.tcgMarket ?? b.tcgLow;
  if ((ap == null) != (bp == null)) return ap == null ? 1 : -1;
  final an = _leadingNumber(a.collectorNumber);
  final bn = _leadingNumber(b.collectorNumber);
  if (an != null && bn != null && an != bn) return an.compareTo(bn);
  return a.id.compareTo(b.id);
}

/// Groups [cards] by their [baseCardName] into [CardGroup]s, so every art/finish
/// variant of a card (e.g. Normal, Foil, Alternate Art, Overnumbered, Signature)
/// collapses into one entry. Groups are ordered by the requested [sort] (applied
/// to each group's representative printing). Assumes [cards] has already been
/// filtered by [filterCards].
List<CardGroup> groupCardsByName(List<CardModel> cards, CardSort sort) {
  final byName = <String, List<CardModel>>{};
  final order = <String>[];
  for (final c in cards) {
    final key = baseCardName(c.name);
    final list = byName[key];
    if (list == null) {
      byName[key] = [c];
      order.add(key);
    } else {
      list.add(c);
    }
  }

  final groups = <CardGroup>[];
  for (final key in order) {
    final versions = byName[key]!..sort(_baseFirst);
    groups.add(CardGroup(
      name: key,
      representative: versions.first,
      versions: versions,
    ));
  }

  // Name sort uses the base group key (pitch colors kept, art qualifiers
  // stripped). Other sorts use the representative printing's fields.
  if (sort == CardSort.nameAsc) {
    groups.sort(
        (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  } else {
    groups.sort(
        (a, b) => compareCards(a.representative, b.representative, sort));
  }
  return groups;
}

/// All printings/variants of [card] found in the in-memory [catalog], i.e.
/// every row whose [baseCardName] matches (Normal, Foil, Alternate Art,
/// Overnumbered, Signature, … across every set), ordered base-first. Used by
/// the card detail screen's printing/version selector.
List<CardModel> printingsForCard(List<CardModel> catalog, CardModel card) {
  final base = baseCardName(card.name);
  final list = catalog
      .where((c) => !isNonCardProduct(c) && baseCardName(c.name) == base)
      .toList()
    ..sort(_baseFirst);
  return list.isEmpty ? [card] : list;
}

// ---------------------------------------------------------------------------
// Card scanning / OCR identification (runs fully offline against the catalog)
// ---------------------------------------------------------------------------

/// A collector number split into its printing index and (optional) set size,
/// e.g. "124/221" -> number 124, total 221. The `*` used by signature variants
/// ("225*/221") is ignored so it still parses to 225.
class ScanNumber {
  const ScanNumber(this.number, this.total);
  final int number;
  final int? total;
}

/// Matches a fractional "NNN/TTT" collector number (kept for robustness). Note
/// that most Flesh and Blood cards instead print a set-code identifier such as
/// "WTR001" or "1HB007" that carries no denominator, so scanning falls back to
/// name-based matching for those (see [identifyCards]).
final RegExp collectorNumberRegex = RegExp(r'(\d{1,3})\s*\*?\s*/\s*(\d{1,3})');

/// Every fractional "NNN/TTT" collector number found in a block of (OCR) text,
/// in reading order. Used both to gather candidates in [identifyCards] and to
/// boost the fused ranking in [fuseScanCandidates].
List<ScanNumber> parseScanNumbers(String text) => [
      for (final m in collectorNumberRegex.allMatches(text))
        ScanNumber(int.parse(m.group(1)!), int.parse(m.group(2)!)),
    ];

/// Parses a stored/scanned collector number. Falls back to a bare number when
/// no denominator is present.
ScanNumber? parseScanNumber(String? raw) {
  if (raw == null) return null;
  final pair = collectorNumberRegex.firstMatch(raw);
  if (pair != null) {
    return ScanNumber(int.parse(pair.group(1)!), int.parse(pair.group(2)!));
  }
  final single = RegExp(r'\d{1,4}').firstMatch(raw);
  if (single != null) return ScanNumber(int.parse(single.group(0)!), null);
  return null;
}

/// Common words dropped from name matching so they don't inflate overlap.
const Set<String> _nameStopwords = {
  'the', 'of', 'a', 'an', 'and', 'to', 'in', 'for', 'with',
};

/// The distinctive lowercase tokens of a card name, with any trailing
/// ` - <SETCODE>` promo suffix and any parenthetical qualifier (e.g.
/// "(Overnumbered)", "(Metal)") removed — those tags are catalog conventions
/// and are NOT (or not reliably) printed as part of the card's title.
///
/// WHY the set code is stripped here: [identifyCards] requires 100% token
/// overlap, and without this strip `"Leaven Sheath - FAB428"` tokenizes to
/// `["leaven","sheath","fab428"]`. The name is then matchable ONLY when OCR
/// also resolves the ~6pt bottom-left set code — which is exactly the
/// reported promo-scan failure mode. Stripping makes the promo matchable from
/// the printed title alone; set-code agreement is handled separately as an
/// additive fusion bonus (see [fuseScanCandidates] / [parseSetCodes]).
List<String> nameTokens(String name) {
  final withoutCode = stripNameSetCode(name);
  final withoutParens = withoutCode.replaceAll(RegExp(r'\([^)]*\)'), ' ');
  final normalized =
      withoutParens.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ');
  return normalized
      .split(' ')
      .where((t) => t.length >= 2 && !_nameStopwords.contains(t))
      .toList();
}

/// Lowercased set of alphanumeric words in [text] (apostrophes/punctuation are
/// stripped so "Kai'Sa" -> "kaisa" matches the catalog's cleaned "KaiSa").
Set<String> _wordSet(String text) =>
    text.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ').split(' ').where((t) => t.isNotEmpty).toSet();

/// Fraction of a card's distinctive name tokens present in [ocrWords] (0–1).
double _nameOverlap(CardModel card, Set<String> ocrWords) {
  final tokens = nameTokens(card.name);
  if (tokens.isEmpty) return 0;
  var matched = 0;
  for (final t in tokens) {
    if (ocrWords.contains(t)) matched++;
  }
  return matched / tokens.length;
}

/// Identifies the most likely card printings for a block of OCR
/// [recognizedText] against the in-memory [catalog]. Runs fully offline.
///
/// Strategy: when a printed "NNN/TTT" collector number is present it is the
/// most reliable identifier, so it is used first to gather candidates
/// (preferring matches where the set-size denominator also agrees). Most Flesh
/// and Blood cards lack that format, so scanning relies mainly on name. The card
/// name is then used to pick the right set/variant and to disambiguate numbers
/// that repeat across sets. When no number can be read, it falls back to a
/// strict name-only match. Returns [] when nothing is confident, best first.
///
/// [titleText] is OCR from the card's printed-name band (top of the card). It
/// may be a subset of [recognizedText], equal to it, or null/blank when
/// position is unknown. Token cards (Runechant, Frostbite, …) are a special
/// hazard: many non-token cards say "Create a Runechant token…" in rules text,
/// and a bag-of-words match against the whole guide region will happily rank
/// the token as a 100% name hit. When [titleText] is present, a token
/// candidate is kept only if every distinctive name token appears in that
/// title band. When [titleText] is null/blank there is no positional signal,
/// so a token is rejected if a create/creates/created cue sits within a few
/// words before its name in [recognizedText] — but NOT merely because the
/// word "token" follows the name (real token cards print "Token" on their
/// type line). Non-token candidates are unaffected.
///
/// [tokenNames] is the precomputed set from [tokenNameKeys]. Pass it from a
/// memoized provider on the live scanner — recomputing it inside every call
/// walks the whole ~10k-row catalog (with [baseCardName] per row) and the
/// camera path invokes this up to twice per frame. When null, the set is
/// derived from [catalog] as before so unit tests and one-shot callers stay
/// simple.
///
/// [onTokensSuppressed] receives how many token candidates the title /
/// creation-cue gate rejected in this call — same optional-stats pattern as
/// `CardHashIndex.match`'s `onStats`, so the scan overlay can surface
/// `tokSup=` without changing the return type.
List<CardModel> identifyCards(
  List<CardModel> catalog,
  String recognizedText, {
  int limit = 12,
  String? titleText,
  Set<String>? tokenNames,
  void Function(int)? onTokensSuppressed,
}) {
  if (catalog.isEmpty || recognizedText.trim().isEmpty) {
    onTokensSuppressed?.call(0);
    return const [];
  }
  final ocrWords = _wordSet(recognizedText);
  final ocrNumbers = parseScanNumbers(recognizedText);
  final tokenKeys = tokenNames ?? tokenNameKeys(catalog);
  var suppressed = 0;

  bool accept(CardModel card, List<String> tokens) {
    final ok = _acceptTokenScanCandidate(
      card,
      tokens,
      tokenKeys,
      recognizedText: recognizedText,
      titleText: titleText,
    );
    if (!ok) suppressed++;
    return ok;
  }

  List<CardModel> finish(List<CardModel> result) {
    onTokensSuppressed?.call(suppressed);
    return result;
  }

  if (ocrNumbers.isNotEmpty) {
    final numeratorMatches = <CardModel>[];
    final fullMatches = <CardModel>[];
    for (final card in catalog) {
      final parsed = parseScanNumber(card.collectorNumber);
      if (parsed == null) continue;
      for (final n in ocrNumbers) {
        if (parsed.number != n.number) continue;
        numeratorMatches.add(card);
        if (parsed.total != null && parsed.total == n.total) {
          fullMatches.add(card);
        }
        break;
      }
    }
    // Prefer candidates whose set size (denominator) also matched.
    final candidates = fullMatches.isNotEmpty ? fullMatches : numeratorMatches;
    if (candidates.isNotEmpty) {
      // Tokens can share a collector-number hit with unrelated OCR; apply the
      // same title / creation-cue gate before ranking by name.
      final filtered = <CardModel>[
        for (final c in candidates)
          if (accept(c, nameTokens(c.name))) c,
      ];
      if (filtered.isNotEmpty) {
        return finish(_rankByName(filtered, ocrWords, limit));
      }
      // All number hits were tokens rejected by the gate — try name-only.
    }
  }

  // Fallback: no usable number was read — require every distinctive name token
  // to be present (avoids false hits from ability/flavour text), and prefer
  // cards whose names have MORE distinctive tokens so "Harmonized Kodachi"
  // outranks a shorter name that also fully matched a subset of the OCR words.
  final scored = <MapEntry<CardModel, int>>[];
  for (final card in catalog) {
    final tokens = nameTokens(card.name);
    if (tokens.isEmpty) continue;
    if (_nameOverlap(card, ocrWords) < 1.0) continue;
    if (!accept(card, tokens)) continue;
    scored.add(MapEntry(card, tokens.length));
  }
  if (scored.isEmpty) return finish(const []);
  scored.sort((a, b) => b.value.compareTo(a.value));
  return finish([for (final e in scored.take(limit)) e.key]);
}

/// Whether a scan candidate should be kept after the token-mention guards.
/// Non-tokens always pass. See [identifyCards] for the title / creation-cue
/// semantics this encodes.
bool _acceptTokenScanCandidate(
  CardModel card,
  List<String> tokens,
  Set<String> tokenKeys, {
  required String recognizedText,
  String? titleText,
}) {
  final isToken = isTokenCard(card) ||
      tokenKeys.contains(_cardNameMatchKey(card.name));
  if (!isToken) return true;

  final title = titleText?.trim();
  if (title != null && title.isNotEmpty) {
    final titleWords = _wordSet(title);
    for (final t in tokens) {
      if (!titleWords.contains(t)) return false;
    }
    return true;
  }
  return !_hasTokenCreationCue(recognizedText, tokens);
}

/// True when create/creates/created appears within roughly 4 words before an
/// occurrence of the candidate's distinctive name tokens in [text]. Guards the
/// no-titleText fallback so "Create a Runechant token…" does not identify the
/// Runechant token card.
bool _hasTokenCreationCue(String text, List<String> nameTokens) {
  if (nameTokens.isEmpty) return false;
  final words = text
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
      .split(' ')
      .where((t) => t.isNotEmpty)
      .toList();
  const verbs = {'create', 'creates', 'created'};
  final n = nameTokens.length;
  for (var i = 0; i <= words.length - n; i++) {
    var matches = true;
    for (var j = 0; j < n; j++) {
      if (words[i + j] != nameTokens[j]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;
    final from = i > 4 ? i - 4 : 0;
    for (var k = from; k < i; k++) {
      if (verbs.contains(words[k])) return true;
    }
  }
  return false;
}

/// Fuses the scanner's candidate lists — visual (perceptual-hash), OCR
/// (name / fractional collector-number), and optional set-code matches — into
/// one ranking using Reciprocal Rank Fusion: score(card) = Σ 1/(k + rank in
/// each list). A card found by BOTH visual and OCR therefore outranks one
/// found by either alone, which is how production scanners disambiguate
/// near-identical printings.
///
/// When [ocrNumbers] holds fractional collector numbers read off the card, any
/// candidate whose own collector number agrees gets a [numberBonus].
///
/// When [ocrCodes] holds set-code keys (from [parseSetCodes]), any candidate
/// whose [collectorNumberKey] or [nameSetCode]-derived key agrees gets a
/// [setCodeBonus]. Default `1.0` is sized so an exact code agreement decisively
/// outranks a card found by both visual and OCR: with `k = 3.0` a both-signals
/// card at rank 0 in each list scores `1/3 + 1/3 ≈ 0.667`, so `+1.0` wins.
/// Set codes are matched by exact equality against catalog keys, so OCR
/// garbage matches nothing and can never *replace* the name signal — only
/// boost a candidate already (or newly) in the fusion pool via [code].
///
/// [code] and [ocrCodes] default empty so every existing caller and test keeps
/// today's ranking unchanged.
List<CardModel> fuseScanCandidates({
  required List<CardModel> visual,
  required List<CardModel> ocr,
  List<CardModel> code = const [],
  List<ScanNumber> ocrNumbers = const [],
  List<String> ocrCodes = const [],
  double numberBonus = 0.5,
  double setCodeBonus = 1.0,
  int limit = 12,
}) {
  if (visual.isEmpty && ocr.isEmpty && code.isEmpty) return const [];

  const k = 3.0;
  final scores = <String, double>{};
  final byId = <String, CardModel>{};
  void addList(List<CardModel> list) {
    for (var i = 0; i < list.length; i++) {
      final card = list[i];
      byId[card.id] = card;
      scores[card.id] = (scores[card.id] ?? 0) + 1 / (k + i);
    }
  }

  addList(visual);
  addList(ocr);
  addList(code);

  if (ocrNumbers.isNotEmpty) {
    for (final entry in byId.entries) {
      final parsed = parseScanNumber(entry.value.collectorNumber);
      if (parsed == null) continue;
      final agrees = ocrNumbers.any((n) =>
          n.number == parsed.number &&
          (n.total == null || parsed.total == null || n.total == parsed.total));
      if (agrees) scores[entry.key] = (scores[entry.key] ?? 0) + numberBonus;
    }
  }

  if (ocrCodes.isNotEmpty) {
    final codeSet = ocrCodes.toSet();
    for (final entry in byId.entries) {
      final card = entry.value;
      final cnKey = collectorNumberKey(card.collectorNumber);
      if (cnKey != null && codeSet.contains(cnKey)) {
        scores[entry.key] = (scores[entry.key] ?? 0) + setCodeBonus;
        continue;
      }
      final fromName = nameSetCode(card.name);
      if (fromName == null) continue;
      final nameKey = collectorNumberKey(fromName);
      if (nameKey != null && codeSet.contains(nameKey)) {
        scores[entry.key] = (scores[entry.key] ?? 0) + setCodeBonus;
      }
    }
  }

  final ranked = scores.entries.toList()
    ..sort((a, b) => b.value.compareTo(a.value));
  return [for (final e in ranked.take(limit)) byId[e.key]!];
}

/// The scanner's result list: [cards] is every printing worth offering the
/// user, best-first, and the leading [rankedCount] entries are the ones the
/// recognizer actually matched. The remainder are other printings of the same
/// card, offered because the recognizer's ranking cutoffs routinely drop promo
/// and alternate-art printings of a correctly identified card.
class ScanMatches {
  const ScanMatches({required this.cards, required this.rankedCount});
  final List<CardModel> cards;
  final int rankedCount;
  static const empty = ScanMatches(cards: <CardModel>[], rankedCount: 0);
}

/// Lowercased alphanumeric key for a collector number, with every
/// non-alphanumeric character stripped. `"FAB428"` → `"fab428"`,
/// `"147/219"` → `"147219"`. Returns null when nothing remains.
String? collectorNumberKey(String? raw) {
  if (raw == null) return null;
  final key = raw.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '');
  return key.isEmpty ? null : key;
}

/// True when [key] looks like a FAB set-code collector number OCR can read as
/// one verbatim word (e.g. `fab428`, `wtr001`, `1hb007`): at least 4
/// characters with both a letter and a digit. This restricts OCR promotion in
/// [expandScanMatchesToPrintings] and [parseSetCodes] to set-code style
/// numbers; fractional numbers like `147/219` normalize via
/// [collectorNumberKey] to a digit-only run (`147219`) that never appears as a
/// single OCR word, so promoting on them would never fire usefully and would
/// risk false hits on unrelated digit noise.
bool _isSetCodeKey(String key) {
  if (key.length < 4) return false;
  var hasLetter = false;
  var hasDigit = false;
  for (var i = 0; i < key.length; i++) {
    final unit = key.codeUnitAt(i);
    if (unit >= 0x61 && unit <= 0x7a) {
      hasLetter = true;
    } else if (unit >= 0x30 && unit <= 0x39) {
      hasDigit = true;
    }
  }
  return hasLetter && hasDigit;
}

/// Word-boundary set-code tokens in OCR text (`FAB428`, `1HB001`, `ZENO29`).
/// Case-insensitive; kept keys must also pass [_isSetCodeKey] so short/plain
/// words and bare digit runs never enter the fusion pool.
final RegExp _setCodeTokenRe =
    RegExp(r'\b[0-9]?[A-Za-z]{2,4}[0-9]{2,4}\b', caseSensitive: false);

/// Every set-code-shaped token in [text], normalized to lowercase keys via
/// [collectorNumberKey], deduplicated, in reading order. Used as an *additive*
/// scan signal (see [fuseScanCandidates]) — never as a replacement for name
/// matching. Exact equality against the catalog means OCR garbage matches
/// nothing.
///
/// WHY this exists separately from [parseScanNumbers]: of 16,780 non-sealed
/// live-catalog rows, **zero** use the `NNN/TTT` fractional format that
/// [collectorNumberRegex] looks for (16,171 are set codes like `FAB428` /
/// `PEN208` / `1HB001`). The fractional collector-number branch of
/// [identifyCards] has therefore been dead code in production; set codes are
/// the real printed identifier.
List<String> parseSetCodes(String text) {
  final seen = <String>{};
  final result = <String>[];
  for (final m in _setCodeTokenRe.allMatches(text)) {
    final key = collectorNumberKey(m.group(0));
    if (key == null || !_isSetCodeKey(key)) continue;
    if (seen.add(key)) result.add(key);
  }
  return result;
}

/// Catalog printings indexed by every normalized collector-number key they can
/// be recognized under. Built once per catalog load (see
/// `setCodeIndexProvider`) — walking ~16k rows must never run per camera frame.
typedef SetCodeIndex = Map<String, List<CardModel>>;

/// Leading set-code segment inside a normalized collector-number key, used so
/// finish-suffixed numbers like `lss003cf` (`LSS003-CF`) remain findable as
/// `lss003` — the form OCR actually reads off the card.
final RegExp _leadingSetCodeKeyRe = RegExp(r'^([0-9]?[a-z]{2,4}[0-9]{2,4})');

/// Builds a [SetCodeIndex] for [catalog]. Each non-[isNonCardProduct] row is
/// indexed under: its full [collectorNumberKey]; each `//`-separated part
/// (so `"LGS125 // LGS126"` is findable as both `lgs125` and `lgs126`); the
/// leading set-code segment when a trailing finish suffix remains after
/// normalization (`"LSS003-CF"` → `lss003cf` also under `lss003`); and the
/// code parsed from the row's own name via [nameSetCode] — 21 live rows have a
/// name suffix that is the code printed on the card while `collector_number`
/// carries a typo, and OCR will see the printed code.
SetCodeIndex buildSetCodeIndex(List<CardModel> catalog) {
  final index = <String, List<CardModel>>{};
  void add(String? key, CardModel card) {
    if (key == null || !_isSetCodeKey(key)) return;
    final list = index[key];
    if (list == null) {
      index[key] = [card];
    } else if (!list.any((c) => c.id == card.id)) {
      list.add(card);
    }
  }

  for (final card in catalog) {
    if (isNonCardProduct(card)) continue;
    final raw = card.collectorNumber;
    final full = collectorNumberKey(raw);
    add(full, card);
    if (raw != null && raw.contains('//')) {
      for (final part in raw.split('//')) {
        add(collectorNumberKey(part.trim()), card);
      }
    }
    if (full != null) {
      final leading = _leadingSetCodeKeyRe.firstMatch(full)?.group(1);
      if (leading != null && leading != full) add(leading, card);
    }
    final fromName = nameSetCode(card.name);
    if (fromName != null) add(collectorNumberKey(fromName), card);
  }
  return index;
}

/// Cards in [index] matching any of [codes], in code order then index order,
/// deduplicated by `id`.
List<CardModel> findBySetCodes(SetCodeIndex index, List<String> codes) {
  if (codes.isEmpty || index.isEmpty) return const [];
  final seen = <String>{};
  final result = <CardModel>[];
  for (final code in codes) {
    final list = index[code];
    if (list == null) continue;
    for (final card in list) {
      if (seen.add(card.id)) result.add(card);
    }
  }
  return result;
}

/// Once the scanner has locked onto a card identity, expand the recognizer's
/// short candidate list into every catalog printing of that card.
///
/// WHY this exists (and why we do NOT make matching "smarter"): [identifyCards]
/// and [fuseScanCandidates] both cap at `limit: 12`. Name-token matching strips
/// parentheticals and set-code suffixes, so every printing of "Leaven Sheath"
/// — Normal, Foil, Extended Art promo `FAB428`, … — ties at overlap 1.0 with
/// the same token count. Among 20+ tied printings, which 12 survive is
/// effectively catalog order, so the promo the user is holding is routinely
/// truncated away. The pHash visual signal does not rescue it. Widening the
/// match limit or teaching the matcher about arts/finishes would either flood
/// the two-frame confirmation with noise or couple ranking to catalog
/// conventions that are not printed on the card. Expanding AFTER identity is
/// locked is cheaper and safer: keep the recognizer's ranking as the "best
/// matches" prefix, then offer every other printing of the same [baseCardName]
/// (pitch colors kept, so we never cross Red/Yellow/Blue the recognizer did
/// not surface).
///
/// When [ocrText] contains a set-code collector number that matches a
/// printing's [collectorNumberKey] (and passes [_isSetCodeKey]), that printing
/// is promoted into the ranked prefix. Set codes are also a live additive
/// fusion signal (see [parseSetCodes] / [fuseScanCandidates]); post-lock
/// promotion remains the safety net when the code was only readable on a later
/// frame or only matches an expanded printing.
///
/// [limit] caps the expanded list; truncation is `max(limit, ranked.length)`
/// so a card the recognizer actually matched is never dropped.
ScanMatches expandScanMatchesToPrintings(
  List<CardModel> catalog,
  List<CardModel> matches, {
  String ocrText = '',
  int limit = 60,
}) {
  if (matches.isEmpty) return ScanMatches.empty;
  if (catalog.isEmpty) {
    return ScanMatches(cards: matches, rankedCount: matches.length);
  }

  final matchIds = <String>{for (final c in matches) c.id};

  // Ordered, deduplicated base names from the recognizer's hits — first-seen
  // order so a multi-card fuse still expands each identity in the order the
  // user saw it.
  final baseNames = <String>[];
  final baseNameSet = <String>{};
  for (final c in matches) {
    final base = baseCardName(c.name);
    if (baseNameSet.add(base)) baseNames.add(base);
  }

  final extrasByBase = <String, List<CardModel>>{
    for (final base in baseNames) base: <CardModel>[],
  };
  for (final c in catalog) {
    if (isNonCardProduct(c)) continue;
    if (matchIds.contains(c.id)) continue;
    final base = baseCardName(c.name);
    final bucket = extrasByBase[base];
    if (bucket == null) continue;
    bucket.add(c);
  }
  for (final bucket in extrasByBase.values) {
    bucket.sort(_baseFirst);
  }
  final extrasOrdered = <CardModel>[
    for (final base in baseNames) ...extrasByBase[base]!,
  ];

  final group1 = <CardModel>[];
  final inGroup1 = <String>{};

  if (ocrText.trim().isNotEmpty) {
    final words = _wordSet(ocrText);
    bool promote(CardModel c) {
      final key = collectorNumberKey(c.collectorNumber);
      return key != null && _isSetCodeKey(key) && words.contains(key);
    }

    // Matches first (scan order), then extras (base-name order, then
    // _baseFirst) — only printings whose printed set code was read verbatim.
    for (final c in matches) {
      if (promote(c) && inGroup1.add(c.id)) group1.add(c);
    }
    for (final c in extrasOrdered) {
      if (promote(c) && inGroup1.add(c.id)) group1.add(c);
    }
  }

  // Remaining recognizer hits in their original order.
  for (final c in matches) {
    if (inGroup1.add(c.id)) group1.add(c);
  }

  // Other catalog printings of the same base name(s), not already ranked.
  final group2 = <CardModel>[
    for (final c in extrasOrdered)
      if (!inGroup1.contains(c.id)) c,
  ];

  final seen = <String>{};
  final combined = <CardModel>[];
  for (final c in [...group1, ...group2]) {
    if (seen.add(c.id)) combined.add(c);
  }
  final cap = limit > group1.length ? limit : group1.length;
  final cards =
      combined.length <= cap ? combined : combined.sublist(0, cap);
  return ScanMatches(cards: cards, rankedCount: group1.length);
}

/// Keeps the best name-matching group of number [candidates]. When the name
/// could not be read (all overlaps 0), returns the candidates as-is so the user
/// can disambiguate manually.
List<CardModel> _rankByName(
    List<CardModel> candidates, Set<String> ocrWords, int limit) {
  final scored = candidates
      .map((c) => MapEntry(c, _nameOverlap(c, ocrWords)))
      .toList()
    ..sort((a, b) => b.value.compareTo(a.value));
  final best = scored.first.value;
  final threshold = best > 0 ? best - 0.001 : -1.0;
  final result = <CardModel>[];
  final seen = <String>{};
  for (final e in scored) {
    if (e.value < threshold) break;
    if (seen.add(e.key.id)) result.add(e.key);
    if (result.length >= limit) break;
  }
  return result;
}

/// Finds the opposite-finish printing (Normal <-> Foil) of [card] within
/// [catalog], or null if this card has no alternate finish. Finishes of the
/// same physical card share a `product_id` and differ only by `is_foil`.
CardModel? oppositeFinish(List<CardModel> catalog, CardModel card) {
  final finishes = finishesForCard(catalog, card);
  for (final c in finishes) {
    if (c.id != card.id && c.isFoil != card.isFoil) return c;
  }
  return null;
}

/// All finish variants of the same TCGplayer product as [card]
/// (Normal, Rainbow Foil, Cold Foil, …), ordered Normal-first then by label.
/// Always includes [card] even when it is missing from [catalog].
List<CardModel> finishesForCard(List<CardModel> catalog, CardModel card) {
  final matches = <CardModel>[];
  final seen = <String>{};
  void add(CardModel c) {
    if (seen.add(c.id)) matches.add(c);
  }

  if (card.productId != null) {
    for (final c in catalog) {
      if (c.productId == card.productId) add(c);
    }
  } else {
    for (final c in catalog) {
      if (c.name == card.name && c.collectorNumber == card.collectorNumber) {
        add(c);
      }
    }
  }
  add(card);
  matches.sort((a, b) {
    if (a.isFoil != b.isFoil) return a.isFoil ? 1 : -1;
    return a.finishLabel.compareTo(b.finishLabel);
  });
  return matches;
}

/// Reads card + price data from the shared Supabase database.
class CardRepository {
  CardRepository(this._client);

  final SupabaseClient _client;

  static const String _view = 'fab_cards_with_prices';

  /// Fetches the entire (non-sealed) catalog for local caching. PostgREST caps
  /// a single response at 1000 rows, so page through with `range` until drained.
  Future<List<CardModel>> fetchAll() async {
    const pageSize = 1000;
    final all = <CardModel>[];
    var from = 0;
    while (true) {
      final rows = await _client
          .from(_view)
          .select()
          .eq('is_sealed', false)
          .order('name')
          .range(from, from + pageSize - 1);
      final list = rows as List;
      all.addAll(
          list.map((r) => CardModel.fromMap(r as Map<String, dynamic>)));
      if (list.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  /// All printings (normal/foil/alt) that share a card name.
  Future<List<CardModel>> printingsForName(String name) async {
    final rows = await _client
        .from(_view)
        .select()
        .eq('name', name)
        .eq('is_sealed', false)
        .order('is_foil');
    return (rows as List)
        .map((r) => CardModel.fromMap(r as Map<String, dynamic>))
        .toList();
  }

  /// Daily price snapshots for a printing (oldest → newest) for charts.
  Future<List<PricePoint>> priceHistory(String cardId) async {
    final rows = await _client
        .from('fab_price_history')
        .select()
        .eq('card_id', cardId)
        .order('captured_on', ascending: true);
    return (rows as List)
        .map((r) => PricePoint.fromMap(r as Map<String, dynamic>))
        .toList();
  }

  /// Ranked recent Low movers for [source]. Omit [cardIds] for catalog-wide;
  /// pass owned Printing ids to rank only those. Does not default a bad source.
  Future<List<RecentMoverRow>> recentMovers(
    String source, {
    List<String>? cardIds,
  }) async {
    final params = <String, dynamic>{'p_source': source};
    if (cardIds != null) {
      params['p_card_ids'] = cardIds;
    }
    final rows = await _client.rpc('fab_recent_movers', params: params);
    return (rows as List)
        .map((r) => RecentMoverRow.fromMap(Map<String, dynamic>.from(r as Map)))
        .toList();
  }

  /// Displayable recent Low change for [cardIds] on [source]. Always sends
  /// ids (empty → zero rows). Does not default a bad source. Does not call
  /// `fab_recent_movers`.
  Future<List<RecentLowChange>> printingRecentChanges(
    String source,
    List<String> cardIds,
  ) async {
    final rows = await _client.rpc(
      'fab_printing_recent_changes',
      params: {
        'p_source': source,
        'p_card_ids': cardIds,
      },
    );
    return (rows as List)
        .map((r) => RecentLowChange.fromMap(Map<String, dynamic>.from(r as Map)))
        .toList();
  }

  /// Look up printings by collector number (used by card scanning).
  Future<List<CardModel>> findByCollectorNumber(String collectorNumber) async {
    final rows = await _client
        .from(_view)
        .select()
        .eq('is_sealed', false)
        .eq('collector_number', collectorNumber);
    return (rows as List)
        .map((r) => CardModel.fromMap(r as Map<String, dynamic>))
        .toList();
  }

  /// Set release dates from `fab_sets.published_on` (group id → date).
  Future<SetPublishedOnMap> fetchSetPublishedOn() async {
    final rows = await _client
        .from('fab_sets')
        .select('group_id, published_on')
        .not('published_on', 'is', null);
    return SetPublishedOnMap.fromRows(
      (rows as List).map((r) => Map<String, dynamic>.from(r as Map)),
    );
  }

  /// The distinct set names present in [cards], ordered for browsing: Main
  /// Sets, Blitz Decks, Armory Decks, Silver Age, Hero Decks, then Other —
  /// newest release first within each section when [publishedOnForGroupId]
  /// can resolve a date. Flesh and Blood has ~100 expansions that grow over
  /// time, so the browsable set list is derived from whatever the pipeline
  /// has loaded. Non-card products (sealed boxes, etc.) are excluded.
  static List<String> setNamesFrom(
    Iterable<CardModel> cards, {
    DateTime? Function(int groupId)? publishedOnForGroupId,
  }) {
    final names = <String>{};
    final idByName = <String, int>{};
    for (final c in cards) {
      if (isNonCardProduct(c)) continue;
      final s = c.setName;
      if (s == null || s.trim().isEmpty) continue;
      names.add(s);
      final id = c.setId;
      if (id != null) idByName.putIfAbsent(s, () => id);
    }
    final list = names.toList()
      ..sort((a, b) {
        final idA = idByName[a];
        final idB = idByName[b];
        return compareSetsByBrowseOrder(
          a,
          b,
          publishedOnA:
              idA == null ? null : publishedOnForGroupId?.call(idA),
          publishedOnB:
              idB == null ? null : publishedOnForGroupId?.call(idB),
        );
      });
    return list;
  }
}
