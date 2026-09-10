import '../models/binder.dart';
import '../models/binder_entry.dart';
import 'fabrary_csv.dart';
import 'fabrary_match.dart';
import 'free_limits.dart';

class FabraryAdd {
  const FabraryAdd({required this.printingId, required this.quantity});

  final String printingId;
  final int quantity;

  Map<String, dynamic> toJson() => {
        'printingId': printingId,
        'quantity': quantity,
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
    this.binderId,
  });

  final bool ok;
  final String? refuseReason;
  final int ownedCount;
  final int matchedCount;
  final int copiesToAdd;
  final List<FabraryUnmatched> unmatched;
  final List<FabraryAdd> adds;
  final String? binderId;

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

class _HaveParse {
  const _HaveParse._(this.kind, this.quantity);
  const _HaveParse.empty() : this._('empty', 0);
  const _HaveParse.invalid() : this._('invalid', 0);
  const _HaveParse.owned(int qty) : this._('owned', qty);

  final String kind;
  final int quantity;
}

_HaveParse parseHave(dynamic raw) {
  final text = '$raw'.trim();
  if (text.isEmpty) return const _HaveParse.empty();
  final n = num.tryParse(text);
  if (n == null || !n.isFinite) return const _HaveParse.invalid();
  if (n <= 0) return const _HaveParse.empty();
  return _HaveParse.owned(n.toInt());
}

List<String> ownedIdsFromEntries(Iterable<dynamic> entries) {
  final ids = <String>{};
  for (final entry in entries) {
    if (entry is BinderEntry) {
      if (entry.isWanted) continue;
      final id = entry.card.id;
      if (id.isNotEmpty) ids.add(id);
      continue;
    }
    if (entry is Map) {
      if (entry['isWanted'] == true) continue;
      final id = '${entry['printingId'] ?? entry['cardId'] ?? ''}';
      if (id.isNotEmpty) ids.add(id);
    }
  }
  return ids.toList();
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

FabraryImportPlan planFabraryImport({
  List<String>? headers,
  List<Map<String, dynamic>>? rows,
  String? csv,
  required List<dynamic> catalog,
  required String binderId,
  List<dynamic> existingEntries = const [],
  List<String>? existingOwnedIds,
  bool isPro = false,
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
  final qtyById = <String, int>{};
  var ownedCount = 0;

  for (final row in resolvedRows ?? const <Map<String, dynamic>>[]) {
    final have = parseHave(row['Have']);
    if (have.kind == 'empty') continue;
    if (have.kind == 'invalid') {
      ownedCount += 1;
      unmatched.add(
        FabraryUnmatched(
          name: '${row['Name'] ?? ''}',
          setNumber: '${row['Set number'] ?? ''}',
          foiling: '${row['Foiling'] ?? ''}',
          treatment: '${row['Treatment'] ?? ''}',
          edition: '${row['Edition'] ?? ''}',
        ),
      );
      continue;
    }
    ownedCount += 1;
    final match = matchFabraryRow(row, catalog);
    if (match.unmatched != null) {
      unmatched.add(match.unmatched!);
      continue;
    }
    final id = match.printingId!;
    qtyById[id] = (qtyById[id] ?? 0) + have.quantity;
  }

  if (ownedCount == 0) return _empty('no_owned');

  final adds = [
    for (final entry in qtyById.entries)
      FabraryAdd(printingId: entry.key, quantity: entry.value),
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
      binderId: binderId,
    );
  }

  final existingIds = existingOwnedIds ?? ownedIdsFromEntries(existingEntries);
  final incomingIds = [for (final add in adds) add.printingId];
  if (!FreeLimits.canImportDistinctPrintings(
    existingIds,
    incomingIds,
    isPro: isPro,
  )) {
    return FabraryImportPlan(
      ok: false,
      refuseReason: 'free_cap',
      ownedCount: ownedCount,
      matchedCount: matchedCount,
      copiesToAdd: 0,
      unmatched: unmatched,
      adds: const [],
      binderId: binderId,
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
    binderId: binderId,
  );
}

/// Combine Have quantities onto existing NM rows in this Binder only.
List<Map<String, dynamic>> applyImportAddsToEntries(
  List<Map<String, dynamic>> existingEntries,
  String binderId,
  List<FabraryAdd> adds,
) {
  final next = [
    for (final entry in existingEntries) Map<String, dynamic>.from(entry),
  ];
  for (final add in adds) {
    final idx = next.indexWhere((entry) {
      if (entry['isWanted'] == true) return false;
      final entryBinder = '${entry['binderId'] ?? BinderIds.trade}';
      final condition = '${entry['condition'] ?? 'NM'}';
      final id = '${entry['printingId'] ?? entry['cardId'] ?? ''}';
      return entryBinder == binderId && condition == 'NM' && id == add.printingId;
    });
    if (idx >= 0) {
      final qty = (next[idx]['quantity'] as num?)?.toInt() ?? 0;
      next[idx]['quantity'] = qty + add.quantity;
    } else {
      next.add({
        'printingId': add.printingId,
        'cardId': add.printingId,
        'binderId': binderId,
        'isWanted': false,
        'quantity': add.quantity,
        'condition': 'NM',
      });
    }
  }
  return next;
}
