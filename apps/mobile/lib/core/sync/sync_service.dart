import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/binder_repository.dart';
import '../data/binders_repository.dart';
import '../data/lend_repository.dart';
import '../data/settings_repository.dart';
import '../data/trade_repository.dart';
import '../models/binder.dart';
import '../models/binder_entry.dart';
import '../models/lend_group.dart';
import '../models/trade.dart';
import 'binder_sync.dart';
import 'binders_sync.dart';
import 'collection_sync.dart';
import 'lend_sync.dart';
import 'remote_store.dart';
import 'settings_sync.dart';
import 'sync_adapter.dart';
import 'sync_journal.dart';
import 'trade_sync.dart';

/// Which parts of the local cache a sync changed, so only the affected screens
/// rebuild.
class SyncOutcome {
  const SyncOutcome({
    this.binderChanged = false,
    this.bindersChanged = false,
    this.lendChanged = false,
    this.tradesChanged = false,
    this.settingsChanged = false,
  });

  final bool binderChanged;
  final bool bindersChanged;
  final bool lendChanged;
  final bool tradesChanged;
  final bool settingsChanged;

  bool get anyChanged =>
      binderChanged ||
      bindersChanged ||
      lendChanged ||
      tradesChanged ||
      settingsChanged;
}

/// Reconciles every synced collection for the signed-in account.
///
/// Sync is never a precondition for using the app. Each collection is reconciled
/// independently and a failure in one is reported but does not abandon the others,
/// because a single unreachable table should not leave a customer's binder stranded.
class SyncService {
  SyncService({
    required this.journal,
    required this.binder,
    required this.binders,
    required this.lend,
    required this.trades,
    required this.settings,
  });

  /// Wires the collections up against a live Supabase project.
  factory SyncService.forSupabase({
    required SupabaseClient client,
    required SyncJournal journal,
    required BinderRepository binder,
    required BindersRepository binders,
    required LendRepository lend,
    required TradeRepository trades,
    required SettingsRepository settings,
  }) {
    CollectionSync<T> collection<T>(
        SyncAdapter<T> adapter, LocalCollection<T> local) {
      return CollectionSync(
        adapter: adapter,
        local: local,
        journal: journal,
        remote: SupabaseRemoteCollection(
          client: client,
          table: adapter.table,
          conflictTarget: adapter.conflictTarget,
        ),
      );
    }

    return SyncService(
      journal: journal,
      binder: collection(const BinderSyncAdapter(), binder),
      binders: collection(const BindersSyncAdapter(), binders),
      lend: collection(const LendSyncAdapter(), lend),
      trades: collection(const TradeSyncAdapter(), trades),
      settings: SettingsSync(
        repository: settings,
        remote: SupabaseRemoteSettings(client),
        journal: journal,
      ),
    );
  }

  final SyncJournal journal;
  final CollectionSync<BinderEntry> binder;
  final CollectionSync<Binder> binders;
  final CollectionSync<LendGroup> lend;
  final CollectionSync<Trade> trades;
  final SettingsSync settings;

  /// Reconciles everything for [userId].
  ///
  /// Throws only if every collection failed, which is the signal that the problem is
  /// the connection rather than the data.
  Future<SyncOutcome> run(String userId) async {
    await _claimLocalDataFor(userId);

    final failures = <Object>[];
    Future<bool> attempt(Future<bool> Function() body) async {
      try {
        return await body();
      } catch (e) {
        debugPrint('Sync: $e');
        failures.add(e);
        return false;
      }
    }

    final outcome = SyncOutcome(
      bindersChanged: await attempt(() => binders.run(userId: userId)),
      binderChanged: await attempt(() => binder.run(userId: userId)),
      lendChanged: await attempt(() => lend.run(userId: userId)),
      tradesChanged: await attempt(() => trades.run(userId: userId)),
      settingsChanged: await attempt(() => settings.run(userId: userId)),
    );

    if (failures.length == 5) throw failures.first;
    return outcome;
  }

  /// Decides whether the data already on this device belongs to [userId].
  ///
  /// Three cases, and the middle one is the reason this exists:
  ///
  /// * **Never synced.** The data was built while signed out, so it is this
  ///   customer's. Left alone, it merges upward on the first sync — which is the
  ///   whole migration path off device-local storage.
  /// * **Belongs to somebody else.** A second account on a shared device, or a phone
  ///   that changed hands. Uploading here would move one person's binder into
  ///   another's account, so the local cache is discarded instead.
  /// * **Same account.** Ordinary incremental sync.
  Future<void> _claimLocalDataFor(String userId) async {
    final previous = journal.syncedUserId;
    if (previous == userId) return;

    if (previous != null) {
      // `saveSynced`, not `save`: this is not the customer deleting their binder, and
      // recording it as one would push those deletions into the new account.
      await binder.local.saveSynced(const []);
      await binders.local.saveSynced(const []);
      await lend.local.saveSynced(const []);
      await trades.local.saveSynced(const []);
      // Settings survive. They are a device preference as much as an account one,
      // and resetting somebody's theme on sign-in would read as a bug.
      await journal.clear();
    }

    await journal.setSyncedUserId(userId);
  }
}
