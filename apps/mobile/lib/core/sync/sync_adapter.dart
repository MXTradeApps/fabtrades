import 'sync_journal.dart';
import 'sync_record.dart';

/// The local half of a synced collection.
///
/// Deliberately the shape the existing repositories already have: a synchronous
/// read so the UI keeps its instant first frame, and a wholesale write because the
/// notifiers replace the whole list on every edit.
abstract class LocalCollection<T> {
  List<T> load();

  /// A customer edit. Recorded as a local change so it gets pushed.
  Future<void> save(List<T> values);

  /// The result of a merge. Deliberately *not* recorded as a local change: the
  /// engine already knows when each of these records last changed, and stamping them
  /// as edits made here would make this device win every subsequent merge.
  Future<void> saveSynced(List<T> values);
}

/// Everything the sync engine needs to know about one collection: how its records
/// are identified, ordered, fingerprinted, and mapped to and from a Postgres row.
///
/// One implementation per table, and the only place in the app that names that
/// table's columns.
abstract class SyncAdapter<T> {
  SyncDomain get domain;

  /// Postgres table backing this collection.
  String get table;

  /// Columns that make a row unique, for upsert conflict resolution.
  String get conflictTarget;

  /// Stable across devices and across app restarts.
  String idOf(T value);

  /// Columns that locate the row for [id], used to tombstone it. Returned as a
  /// map rather than an id string because some collections are identified by what
  /// they are (a printing on a list) rather than by a minted id.
  Map<String, Object?> identityFilter(String id);

  /// Canonical serialization, compared to detect which records a local write
  /// actually changed. Any stable, total encoding of the value will do.
  String fingerprint(T value);

  /// Timestamp to assume for a record the journal has never seen — data that
  /// predates sync, or survived a journal loss. The record's own creation time is
  /// the honest answer: it means a later edit made on another device wins.
  DateTime fallbackTimestamp(T value);

  /// Display order, applied after a merge so a pulled collection reads the same
  /// way a locally built one does.
  int compare(T a, T b);

  Map<String, Object?> toRow(
    T value, {
    required String userId,
    required DateTime updatedAt,
  });

  /// Parses a row, or returns null if it is unintelligible. A single malformed row
  /// should cost that one record, not the whole sync.
  SyncRecord<T>? fromRow(Map<String, dynamic> row);
}

/// Reads `updated_at` / `deleted_at` the way every synced table stores them.
///
/// Shared by the adapters because getting it wrong is silent: a row parsed with a
/// local-time timestamp would win or lose merges by hours.
({DateTime updatedAt, bool deleted})? readRowSyncFields(
  Map<String, dynamic> row,
) {
  final updatedAt = DateTime.tryParse(row['updated_at'] as String? ?? '');
  if (updatedAt == null) return null;
  return (updatedAt: updatedAt.toUtc(), deleted: row['deleted_at'] != null);
}
