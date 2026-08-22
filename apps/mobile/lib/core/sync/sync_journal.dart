import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// The collections that sync, one per local storage key.
enum SyncDomain {
  binder('binder'),
  binders('binders'),
  lend('lend'),
  trades('trades'),
  settings('settings');

  const SyncDomain(this.key);

  final String key;
}

/// Bookkeeping that makes local writes reconcilable: when each record last
/// changed on this device, and which records were deleted here.
///
/// This lives beside the data rather than inside it. Adding `updatedAt` to
/// `BinderEntry`, `Trade`, and `LendGroup` would change the on-disk format that
/// existing installs already hold, and would put a sync concern into models that
/// the rest of the app treats as plain value types.
///
/// It also remembers which account the local data belongs to, which is what stops
/// one customer's binder being uploaded into another's account after a device is
/// handed over or a second account signs in.
class SyncJournal {
  SyncJournal(this._prefs);

  final SharedPreferences _prefs;

  static const _key = 'sync_journal_v1';

  Map<String, dynamic> _read() {
    final raw = _prefs.getString(_key);
    if (raw == null) return {};
    try {
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      // Losing the journal costs a full re-upload, not data: every local record
      // falls back to its own natural timestamp and merges again.
      return {};
    }
  }

  Future<void> _write(Map<String, dynamic> journal) =>
      _prefs.setString(_key, jsonEncode(journal));

  /// The account the local cache currently represents, or null if it has never
  /// been synced.
  String? get syncedUserId => _read()['user_id'] as String?;

  Future<void> setSyncedUserId(String userId) async {
    final journal = _read()..['user_id'] = userId;
    await _write(journal);
  }

  /// Forgets everything, including which account the data belonged to. Used when a
  /// different account signs in, where local provenance is worse than none.
  Future<void> clear() => _prefs.remove(_key);

  Map<String, dynamic> _domain(Map<String, dynamic> journal, SyncDomain domain) {
    final domains = journal['domains'];
    if (domains is! Map) return {};
    final entry = domains[domain.key];
    return entry is Map ? Map<String, dynamic>.from(entry) : {};
  }

  /// When each live local record last changed on this device.
  Map<String, DateTime> localTimestamps(SyncDomain domain) {
    final records = _domain(_read(), domain)['records'];
    if (records is! Map) return {};
    final result = <String, DateTime>{};
    records.forEach((id, value) {
      if (value is! Map) return;
      final at = DateTime.tryParse(value['at'] as String? ?? '');
      if (at != null && value['deleted'] != true) result[id as String] = at;
    });
    return result;
  }

  /// The latest timestamp this device has ever seen in a domain, from either side.
  ///
  /// Local edits are stamped past this rather than at the wall clock, which turns
  /// ordering into something closer to a logical clock: an edit made here is newer
  /// than everything this device knows about, whoever wrote it. Without that, three
  /// ordinary situations produce unorderable timestamps and silently lose an edit:
  /// two changes inside the same millisecond, a device whose clock runs behind
  /// another's, and re-adding a record whose deletion has already been forgotten
  /// locally.
  DateTime? highWaterMark(SyncDomain domain) {
    final raw = _domain(_read(), domain)['high_water_mark'];
    return raw is String ? DateTime.tryParse(raw) : null;
  }

  /// The instant a sync starting now should treat as the present, for [domain].
  ///
  /// Never earlier than [highWaterMark], because local stamps are logical rather
  /// than wall-clock: two edits in the same millisecond are ordered by pushing the
  /// second one into the future, so an edit made a moment ago can carry a timestamp
  /// the wall clock has not reached. Comparing that against `DateTime.now()` would
  /// read it as concurrent with the sync and protect it from being reconciled — and
  /// a tombstone protected that way is never dropped, so the deletion is re-applied
  /// on every sync forever.
  DateTime syncStart(SyncDomain domain) {
    final now = DateTime.now().toUtc();
    final mark = highWaterMark(domain);
    return mark == null || now.isAfter(mark) ? now : mark;
  }

  /// Records deleted on this device and not yet known to have reached the server.
  Map<String, DateTime> tombstones(SyncDomain domain) {
    final records = _domain(_read(), domain)['records'];
    if (records is! Map) return {};
    final result = <String, DateTime>{};
    records.forEach((id, value) {
      if (value is! Map) return;
      final at = DateTime.tryParse(value['at'] as String? ?? '');
      if (at != null && value['deleted'] == true) result[id as String] = at;
    });
    return result;
  }

  /// Notes the effect of a local write by diffing fingerprints.
  ///
  /// Fingerprints rather than a dirty flag, because the notifiers rewrite the whole
  /// collection on every edit. Stamping every record on every save would make each
  /// local write look newer than any concurrent remote edit, which would quietly
  /// turn last-write-wins into "this device always wins".
  Future<void> noteLocalWrite(
    SyncDomain domain, {
    required Map<String, String> before,
    required Map<String, String> after,
    DateTime? at,
  }) async {
    final now = (at ?? DateTime.now()).toUtc();
    final journal = _read();
    final domains = journal['domains'] is Map
        ? Map<String, dynamic>.from(journal['domains'] as Map)
        : <String, dynamic>{};
    final entry = _domain(journal, domain);
    final records = entry['records'] is Map
        ? Map<String, dynamic>.from(entry['records'] as Map)
        : <String, dynamic>{};

    var ceiling = _after(entry['high_water_mark'], now);

    DateTime stamp(Object? existing) {
      final at = _after(existing is Map ? existing['at'] : null, ceiling);
      ceiling = at;
      return at;
    }

    for (final id in after.keys) {
      final unchanged = before[id] == after[id];
      final known = records[id] is Map && records[id]['deleted'] != true;
      if (unchanged && known) continue;
      records[id] = {'at': stamp(records[id]).toIso8601String()};
    }

    for (final id in before.keys) {
      if (after.containsKey(id)) continue;
      records[id] = {
        'at': stamp(records[id]).toIso8601String(),
        'deleted': true,
      };
    }

    entry['records'] = records;
    entry['high_water_mark'] = ceiling.toIso8601String();
    domains[domain.key] = entry;
    journal['domains'] = domains;
    await _write(journal);
  }

  /// [floor], or one millisecond past [previous] when that is not already later.
  static DateTime _after(Object? previous, DateTime floor) {
    final at = previous is String ? DateTime.tryParse(previous) : null;
    if (at == null || floor.isAfter(at)) return floor;
    return at.add(const Duration(milliseconds: 1));
  }

  /// Replaces a domain's bookkeeping with the result of a completed sync, keeping
  /// any entry stamped after [preserveAfter].
  ///
  /// The exception exists because a sync is not atomic with respect to the UI. A
  /// card added or deleted while the sync was in flight is not represented in its
  /// answer, and overwriting it would lose that edit — silently, since the local
  /// data would still be there but would never be pushed.
  ///
  /// Tombstones from the sync itself are not carried over: once a deletion has been
  /// recorded upstream, the remote row is what keeps it from coming back, and
  /// keeping a local copy of every deletion ever made would grow without bound.
  Future<void> replaceRecords(
    SyncDomain domain, {
    required Map<String, DateTime> live,
    required DateTime preserveAfter,
    DateTime? observed,
  }) async {
    final journal = _read();
    final domains = journal['domains'] is Map
        ? Map<String, dynamic>.from(journal['domains'] as Map)
        : <String, dynamic>{};
    final entry = _domain(journal, domain);
    final existing = entry['records'] is Map
        ? Map<String, dynamic>.from(entry['records'] as Map)
        : <String, dynamic>{};

    final records = <String, dynamic>{
      for (final e in live.entries)
        e.key: {'at': e.value.toUtc().toIso8601String()},
    };

    existing.forEach((id, value) {
      if (value is! Map) return;
      final at = DateTime.tryParse(value['at'] as String? ?? '');
      if (at != null && at.isAfter(preserveAfter)) records[id] = value;
    });

    entry['records'] = records;
    if (observed != null) {
      final mark = highWaterMark(domain);
      if (mark == null || observed.isAfter(mark)) {
        entry['high_water_mark'] = observed.toUtc().toIso8601String();
      }
    }
    domains[domain.key] = entry;
    journal['domains'] = domains;
    await _write(journal);
  }
}
