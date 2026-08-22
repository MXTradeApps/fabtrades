import 'dart:convert';

import '../models/binder.dart';
import '../models/binder_entry.dart';
import '../models/card_model.dart';
import 'sync_adapter.dart';
import 'sync_journal.dart';
import 'sync_record.dart';

/// Maps binder and want-list entries onto `public.binder_entries`.
///
/// Owned identity is printing + Binder + condition so the same Printing can
/// live in Trade Binder and Collection as two rows, while two devices adding
/// the same Printing to the same Binder still merge. Want List stays keyed by
/// printing alone.
class BinderSyncAdapter implements SyncAdapter<BinderEntry> {
  const BinderSyncAdapter();

  @override
  SyncDomain get domain => SyncDomain.binder;

  @override
  String get table => 'binder_entries';

  @override
  String get conflictTarget => 'user_id,client_id';

  /// Owned: `binder|{binderId}|{cardId}|{condition}`. Want: `want|{cardId}`.
  @override
  String idOf(BinderEntry value) => entryClientId(
        cardId: value.card.id,
        isWanted: value.isWanted,
        binderId: value.resolvedBinderId,
        condition: value.condition,
      );

  static String entryClientId({
    required String cardId,
    required bool isWanted,
    String? binderId,
    String condition = 'NM',
  }) {
    if (isWanted) return 'want|$cardId';
    return 'binder|${binderId ?? BinderIds.trade}|$cardId|$condition';
  }

  @override
  Map<String, Object?> identityFilter(String id) {
    return {'client_id': id};
  }

  @override
  String fingerprint(BinderEntry value) => jsonEncode(value.toJson());

  @override
  DateTime fallbackTimestamp(BinderEntry value) => value.addedAt;

  /// Most recently added first, matching what the binder screen shows after a
  /// local add.
  @override
  int compare(BinderEntry a, BinderEntry b) => b.addedAt.compareTo(a.addedAt);

  @override
  Map<String, Object?> toRow(
    BinderEntry value, {
    required String userId,
    required DateTime updatedAt,
  }) {
    final wanted = value.isWanted;
    return {
      'user_id': userId,
      'client_id': idOf(value),
      'card_id': value.card.id,
      'is_wanted': wanted,
      'binder_id': wanted ? null : value.resolvedBinderId,
      'quantity': value.quantity,
      'condition': value.condition,
      'card': value.card.toStub(),
      'added_at': value.addedAt.toUtc().toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      // An entry being pushed is live by definition. Clearing this is what
      // resurrects a card the customer re-added after deleting it.
      'deleted_at': null,
    };
  }

  @override
  SyncRecord<BinderEntry>? fromRow(Map<String, dynamic> row) {
    final fields = readRowSyncFields(row);
    final cardId = row['card_id'] as String?;
    if (fields == null || cardId == null) return null;

    final isWanted = row['is_wanted'] as bool? ?? false;
    final condition = row['condition'] as String? ?? 'NM';
    final binderId = isWanted ? null : (row['binder_id'] as String? ?? BinderIds.trade);
    final id = (row['client_id'] as String?) ??
        entryClientId(
          cardId: cardId,
          isWanted: isWanted,
          binderId: binderId,
          condition: condition,
        );
    if (fields.deleted) {
      return SyncRecord<BinderEntry>.deleted(id: id, updatedAt: fields.updatedAt);
    }

    final stub = row['card'];
    if (stub is! Map) return null;

    return SyncRecord(
      id: id,
      value: BinderEntry(
        card: CardModel.fromStub(Map<String, dynamic>.from(stub)),
        quantity: (row['quantity'] as num?)?.toInt() ?? 1,
        condition: condition,
        isWanted: isWanted,
        binderId: binderId,
        addedAt: DateTime.tryParse(row['added_at'] as String? ?? '') ??
            fields.updatedAt,
      ),
      updatedAt: fields.updatedAt,
    );
  }
}
