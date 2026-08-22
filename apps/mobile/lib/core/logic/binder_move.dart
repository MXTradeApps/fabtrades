import '../models/binder.dart';
import '../models/binder_entry.dart';
import '../models/card_model.dart';

/// Result of [moveBinderCopies]. [entries] is the post-move list (unchanged on
/// refusal). [distinctOwned] is unique owned printing ids.
class BinderMoveResult {
  const BinderMoveResult({
    required this.ok,
    this.reason,
    required this.entries,
    required this.distinctOwned,
  });

  final bool ok;
  final String? reason;
  final List<BinderEntry> entries;
  final int distinctOwned;
}

int distinctOwnedCount(Iterable<BinderEntry> entries) => entries
    .where((e) => !e.isWanted && e.quantity > 0)
    .map((e) => e.card.id)
    .toSet()
    .length;

/// Move [quantity] copies of a Printing+condition from one live Binder to
/// another. Never refuses for the shared `binderCards` cap. Want List is never
/// a destination.
BinderMoveResult moveBinderCopies({
  required List<Binder> binders,
  required List<BinderEntry> entries,
  required String fromBinderId,
  required String toBinderId,
  required String printingId,
  required String condition,
  required int quantity,
  DateTime? now,
}) {
  final stamp = now ?? DateTime.now();
  int owned() => distinctOwnedCount(entries);

  BinderMoveResult refuse(String reason) => BinderMoveResult(
        ok: false,
        reason: reason,
        entries: entries,
        distinctOwned: owned(),
      );

  if (quantity < 1) return refuse('invalid-quantity');
  if (fromBinderId == toBinderId) return refuse('same-binder');
  if (toBinderId == 'want' || toBinderId.trim().isEmpty) {
    return refuse('invalid-destination');
  }

  Binder? dest;
  for (final b in binders) {
    if (b.clientId == toBinderId) {
      dest = b;
      break;
    }
  }
  if (dest == null || !dest.isLive) return refuse('invalid-destination');

  final srcIdx = entries.indexWhere((e) =>
      !e.isWanted &&
      e.card.id == printingId &&
      e.resolvedBinderId == fromBinderId &&
      e.condition == condition);
  if (srcIdx < 0) return refuse('missing-source');
  final source = entries[srcIdx];
  if (quantity > source.quantity) return refuse('invalid-quantity');

  final next = [...entries];
  final remaining = source.quantity - quantity;
  if (remaining <= 0) {
    next.removeAt(srcIdx);
  } else {
    next[srcIdx] = source.copyWith(quantity: remaining);
  }

  final destIdx = next.indexWhere((e) =>
      !e.isWanted &&
      e.card.id == printingId &&
      e.resolvedBinderId == toBinderId &&
      e.condition == condition);
  if (destIdx >= 0) {
    next[destIdx] =
        next[destIdx].copyWith(quantity: next[destIdx].quantity + quantity);
  } else {
    next.add(BinderEntry(
      card: source.card,
      quantity: quantity,
      condition: condition,
      isWanted: false,
      binderId: toBinderId,
      addedAt: stamp,
    ));
  }

  return BinderMoveResult(
    ok: true,
    entries: next,
    distinctOwned: distinctOwnedCount(next),
  );
}

/// Contract-shaped row used only by tests. Production passes [BinderEntry].
BinderEntry binderEntryFromContract(Map<String, dynamic> row, {DateTime? now}) {
  final wanted = row['isWanted'] as bool? ?? false;
  return BinderEntry(
    card: CardModel(
      id: row['printingId'] as String,
      name: (row['name'] as String?) ?? row['printingId'] as String,
      tcgMarket: (row['tcgMarket'] as num?)?.toDouble(),
    ),
    quantity: (row['quantity'] as num?)?.toInt() ?? 1,
    condition: (row['condition'] as String?) ?? 'NM',
    isWanted: wanted,
    binderId: wanted ? null : row['binderId'] as String?,
    addedAt: now ?? DateTime.now(),
  );
}

Binder binderFromContract(Map<String, dynamic> row, {DateTime? now}) {
  final stamp = now ?? DateTime.now();
  final deleted = row['deletedAt'] as String?;
  return Binder(
    clientId: row['clientId'] as String,
    name: (row['name'] as String?) ?? row['clientId'] as String,
    role: BinderRole.parse(row['role'] as String?),
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: deleted == null ? null : DateTime.tryParse(deleted),
  );
}
