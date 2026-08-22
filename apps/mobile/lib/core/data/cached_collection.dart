import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../sync/sync_adapter.dart';
import '../sync/sync_journal.dart';

/// A user-owned collection cached on the device as a single JSON array, with the
/// bookkeeping that lets its writes be synced.
///
/// The local cache stays authoritative for reads. Every screen expects its data on
/// the first frame, and going to the network for a binder would put a spinner in
/// front of something the customer has offline anyway. Sync happens behind that,
/// reconciling the cache rather than replacing it.
///
/// Subclasses supply only the storage key and the codec; the load, save, and journal
/// behaviour — including what happens to unreadable data — is decided once here.
abstract class CachedCollection<T> implements LocalCollection<T> {
  CachedCollection(this._prefs, this._journal);

  final SharedPreferences _prefs;
  final SyncJournal _journal;

  /// SharedPreferences key. Existing installs already hold data under these, so
  /// they are effectively permanent.
  String get storageKey;

  /// Whether this collection has ever been written (including an empty list).
  bool get hasStorageKey => _prefs.containsKey(storageKey);

  SyncAdapter<T> get adapter;

  Map<String, dynamic> encode(T value);
  T decode(Map<String, dynamic> json);

  /// Returns an empty collection for missing *or* unreadable data.
  ///
  /// Throwing would leave the app unusable with no way out short of a reinstall,
  /// and the next save overwrites the bad value anyway.
  @override
  List<T> load() {
    final raw = _prefs.getString(storageKey);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .map((e) => decode(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Writes to the device, then records what changed so sync can pick it up.
  ///
  /// The journal is updated here rather than in the notifiers because this is the
  /// single point every edit funnels through. A write that bypassed it would persist
  /// locally and then silently never reach the customer's other devices.
  @override
  Future<void> save(List<T> values) async {
    final before = fingerprints(load());
    await _write(values);
    await _journal.noteLocalWrite(
      adapter.domain,
      before: before,
      after: fingerprints(values),
    );
  }

  @override
  Future<void> saveSynced(List<T> values) => _write(values);

  Future<void> _write(List<T> values) =>
      _prefs.setString(storageKey, jsonEncode(values.map(encode).toList()));

  Map<String, String> fingerprints(List<T> values) => {
        for (final v in values) adapter.idOf(v): adapter.fingerprint(v),
      };
}
