import 'package:flutter/foundation.dart';

import 'binders_sync.dart';
import 'remote_store.dart';
import 'sync_adapter.dart';
import 'sync_journal.dart';
import 'sync_record.dart';

/// One round of reconciliation for a single collection.
///
/// The order of operations is the load-bearing part. Push happens before the local
/// cache is touched, so a failed push leaves both sides exactly as they were and
/// the next attempt is a clean retry. The local write and the journal update then
/// happen together, because a local write without matching journal entries would
/// look like a fresh local edit and make this device win the next merge by default.
class CollectionSync<T> {
  CollectionSync({
    required this.adapter,
    required this.local,
    required this.remote,
    required this.journal,
  });

  final SyncAdapter<T> adapter;
  final LocalCollection<T> local;
  final RemoteCollection remote;
  final SyncJournal journal;

  /// Reconciles local and remote. Returns true when the local cache changed, so
  /// the caller knows whether any UI needs rebuilding.
  Future<bool> run({required String userId}) async {
    final startedAt = journal.syncStart(adapter.domain);
    final localRecords = _localRecords();
    final remoteRecords = await _pull(userId);
    final remoteById = {for (final r in remoteRecords) r.id: r};

    final merged = mergeRecords(localRecords, remoteRecords);

    await _push(
      userId: userId,
      merged: merged,
      remoteById: remoteById,
    );

    return _applyLocally(merged, startedAt: startedAt);
  }

  /// Local state as records: live values stamped from the journal (or their own
  /// creation time), plus deletions the journal is still holding.
  List<SyncRecord<T>> _localRecords() {
    final timestamps = journal.localTimestamps(adapter.domain);
    final records = <SyncRecord<T>>[];

    for (final value in local.load()) {
      final id = adapter.idOf(value);
      records.add(
        SyncRecord(
          id: id,
          value: value,
          updatedAt: timestamps[id] ?? adapter.fallbackTimestamp(value).toUtc(),
        ),
      );
    }

    journal.tombstones(adapter.domain).forEach((id, at) {
      records.add(SyncRecord<T>.deleted(id: id, updatedAt: at));
    });

    return records;
  }

  /// Fetches the whole collection rather than only rows newer than the last sync.
  ///
  /// These are personal collections — a binder, a lend list, a trade history — so
  /// the saving is negligible, and a full read means a row this device has never
  /// seen is indistinguishable from one it has forgotten. Incremental pulls get
  /// that wrong after a reinstall.
  Future<List<SyncRecord<T>>> _pull(String userId) async {
    final rows = await remote.fetchAll(userId);

    final records = <SyncRecord<T>>[];
    for (final row in rows) {
      final record = adapter.fromRow(row);
      if (record == null) {
        debugPrint('Sync: skipped an unreadable ${adapter.table} row');
        continue;
      }
      records.add(record);
    }
    return records;
  }

  Future<void> _push({
    required String userId,
    required List<MergedRecord<T>> merged,
    required Map<String, SyncRecord<T>> remoteById,
  }) async {
    final upserts = <Map<String, Object?>>[];
    final tombstones = <SyncRecord<T>>[];

    for (final entry in merged) {
      if (entry.winner != SyncSide.local) continue;
      final record = entry.record;

      // Already identical upstream. Re-sending would be harmless but would make
      // every sync a full rewrite of the collection.
      //
      // Deleted-ness has to be part of that comparison. A record created and then
      // deleted inside the same millisecond carries the same timestamp on both
      // sides, and comparing only timestamps would drop the deletion on the floor.
      final remote = remoteById[record.id];
      if (remote != null &&
          remote.updatedAt == record.updatedAt &&
          remote.isDeleted == record.isDeleted) {
        continue;
      }

      final value = record.value;
      if (value == null) {
        // Nothing upstream to tombstone: the record never left this device, so
        // dropping it locally is the entire deletion.
        if (remote != null) tombstones.add(record);
      } else {
        upserts.add(
          adapter.toRow(value, userId: userId, updatedAt: record.updatedAt),
        );
      }
    }

    try {
      await remote.upsertAll(upserts);
    } catch (e) {
      if (adapter.domain == SyncDomain.binders &&
          isLiveNameUniqueViolation(e)) {
        throw StateError('A Binder with that name already exists');
      }
      rethrow;
    }

    for (final record in tombstones) {
      await remote.markDeleted(
        userId: userId,
        identity: adapter.identityFilter(record.id),
        at: record.updatedAt,
      );
    }
  }

  /// Writes the merged collection back to the local cache and restamps the journal
  /// to match, then reports whether anything actually changed.
  Future<bool> _applyLocally(
    List<MergedRecord<T>> merged, {
    required DateTime startedAt,
  }) async {
    final live = <T>[];
    final liveTimes = <String, DateTime>{};
    DateTime? observed;

    for (final entry in merged) {
      final at = entry.record.updatedAt;
      if (observed == null || at.isAfter(observed)) observed = at;

      final value = entry.record.value;
      if (value == null) continue;
      live.add(value);
      liveTimes[entry.record.id] = at;
    }

    live.sort(adapter.compare);

    final changed = !_sameCollection(local.load(), live);
    if (changed) await local.saveSynced(live);

    await journal.replaceRecords(
      adapter.domain,
      live: liveTimes,
      preserveAfter: startedAt,
      // Includes deletions, whose journal entries are about to be dropped. Without
      // it, re-adding a record could be stamped behind its own forgotten tombstone.
      observed: observed,
    );

    return changed;
  }

  bool _sameCollection(List<T> a, List<T> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (adapter.idOf(a[i]) != adapter.idOf(b[i])) return false;
      if (adapter.fingerprint(a[i]) != adapter.fingerprint(b[i])) return false;
    }
    return true;
  }
}
