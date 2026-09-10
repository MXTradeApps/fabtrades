import '../data/card_repository.dart';
import '../models/card_model.dart';

const _artTreatments = [
  'extended art',
  'full art',
  'alternate art',
  'alternate text',
  'alternate border',
  'alt art',
  'marvel',
  'treasure',
];

const _treatmentAliases = {
  'full art': ['full art', 'marvel', 'treasure'],
  'alternate art': ['alternate art', 'alt art'],
  'alt art': ['alternate art', 'alt art'],
  'extended art': ['extended art'],
  'alternate border': ['alternate border'],
  'alternate text': ['alternate text'],
};

final _foilNumberSuffix = RegExp(r'(cf|rf|gf)$');

const _pitchByName = {'red': '1', 'yellow': '2', 'blue': '3'};

class FabraryUnmatched {
  const FabraryUnmatched({
    required this.name,
    required this.setNumber,
    required this.foiling,
    required this.treatment,
    required this.edition,
  });

  final String name;
  final String setNumber;
  final String foiling;
  final String treatment;
  final String edition;

  Map<String, String> toJson() => {
        'name': name,
        'setNumber': setNumber,
        'foiling': foiling,
        'treatment': treatment,
        'edition': edition,
      };
}

class FabraryMatch {
  const FabraryMatch.hit(String id)
      : printingId = id,
        unmatched = null;

  const FabraryMatch.miss(FabraryUnmatched miss)
      : printingId = null,
        unmatched = miss;

  final String? printingId;
  final FabraryUnmatched? unmatched;

  Map<String, dynamic> toJson() {
    if (unmatched != null) return {'unmatched': unmatched!.toJson()};
    return {'printingId': printingId};
  }
}

String _rowValue(Map<String, dynamic> row, String key, [String alt = '']) {
  final value = row[key] ?? (alt.isEmpty ? null : row[alt]);
  return value == null ? '' : '$value';
}

String printingIdOf(dynamic card) {
  if (card is CardModel) return card.id;
  if (card is Map) {
    return '${card['id'] ?? card['_uniqueId'] ?? ''}';
  }
  return '';
}

String collectorNumberOf(dynamic card) {
  if (card is CardModel) return card.collectorNumber ?? '';
  if (card is Map) {
    return '${card['collectorNumber'] ?? card['extNumber'] ?? card['collector_number'] ?? ''}';
  }
  return '';
}

String subTypeOf(dynamic card) {
  if (card is CardModel) return card.subTypeName ?? '';
  if (card is Map) {
    return '${card['subTypeName'] ?? card['sub_type_name'] ?? ''}';
  }
  return '';
}

String setNameOf(dynamic card) {
  if (card is CardModel) return card.setName ?? '';
  if (card is Map) {
    return '${card['setName'] ?? card['_setName'] ?? card['set_name'] ?? ''}';
  }
  return '';
}

String nameOf(dynamic card) {
  if (card is CardModel) return card.name;
  if (card is Map) return '${card['name'] ?? ''}';
  return '';
}

String pitchOf(dynamic card) {
  if (card is CardModel) return card.pitch ?? '';
  if (card is Map) {
    final raw = card['pitch'] ?? card['extPitchValue'];
    if (raw == null || raw == '') return '';
    return '$raw';
  }
  return '';
}

bool _hasArtTreatment(String name) {
  final lower = name.toLowerCase();
  return _artTreatments.any((token) => lower.contains('($token)'));
}

bool _isRegularPrinting(dynamic card) => !_hasArtTreatment(nameOf(card));

String _editionHaystack(dynamic card) =>
    '${subTypeOf(card)} ${setNameOf(card)}'.toLowerCase();

bool _hasPitchColorName(String name) {
  final lower = name.toLowerCase();
  return lower.contains('(red)') ||
      lower.contains('(yellow)') ||
      lower.contains('(blue)');
}

bool _matchesPitch(dynamic card, String fabraryPitch) {
  final want = fabraryPitch.trim().toLowerCase();
  if (want.isEmpty) return true;
  final mapped = _pitchByName[want];
  final catalogPitch = pitchOf(card);
  final hasNumericPitch = catalogPitch.isNotEmpty && catalogPitch != '0';
  if (mapped != null && hasNumericPitch && catalogPitch == mapped) return true;
  final name = nameOf(card).toLowerCase();
  if (name.contains('($want)')) return true;
  if (!hasNumericPitch && !_hasPitchColorName(name)) return true;
  return false;
}

bool _matchesFoil(dynamic card, String foiling) {
  final want = foiling.trim().toLowerCase();
  final sub = subTypeOf(card).toLowerCase();
  if (want.isEmpty) {
    return !RegExp(r'\brainbow\b').hasMatch(sub) &&
        !RegExp(r'\bcold\b').hasMatch(sub) &&
        !RegExp(r'\bgold\b').hasMatch(sub);
  }
  if (want.contains('rainbow')) return sub.contains('rainbow');
  if (want.contains('cold')) return sub.contains('cold');
  if (want.contains('gold')) return sub.contains('gold');
  return sub.contains(want);
}

List<String> _treatmentNeedles(String treatment) {
  final want = treatment.trim().toLowerCase();
  if (want.isEmpty) return const <String>[];
  return _treatmentAliases[want] ?? <String>[want];
}

bool _nameHasTreatment(String name, List<String> needles) {
  final lower = name.toLowerCase();
  return needles.any((token) => lower.contains('($token)'));
}

List<dynamic> _applyTreatmentFilter(List<dynamic> candidates, String treatment) {
  final want = treatment.trim();
  if (want.isEmpty) {
    final regular =
        candidates.where((card) => !_hasArtTreatment(nameOf(card))).toList();
    return regular.isNotEmpty ? regular : candidates;
  }
  final needles = _treatmentNeedles(want);
  final exact = candidates
      .where((card) => _nameHasTreatment(nameOf(card), needles))
      .toList();
  if (exact.isNotEmpty) return exact;
  final artish =
      candidates.where((card) => _hasArtTreatment(nameOf(card))).toList();
  return artish.isNotEmpty ? artish : candidates;
}

List<dynamic> _applyFoilFilter(List<dynamic> candidates, String foiling) {
  final matched =
      candidates.where((card) => _matchesFoil(card, foiling)).toList();
  if (matched.isNotEmpty) return matched;
  if (foiling.trim().isEmpty) return matched;
  return candidates.where((card) => subTypeOf(card).trim().isEmpty).toList();
}

final _collectorNumberSplit = RegExp(r'\s*//\s*|\s*/\s*');

List<String> collectorNumberKeys(String? raw) {
  final text = raw ?? '';
  if (text.trim().isEmpty) return const <String>[];
  final keys = <String>[];
  final seen = <String>{};
  void add(String value) {
    final key = collectorNumberKey(value);
    if (key == null || !seen.add(key)) return;
    keys.add(key);
    final stripped = key.replaceFirst(_foilNumberSuffix, '');
    if (stripped != key && stripped.length >= 5 && seen.add(stripped)) {
      keys.add(stripped);
    }
  }

  add(text);
  for (final part in text.split(_collectorNumberSplit)) {
    final trimmed = part.trim();
    if (trimmed.isNotEmpty) add(trimmed);
  }
  return keys;
}

bool _hasEditionToken(dynamic card, String token) {
  final text = _editionHaystack(card);
  if (token == 'first') {
    return RegExp(r'\b1st\b').hasMatch(text) ||
        RegExp(r'\bfirst\b').hasMatch(text);
  }
  if (token == 'unlimited') return RegExp(r'\bunlimited\b').hasMatch(text);
  if (token == 'alpha') return RegExp(r'\balpha\b').hasMatch(text);
  return false;
}

bool _matchesEdition(dynamic card, String edition) {
  final want = edition.trim().toLowerCase();
  if (want.isEmpty) {
    return !_hasEditionToken(card, 'first') &&
        !_hasEditionToken(card, 'unlimited') &&
        !_hasEditionToken(card, 'alpha');
  }
  if (want == 'first') return _hasEditionToken(card, 'first');
  if (want == 'unlimited') return _hasEditionToken(card, 'unlimited');
  if (want == 'alpha') return _hasEditionToken(card, 'alpha');
  return _editionHaystack(card).contains(want);
}

FabraryUnmatched _unmatchedOf(Map<String, dynamic> row) => FabraryUnmatched(
      name: _rowValue(row, 'Name', 'name'),
      setNumber: _rowValue(row, 'Set number', 'setNumber'),
      foiling: _rowValue(row, 'Foiling', 'foiling'),
      treatment: _rowValue(row, 'Treatment', 'treatment'),
      edition: _rowValue(row, 'Edition', 'edition'),
    );

dynamic _pickCandidate(List<dynamic> candidates) {
  if (candidates.isEmpty) return null;
  if (candidates.length == 1) return candidates.first;
  final regular = candidates.where(_isRegularPrinting).toList();
  final pool = regular.isNotEmpty ? regular : candidates;
  pool.sort((a, b) {
    final byName = nameOf(a).compareTo(nameOf(b));
    if (byName != 0) return byName;
    final byNumber = collectorNumberOf(a).compareTo(collectorNumberOf(b));
    if (byNumber != 0) return byNumber;
    return subTypeOf(a).compareTo(subTypeOf(b));
  });
  return pool.first;
}

Map<String, List<dynamic>> buildFabrarySetIndex(Iterable<dynamic> catalog) {
  final index = <String, List<dynamic>>{};
  for (final card in catalog) {
    for (final key in collectorNumberKeys(collectorNumberOf(card))) {
      final list = index.putIfAbsent(key, () => <dynamic>[]);
      if (!list.contains(card)) list.add(card);
    }
  }
  return index;
}

/// Match one Fabrary owned row to a catalog Printing.
///
/// [catalog] may be [CardModel]s, catalog-shaped maps, or a prebuilt set-code
/// index from [buildFabrarySetIndex]. Identifier is ignored.
FabraryMatch matchFabraryRow(
  Map<String, dynamic> row,
  dynamic catalog,
) {
  final setNumber = _rowValue(row, 'Set number', 'setNumber');
  final key = collectorNumberKey(setNumber);
  if (key == null) return FabraryMatch.miss(_unmatchedOf(row));

  final index = catalog is Map<String, List<dynamic>>
      ? catalog
      : buildFabrarySetIndex(
          catalog is Iterable ? catalog as Iterable<dynamic> : const <dynamic>[],
        );
  final pool = index[key] ?? const <dynamic>[];
  final pitched = pool
      .where(
        (card) =>
            _matchesPitch(card, _rowValue(row, 'Pitch', 'pitch')) &&
            _matchesEdition(card, _rowValue(row, 'Edition', 'edition')),
      )
      .toList();
  final foiled =
      _applyFoilFilter(pitched, _rowValue(row, 'Foiling', 'foiling'));
  final candidates =
      _applyTreatmentFilter(foiled, _rowValue(row, 'Treatment', 'treatment'));

  final chosen = _pickCandidate(candidates);
  if (chosen == null) return FabraryMatch.miss(_unmatchedOf(row));
  return FabraryMatch.hit(printingIdOf(chosen));
}
