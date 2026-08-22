import 'dart:convert';

import '../models/binder.dart';
import 'sync_adapter.dart';
import 'sync_journal.dart';
import 'sync_record.dart';

/// Maps Binder records onto `public.binders`.
///
/// Identity is the client-minted [Binder.clientId]. Defaults use stable
/// `system:trade` / `system:collection` ids so devices converge on one pair.
class BindersSyncAdapter implements SyncAdapter<Binder> {
  const BindersSyncAdapter();

  @override
  SyncDomain get domain => SyncDomain.binders;

  @override
  String get table => 'binders';

  @override
  String get conflictTarget => 'user_id,client_id';

  @override
  String idOf(Binder value) => value.clientId;

  @override
  Map<String, Object?> identityFilter(String id) => {'client_id': id};

  @override
  String fingerprint(Binder value) => jsonEncode(value.toJson());

  @override
  DateTime fallbackTimestamp(Binder value) => value.updatedAt;

  @override
  int compare(Binder a, Binder b) => a.createdAt.compareTo(b.createdAt);

  @override
  Map<String, Object?> toRow(
    Binder value, {
    required String userId,
    required DateTime updatedAt,
  }) {
    return {
      'user_id': userId,
      'client_id': value.clientId,
      'name': value.name,
      'role': value.role.wire,
      'created_at': value.createdAt.toUtc().toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'deleted_at': value.deletedAt?.toUtc().toIso8601String(),
    };
  }

  @override
  SyncRecord<Binder>? fromRow(Map<String, dynamic> row) {
    final fields = readRowSyncFields(row);
    final id = row['client_id'] as String?;
    if (fields == null || id == null) return null;

    if (fields.deleted) {
      return SyncRecord<Binder>.deleted(id: id, updatedAt: fields.updatedAt);
    }

    return SyncRecord(
      id: id,
      value: Binder.fromJson({
        'client_id': id,
        'name': row['name'],
        'role': row['role'],
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
        'deleted_at': row['deleted_at'],
      }),
      updatedAt: fields.updatedAt,
    );
  }
}
