import '../models/binder.dart';
import 'fabrary_csv.dart';
import 'fabrary_match.dart';

const fabraryDestinationCollection = 'collection';
const fabraryDestinationTrade = 'trade';
const fabraryDestinationWant = 'want';

class FabraryAdd {
  const FabraryAdd({
    required this.printingId,
    required this.quantity,
    this.destination = fabraryDestinationCollection,
  });

  final String printingId;
  final int quantity;
  final String destination;

  Map<String, dynamic> toJson() => {
        'printingId': printingId,
        'quantity': quantity,
        'destination': destination,
      };
}

class FabraryImportPlan {
  const FabraryImportPlan({
    required this.ok,
    this.refuseReason,
    required this.ownedCount,
    required this.matchedCount,
    required this.copiesToAdd,
    required this.unmatched,
    required this.adds,
    this.restoreCollection = false,
  });

  final bool ok;
  final String? refuseReason;
  final int ownedCount;
  final int matchedCount;
  final int copiesToAdd;
  final List<FabraryUnmatched> unmatched;
  final List<FabraryAdd> adds;
  final bool restoreCollection;

  int copiesFor(String destination) => adds
      .where((add) => add.destination == destination)
      .fold<int>(0, (sum, add) => sum + add.quantity);

  Map<String, dynamic> toJson() => {
        'ok': ok,
        'refuseReason': refuseReason,
        'ownedCount': ownedCount,
        'matchedCount': matchedCount,
        'copiesToAdd': copiesToAdd,
        'unmatched': unmatched.map((u) => u.toJson()).toList(),
        'adds': adds.map((a) => a.toJson()).toList(),
      };
}

class _QtyParse {
  const _QtyParse._(this.kind, this.quantity);
  const _QtyParse.empty() : this._('empty', 0);
  const _QtyParse.invalid() : this._('invalid', 0);
  const _QtyParse.owned(int qty) : this._('owned', qty);

  final String kind;
  final int quantity;
}

_QtyParse _parseQty(dynamic raw) {
  if (raw == null) return const _QtyParse.empty();
  final text = '$raw'.trim();
  if (text.isEmpty) return const _QtyParse.empty();
  final n = num.tryParse(text);
  if (n == null || !n.isFinite) return const _QtyParse.invalid();
  if (n <= 0) return const _QtyParse.empty();
  return _QtyParse.owned(n.toInt());
}

class _ColumnQty {
  const _ColumnQty({
    required this.quantity,
    required this.invalid,
  });

  final int quantity;
  final bool invalid;
}

_ColumnQty _qtyOf(Map<String, dynamic> row, List<String> keys) {
  var quantity = 0;
  var invalid = false;
  for (final key in keys) {
    final parsed = _parseQty(row[key]);
    if (parsed.kind == 'invalid') invalid = true;
    if (parsed.kind == 'owned') quantity += parsed.quantity;
  }
  return _ColumnQty(quantity: quantity, invalid: invalid);
}

FabraryImportPlan _empty(String reason) => FabraryImportPlan(
      ok: false,
      refuseReason: reason,
      ownedCount: 0,
      matchedCount: 0,
      copiesToAdd: 0,
      unmatched: const [],
      adds: const [],
    );

FabraryUnmatched _unmatchedFromRow(Map<String, dynamic> row) => FabraryUnmatched(
      name: '${row['Name'] ?? ''}',
      setNumber: '${row['Set number'] ?? ''}',
      foiling: '${row['Foiling'] ?? ''}',
      treatment: '${row['Treatment'] ?? ''}',
      edition: '${row['Edition'] ?? ''}',
    );

List<FabraryAdd> _addsFromMap(Map<String, int> qtyById, String destination) => [
      for (final entry in qtyById.entries)
        FabraryAdd(
          printingId: entry.key,
          quantity: entry.value,
          destination: destination,
        ),
    ];

FabraryImportPlan planFabraryImport({
  List<String>? headers,
  List<Map<String, dynamic>>? rows,
  String? csv,
  required List<dynamic> catalog,
  String? binderId,
  List<dynamic> existingEntries = const [],
  bool notFabrary = false,
}) {
  var resolvedHeaders = headers;
  var resolvedRows = rows;
  if (csv != null) {
    final parsed = parseFabraryCsv(csv);
    if (!parsed.ok) return _empty('not_fabrary');
    resolvedHeaders = parsed.headers;
    resolvedRows = parsed.rows;
  }
  if (notFabrary || !hasFabraryHeaders(resolvedHeaders)) {
    return _empty('not_fabrary');
  }

  final unmatched = <FabraryUnmatched>[];
  final collectionById = <String, int>{};
  final tradeById = <String, int>{};
  final wantById = <String, int>{};
  var ownedCount = 0;
  final catalogIndex = buildFabrarySetIndex(catalog);

  for (final row in resolvedRows ?? const <Map<String, dynamic>>[]) {
    final have = _qtyOf(row, const ['Have']);
    final want = _qtyOf(row, const ['Want in trade', 'Want to buy']);
    final extra = _qtyOf(row, const ['Extra for trade', 'Extra to sell']);
    final hasValid =
        have.quantity > 0 || want.quantity > 0 || extra.quantity > 0;
    final hasInvalidOnly =
        !hasValid && (have.invalid || want.invalid || extra.invalid);
    if (!hasValid && !hasInvalidOnly) continue;

    ownedCount += 1;
    if (hasInvalidOnly) {
      unmatched.add(_unmatchedFromRow(row));
      continue;
    }

    final match = matchFabraryRow(row, catalogIndex);
    if (match.unmatched != null) {
      unmatched.add(match.unmatched!);
      continue;
    }
    final id = match.printingId!;
    if (have.quantity > 0) {
      collectionById[id] = (collectionById[id] ?? 0) + have.quantity;
    }
    if (want.quantity > 0) {
      wantById[id] = (wantById[id] ?? 0) + want.quantity;
    }
    if (extra.quantity > 0) {
      tradeById[id] = (tradeById[id] ?? 0) + extra.quantity;
    }
  }

  if (ownedCount == 0) return _empty('no_owned');

  final adds = [
    ..._addsFromMap(collectionById, fabraryDestinationCollection),
    ..._addsFromMap(wantById, fabraryDestinationWant),
    ..._addsFromMap(tradeById, fabraryDestinationTrade),
  ];
  final matchedCount = adds.length;
  final copiesToAdd = adds.fold<int>(0, (s, a) => s + a.quantity);

  if (matchedCount == 0) {
    return FabraryImportPlan(
      ok: false,
      refuseReason: 'no_matched',
      ownedCount: ownedCount,
      matchedCount: 0,
      copiesToAdd: 0,
      unmatched: unmatched,
      adds: const [],
    );
  }

  return FabraryImportPlan(
    ok: true,
    refuseReason: null,
    ownedCount: ownedCount,
    matchedCount: matchedCount,
    copiesToAdd: copiesToAdd,
    unmatched: unmatched,
    adds: adds,
    restoreCollection: collectionById.isNotEmpty,
  );
}

String? _binderIdFor(
  String destination, {
  required String collectionBinderId,
  required String tradeBinderId,
}) {
  if (destination == fabraryDestinationWant) return null;
  if (destination == fabraryDestinationTrade) return tradeBinderId;
  return collectionBinderId;
}

/// Combine planned quantities onto existing NM / Want List rows.
List<Map<String, dynamic>> applyImportAddsToEntries(
  List<Map<String, dynamic>> existingEntries,
  List<FabraryAdd> adds, {
  String collectionBinderId = BinderIds.collection,
  String tradeBinderId = BinderIds.trade,
}) {
  final next = [
    for (final entry in existingEntries) Map<String, dynamic>.from(entry),
  ];
  for (final add in adds) {
    final wanted = add.destination == fabraryDestinationWant;
    final binderId = _binderIdFor(
      add.destination,
      collectionBinderId: collectionBinderId,
      tradeBinderId: tradeBinderId,
    );
    final idx = next.indexWhere((entry) {
      final id = '${entry['printingId'] ?? entry['cardId'] ?? ''}';
      if (id != add.printingId) return false;
      if (wanted) return entry['isWanted'] == true;
      if (entry['isWanted'] == true) return false;
      final entryBinder = '${entry['binderId'] ?? BinderIds.trade}';
      final condition = '${entry['condition'] ?? 'NM'}';
      return entryBinder == binderId && condition == 'NM';
    });
    if (idx >= 0) {
      final qty = (next[idx]['quantity'] as num?)?.toInt() ?? 0;
      next[idx]['quantity'] = qty + add.quantity;
    } else {
      next.add({
        'printingId': add.printingId,
        'cardId': add.printingId,
        'binderId': wanted ? null : binderId,
        'isWanted': wanted,
        'quantity': add.quantity,
        'condition': 'NM',
      });
    }
  }
  return next;
}
