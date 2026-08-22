import 'dart:async';

import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'analytics/analytics.dart';
import 'data/app_update_repository.dart';
import 'data/auth_repository.dart';
import 'data/card_repository.dart';
import 'data/catalog_repository.dart';
import 'data/binder_repository.dart';
import 'data/binders_repository.dart';
import 'data/entitlement_repository.dart';
import 'data/lend_repository.dart';
import 'data/purchases_repository.dart';
import 'data/set_logo_cache.dart';
import 'data/set_logos.dart';
import 'data/set_published_on.dart';
import 'data/settings_repository.dart';
import 'data/trade_repository.dart';
import 'logic/confirm_trade.dart';
import 'logic/free_limits.dart';
import 'logic/pricing.dart';
import 'models/account.dart';
import 'models/app_settings.dart';
import 'models/binder.dart';
import 'models/binder_entry.dart';
import 'models/card_model.dart';
import 'models/entitlement.dart';
import 'models/lend_group.dart';
import 'models/purchase_outcome.dart';
import 'models/subscription_status.dart';
import 'models/trade.dart';
import 'scan/card_hash_index.dart';
import 'sync/sync_journal.dart';
import 'sync/sync_rate_limiter.dart';
import 'sync/sync_service.dart';

/// Overridden in main() with the real instance.
final sharedPreferencesProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('SharedPreferences not initialized'),
);

final supabaseClientProvider =
    Provider<SupabaseClient>((ref) => Supabase.instance.client);

final cardRepositoryProvider = Provider<CardRepository>(
    (ref) => CardRepository(ref.watch(supabaseClientProvider)));

/// Daily catalog snapshots for one Printing (`fab_price_history`). Empty list
/// is success (no history yet), not an error. Window clipping is client-side.
final priceHistoryProvider =
    FutureProvider.family<List<PricePoint>, String>((ref, cardId) {
  return ref.watch(cardRepositoryProvider).priceHistory(cardId);
});

final appUpdateRepositoryProvider = Provider<AppUpdateRepository>(
  (ref) => AppUpdateRepository(
    ref.watch(supabaseClientProvider),
    ref.watch(sharedPreferencesProvider),
  ),
);

/// Soft update prompt when the installed build is behind `fab_app_config`.
/// Resolves to null when up to date, dismissed, or the check fails
/// (including tests where Supabase / PackageInfo are unavailable).
final appUpdatePromptProvider = FutureProvider<AppUpdatePrompt?>((ref) async {
  try {
    return await ref.read(appUpdateRepositoryProvider).checkForUpdatePrompt();
  } catch (_) {
    return null;
  }
});

/// Installed app version label for Settings (e.g. `1.0.1 (4)`).
final packageVersionLabelProvider = FutureProvider<String>((ref) async {
  final info = await ref.watch(appUpdateRepositoryProvider).packageInfo();
  return '${info.version} (${info.buildNumber})';
});

// ---------------------------------------------------------------------------
// Card catalog (preloaded + cached locally for instant, offline browsing)
// ---------------------------------------------------------------------------
final catalogRepositoryProvider = Provider<CatalogRepository>(
    (ref) => CatalogRepository(ref.watch(sharedPreferencesProvider)));

/// Holds the whole card catalog. On startup it returns the locally cached
/// catalog immediately (no spinner) and refreshes prices from Supabase in the
/// background; if there is no cache yet it fetches once and stores it.
class CatalogNotifier extends AsyncNotifier<List<CardModel>> {
  @override
  Future<List<CardModel>> build() async {
    final store = ref.watch(catalogRepositoryProvider);
    final cached = store.load();
    if (cached != null && cached.isNotEmpty) {
      _refreshInBackground();
      return cached;
    }
    final cards = await ref.watch(cardRepositoryProvider).fetchAll();
    await store.save(cards);
    return cards;
  }

  Future<void> _refreshInBackground() async {
    try {
      final cards = await ref.read(cardRepositoryProvider).fetchAll();
      await ref.read(catalogRepositoryProvider).save(cards);
      state = AsyncData(cards);
    } catch (_) {
      // Keep serving the cached catalog if the refresh fails.
    }
  }

  /// Pull-to-refresh: re-fetch the catalog so the latest synced prices show.
  Future<void> refresh() async {
    final cards = await ref.read(cardRepositoryProvider).fetchAll();
    await ref.read(catalogRepositoryProvider).save(cards);
    state = AsyncData(cards);
  }
}

final catalogProvider =
    AsyncNotifierProvider<CatalogNotifier, List<CardModel>>(
        CatalogNotifier.new);

/// Perceptual hashes of every catalog image, bundled as an asset for the
/// visual card scanner (regenerated per set release by
/// `tool/generate_card_hashes.dart`).
final cardHashIndexProvider = FutureProvider<CardHashIndex>((ref) async {
  final jsonText = await rootBundle.loadString('assets/scan/card_hashes.json');
  return CardHashIndex.fromJson(jsonText);
});

/// Official FAB set logos (TCGplayer group id → CDN URL), bundled as an asset.
/// After load, logos are downloaded into the on-device [SetLogoCache] so the
/// browse list can scroll without re-fetching from the CDN.
final setLogoMapProvider = FutureProvider<SetLogoMap>((ref) async {
  final map = await loadSetLogoMap();
  unawaited(SetLogoCache.warm(map.urls));
  return map;
});

/// Set release dates from `fab_sets.published_on`, cached locally so browse
/// can sort newest-first within each section offline. Serves the cache
/// immediately and refreshes from Supabase in the background.
class SetPublishedOnNotifier extends AsyncNotifier<SetPublishedOnMap> {
  @override
  Future<SetPublishedOnMap> build() async {
    final store = SetPublishedOnRepository(ref.watch(sharedPreferencesProvider));
    final cached = store.load();
    if (cached != null && !cached.isEmpty) {
      _refreshInBackground();
      return cached;
    }
    final map = await ref.watch(cardRepositoryProvider).fetchSetPublishedOn();
    await store.save(map);
    return map;
  }

  Future<void> _refreshInBackground() async {
    try {
      final map = await ref.read(cardRepositoryProvider).fetchSetPublishedOn();
      await SetPublishedOnRepository(ref.read(sharedPreferencesProvider))
          .save(map);
      state = AsyncData(map);
    } catch (_) {
      // Keep serving the cached dates if the refresh fails.
    }
  }
}

final setPublishedOnMapProvider =
    AsyncNotifierProvider<SetPublishedOnNotifier, SetPublishedOnMap>(
        SetPublishedOnNotifier.new);

/// Catalog keyed by printing id, for O(1) lookups (used by the scanner to
/// resolve hash-match ids to cards on every frame).
final catalogByIdProvider = Provider<Map<String, CardModel>>((ref) {
  final cards = ref.watch(catalogProvider).asData?.value ?? const <CardModel>[];
  return {for (final c in cards) c.id: c};
});

/// Normalized name keys of every token card in the catalog, for the scanner's
/// token-mention guard in [identifyCards]. Memoized so the per-frame OCR path
/// does not rescan ~10k rows (and run [baseCardName] on each) on every call —
/// live scanning invokes identify up to twice per frame.
final tokenNameKeysProvider = Provider<Set<String>>((ref) {
  final cards = ref.watch(catalogProvider).asData?.value ?? const <CardModel>[];
  return tokenNameKeys(cards);
});

/// Catalog printings indexed by every set-code key they can be recognized
/// under ([buildSetCodeIndex]). Memoized like [tokenNameKeysProvider] — the
/// builder walks ~16k rows, so it must never run on the per-frame scan path.
final setCodeIndexProvider = Provider<SetCodeIndex>((ref) {
  final cards = ref.watch(catalogProvider).asData?.value ?? const <CardModel>[];
  return buildSetCodeIndex(cards);
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
final settingsRepositoryProvider = Provider<SettingsRepository>((ref) =>
    SettingsRepository(
        ref.watch(sharedPreferencesProvider), ref.watch(syncJournalProvider)));

class SettingsNotifier extends Notifier<AppSettings> {
  @override
  AppSettings build() => ref.watch(settingsRepositoryProvider).load();

  void setSource(PriceSource source) {
    state = state.copyWith(source: source);
    ref.read(settingsRepositoryProvider).save(state);
    ref
        .read(analyticsProvider)
        .capture('price_source_changed', {'price_source': source.name});
  }

  void setThemeMode(AppThemeMode themeMode) {
    state = state.copyWith(themeMode: themeMode);
    ref.read(settingsRepositoryProvider).save(state);
    ref
        .read(analyticsProvider)
        .capture('theme_changed', {'theme': themeMode.name});
  }
}

final settingsProvider =
    NotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);

final pricingProvider =
    Provider<Pricing>((ref) => Pricing(ref.watch(settingsProvider)));

// ---------------------------------------------------------------------------
// Accounts (Supabase Auth)
// ---------------------------------------------------------------------------

/// Requires `Supabase.initialize` to have run, which main() guarantees. Widget
/// tests never reach it because [accountProvider] is overridden instead.
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final auth = AuthRepository(ref.watch(supabaseClientProvider));
  ref.onDispose(auth.dispose);
  return auth;
});

/// The signed-in account, or null when signed out.
///
/// Backed by Supabase's auth state stream, so a token refresh, an expiry, or a
/// browser sign-in landing back on the app all flow through here. Supabase
/// emits the restored session as soon as this is listened to, so the loading
/// state is brief rather than a real "unknown" period.
final accountProvider = StreamProvider<Account?>((ref) {
  final auth = ref.watch(authRepositoryProvider);
  return auth.authStateChanges.map((state) {
    final user = state.session?.user;
    return user == null ? null : Account.fromUser(user);
  });
});

/// Whether someone is signed in right now.
///
/// Treats "still loading" as signed out, which is the safe direction: it may
/// briefly offer sign-in to someone already signed in, whereas the opposite
/// would show account-only UI to a guest.
final isSignedInProvider = Provider<bool>(
  (ref) => ref.watch(accountProvider).value != null,
);

/// Sign-in options worth showing on this device. Apple only appears on Apple
/// platforms, where its native sheet exists.
final authProvidersProvider = FutureProvider<List<AuthProviderKind>>(
  (ref) => ref.watch(authRepositoryProvider).availableProviders(),
);

// ---------------------------------------------------------------------------
// Cloud sync
// ---------------------------------------------------------------------------

final syncJournalProvider = Provider<SyncJournal>(
  (ref) => SyncJournal(ref.watch(sharedPreferencesProvider)),
);

final syncServiceProvider = Provider<SyncService>(
  (ref) => SyncService.forSupabase(
    client: ref.watch(supabaseClientProvider),
    journal: ref.watch(syncJournalProvider),
    binder: ref.watch(binderRepositoryProvider),
    binders: ref.watch(bindersRepositoryProvider),
    lend: ref.watch(lendRepositoryProvider),
    trades: ref.watch(tradeRepositoryProvider),
    settings: ref.watch(settingsRepositoryProvider),
  ),
);

/// What the customer can be told about sync, and nothing more.
///
/// Deliberately not an `AsyncValue`: a failed sync is not a failed screen. The
/// binder still renders from the local cache, so this reports a problem beside the
/// data rather than in place of it.
class SyncStatus {
  const SyncStatus({
    this.isSyncing = false,
    this.lastSyncedAt,
    this.error,
  });

  final bool isSyncing;
  final DateTime? lastSyncedAt;

  /// Message safe to show, or null when the last attempt succeeded or none has run.
  final String? error;
}

/// Reconciles the local cache with the server whenever an account signs in.
///
/// Signed out this does nothing at all, which is the point: the app has always
/// worked without an account and continues to.
///
/// Opportunistic syncs (binder adds, pull-to-refresh) are rate-limited via
/// [SyncRateLimiter] so a scan burst or repeated swipe cannot hammer Supabase.
/// Settings "Sync now" and sign-in always run immediately.
class SyncNotifier extends Notifier<SyncStatus> {
  final SyncRateLimiter _rateLimit = SyncRateLimiter();

  Timer? _deferredMutation;
  String? _deferredMutationUserId;
  bool _mutationQueuedDuringSync = false;

  @override
  SyncStatus build() {
    ref.onDispose(() {
      _deferredMutation?.cancel();
      _deferredMutation = null;
    });

    final account = ref.watch(accountProvider).value;
    if (account != null) {
      // Deferred so the notifier finishes building before anything it might
      // invalidate starts rebuilding.
      Future.microtask(() => sync(account.id, trigger: 'sign_in'));
    }
    return const SyncStatus();
  }

  /// Push local binder/want-list writes ASAP, coalesced under the mutation
  /// cooldown so rapid adds (e.g. multi-select or scan) share one reconcile.
  Future<void> syncAfterBinderMutation(String userId) =>
      sync(userId, trigger: 'binder_add');

  /// Binder pull-to-refresh. Rate-limited separately from mutation syncs.
  Future<PullSyncResult> syncFromPullToRefresh(String userId) async {
    if (state.isSyncing) return PullSyncResult.alreadySyncing;
    if (_rateLimit.pullWait() > Duration.zero) {
      return PullSyncResult.rateLimited;
    }
    await _runSync(userId, trigger: 'pull_to_refresh', markPull: true);
    return PullSyncResult.completed;
  }

  Future<void> sync(String userId, {String trigger = 'auto'}) async {
    if (trigger == 'binder_add') {
      await _syncMutation(userId);
      return;
    }
    if (trigger == 'pull_to_refresh') {
      await syncFromPullToRefresh(userId);
      return;
    }

    // Manual / sign-in / other: no cooldown, but quiet opportunistic paths after.
    if (state.isSyncing) return;
    await _runSync(userId, trigger: trigger, markAll: true);
  }

  Future<void> _syncMutation(String userId) async {
    if (state.isSyncing) {
      _deferredMutationUserId = userId;
      _mutationQueuedDuringSync = true;
      return;
    }

    final wait = _rateLimit.mutationWait();
    if (wait > Duration.zero) {
      _scheduleDeferredMutation(userId, wait);
      return;
    }

    await _runSync(userId, trigger: 'binder_add', markMutation: true);
  }

  void _scheduleDeferredMutation(String userId, Duration wait) {
    _deferredMutationUserId = userId;
    _deferredMutation?.cancel();
    _deferredMutation = Timer(wait, () {
      _deferredMutation = null;
      final id = _deferredMutationUserId;
      if (id == null) return;
      unawaited(sync(id, trigger: 'binder_add'));
    });
  }

  Future<void> _runSync(
    String userId, {
    required String trigger,
    bool markMutation = false,
    bool markPull = false,
    bool markAll = false,
  }) async {
    if (state.isSyncing) return;

    if (markAll) {
      _rateLimit.markAll();
    } else {
      if (markMutation) _rateLimit.markMutation();
      if (markPull) _rateLimit.markPull();
    }

    state = SyncStatus(isSyncing: true, lastSyncedAt: state.lastSyncedAt);

    final stopwatch = Stopwatch()..start();
    try {
      final outcome = await ref.read(syncServiceProvider).run(userId);
      _refreshChangedScreens(outcome);
      state = SyncStatus(lastSyncedAt: DateTime.now());
      ref.read(analyticsProvider).capture('sync_completed', {
        'trigger': trigger,
        'duration_ms': stopwatch.elapsedMilliseconds,
      });
    } catch (e) {
      debugPrint('Sync: giving up this round — $e');
      state = SyncStatus(
        lastSyncedAt: state.lastSyncedAt,
        error: "Couldn't sync with your account. Your data is safe on this "
            'device and will sync when the connection recovers.',
      );
      ref.read(analyticsProvider).capture('sync_failed', {
        'trigger': trigger,
        'error_type': e.runtimeType.toString(),
      });
      ref.read(analyticsProvider).captureException(e, StackTrace.current);
    } finally {
      if (_mutationQueuedDuringSync) {
        _mutationQueuedDuringSync = false;
        final id = _deferredMutationUserId;
        if (id != null) {
          // Coalesce writes that landed mid-flight into one follow-up sync.
          _scheduleDeferredMutation(id, SyncRateLimiter.mutationCooldown);
        }
      }
    }
  }

  /// The notifiers read their state once, at build, from the local cache. A sync
  /// that rewrote that cache has to tell them, or the screens keep showing what
  /// they loaded at startup.
  void _refreshChangedScreens(SyncOutcome outcome) {
    if (outcome.binderChanged) ref.invalidate(binderProvider);
    if (outcome.bindersChanged) ref.invalidate(bindersProvider);
    if (outcome.lendChanged) ref.invalidate(lendProvider);
    if (outcome.tradesChanged) ref.invalidate(tradeHistoryProvider);
    if (outcome.settingsChanged) ref.invalidate(settingsProvider);
  }
}

final syncProvider =
    NotifierProvider<SyncNotifier, SyncStatus>(SyncNotifier.new);

// ---------------------------------------------------------------------------
// FABTrades Pro subscription (RevenueCat)
// ---------------------------------------------------------------------------

/// Overridden in main() with the instance configured at startup.
///
/// The default is a deliberately unconfigured repository: widget tests get a
/// safe no-op (no plugin channels, no network) that resolves to the free tier.
final purchasesRepositoryProvider =
    Provider<PurchasesRepository>((ref) => PurchasesRepository());

/// Live `FABTrades Pro` entitlement state.
///
/// Seeded from RevenueCat's cached customer info, then kept current by the
/// SDK's customer info listener — so renewals, expirations, cancellations and
/// deferred payments all land here without polling.
class SubscriptionNotifier extends AsyncNotifier<SubscriptionStatus> {
  @override
  Future<SubscriptionStatus> build() async {
    final purchases = ref.watch(purchasesRepositoryProvider);
    if (!purchases.isConfigured) return SubscriptionStatus.free;

    void onCustomerInfo(CustomerInfo info) {
      state = AsyncData(SubscriptionStatus.fromCustomerInfo(info));
    }

    // Fetch first, then subscribe: writing to `state` while this build is
    // still in flight would be discarded by the returned value anyway.
    final info = await purchases.customerInfo();
    purchases.addCustomerInfoListener(onCustomerInfo);
    ref.onDispose(() => purchases.removeCustomerInfoListener(onCustomerInfo));

    return info == null
        ? SubscriptionStatus.free
        : SubscriptionStatus.fromCustomerInfo(info);
  }

  /// Re-reads entitlements. Purchases and restores update this notifier on
  /// their own; this is for after a RevenueCat Paywall or the Customer Center
  /// hands control back, where the change happened in native UI.
  Future<void> refresh() async {
    final info = await ref.read(purchasesRepositoryProvider).customerInfo();
    if (info == null) return;
    adopt(info);
  }

  /// Takes customer info the caller already has, avoiding a second round trip.
  /// Used after `logIn`/`logOut`, which both return it.
  void adopt(CustomerInfo info) {
    state = AsyncData(SubscriptionStatus.fromCustomerInfo(info));
  }

  /// Buys [package] directly, for custom paywall UI. The RevenueCat Paywall
  /// runs its own purchase flow — use [refresh] after that instead.
  Future<PurchaseOutcome> purchase(Package package) async {
    final outcome =
        await ref.read(purchasesRepositoryProvider).purchasePackage(package);
    if (outcome is PurchaseSuccess) {
      state = AsyncData(SubscriptionStatus.fromCustomerInfo(
        outcome.customerInfo,
      ));
    }
    return outcome;
  }

  Future<RestoreOutcome> restore() async {
    final outcome =
        await ref.read(purchasesRepositoryProvider).restorePurchases();
    if (outcome is RestoreSuccess) {
      state = AsyncData(SubscriptionStatus.fromCustomerInfo(
        outcome.customerInfo,
      ));
    }
    return outcome;
  }
}

final subscriptionProvider =
    AsyncNotifierProvider<SubscriptionNotifier, SubscriptionStatus>(
        SubscriptionNotifier.new);

/// Keeps RevenueCat's `app_user_id` equal to the Supabase user id.
///
/// Exposes the id currently bound, which is only useful for tests and debugging —
/// the value is a side effect of the binding, not the point of it. The point is
/// that every webhook names an id the server can write an entitlement row for.
///
/// Nobody reads this for behaviour, so something has to watch it or it never
/// builds; `SyncHost` does, above the tabs.
class PurchasesIdentityNotifier extends Notifier<String?> {
  @override
  String? build() {
    final session = ref.watch(accountProvider);
    final purchases = ref.watch(purchasesRepositoryProvider);
    if (!purchases.isConfigured) return null;

    // Wait for a real answer. Supabase restores the stored session
    // asynchronously, so an unresolved stream is not "signed out" — acting on it
    // would log out of the previous identity on every single launch, and an auth
    // error would do the same. Both cases leave the existing binding alone.
    if (!session.hasValue) return null;
    final account = session.value;

    // Deferred so the notifier finishes building before the entitlement
    // providers it invalidates start rebuilding.
    Future.microtask(() async {
      final info = account == null
          ? await purchases.logOut()
          : await purchases.logIn(account.id);
      // Switching identity can change entitlements outright — signing in to an
      // account that already has Pro, or signing out of one that did.
      if (info != null) {
        ref.read(subscriptionProvider.notifier).adopt(info);
      }
    });

    return account?.id;
  }
}

final purchasesIdentityProvider =
    NotifierProvider<PurchasesIdentityNotifier, String?>(
        PurchasesIdentityNotifier.new);

// ---------------------------------------------------------------------------
// Entitlements (the server's answer, and the one the app gates on)
// ---------------------------------------------------------------------------

final entitlementRepositoryProvider = Provider<EntitlementRepository>(
  (ref) => EntitlementRepository(ref.watch(supabaseClientProvider)),
);

/// This account's `entitlements` row, or null when signed out or absent.
///
/// Errors resolve to null rather than propagating: an unreachable server must
/// leave the device's own answer standing, not replace it with a failure.
final serverEntitlementProvider = FutureProvider<ServerEntitlement?>((ref) async {
  final account = ref.watch(accountProvider).value;
  if (account == null) return null;
  try {
    return await ref.watch(entitlementRepositoryProvider).fetch(account.id);
  } catch (e) {
    debugPrint('Entitlement: could not read the server row — $e');
    return null;
  }
});

/// **The** entitlement. Every Pro decision in the app resolves through here.
///
/// Merges the device's view with the server's; see [Entitlement] for why both are
/// needed and why access is granted when either says so.
final entitlementProvider = Provider<Entitlement>((ref) {
  // A missing device answer — still loading, or the SDK threw — becomes "this
  // device knows of no purchase" rather than short-circuiting to free. Otherwise
  // one failed store lookup would revoke Pro from somebody the server has
  // confirmed as a subscriber, which is the worst outcome available here.
  final device =
      ref.watch(subscriptionProvider).asData?.value ?? SubscriptionStatus.free;
  return Entitlement.resolve(
    device: device,
    server: ref.watch(serverEntitlementProvider).asData?.value,
  );
});

/// The single check to gate a Pro feature on. Defaults to locked while the
/// entitlement is still loading or couldn't be read.
final isProProvider = Provider<bool>(
  (ref) => ref.watch(entitlementProvider).isPro,
);

/// Whether to show subscription UI at all — false on builds without a
/// RevenueCat API key, where nothing could be purchased anyway.
final purchasesAvailableProvider = Provider<bool>(
    (ref) => ref.watch(purchasesRepositoryProvider).isConfigured);

/// The offering marked **Current** in the dashboard, holding the `yearly` and
/// `monthly` packages. Prices come from the store, already localized.
///
/// The RevenueCat Paywall fetches this itself; this provider is for showing
/// prices in your own UI (like the Settings upgrade tile).
final proOfferingProvider = FutureProvider<Offering?>((ref) async {
  final offerings = await ref.watch(purchasesRepositoryProvider).offerings();
  return offerings?.current;
});

/// Free-tier usage for upsell copy, or null for Pro customers (nothing is
/// capped for them, so there is nothing to report).
final freeUsageProvider = Provider<FreeUsage?>((ref) {
  if (ref.watch(isProProvider)) return null;
  final entries = ref.watch(binderProvider);
  final loanedCards = ref
      .watch(lendProvider)
      .where((g) => !g.isBorrowing)
      .fold<int>(0, (sum, g) => sum + g.cardCount);
  return FreeUsage(
    binderCards: entries
        .where((e) => !e.isWanted)
        .map((e) => e.card.id)
        .toSet()
        .length,
    wantListCards: entries.where((e) => e.isWanted).map((e) => e.card.id).toSet().length,
    loanedCards: loanedCards,
    savedTrades: ref.watch(tradeHistoryProvider).length,
    binders: ref.watch(bindersProvider).where((b) => b.isLive).length,
  );
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
final searchFiltersProvider =
    NotifierProvider<SearchFiltersNotifier, CardFilters>(
        SearchFiltersNotifier.new);

class SearchFiltersNotifier extends Notifier<CardFilters> {
  @override
  CardFilters build() => const CardFilters();

  void setQuery(String q) => state = state.copyWith(query: q);
  void setFoilOnly(bool v) => state = state.copyWith(foilOnly: v);
  void setSort(CardSort s) => state = state.copyWith(sort: s);

  /// Start browsing a set with a fresh set of filters.
  void enterSet(String setName) => state = CardFilters(setName: setName);

  void clear() => state = CardFilters(setName: state.setName);
}

/// Browse/search results derived by filtering the preloaded catalog in memory,
/// so entering a set is instant (no network round-trip).
final browseResultsProvider = Provider<AsyncValue<List<CardModel>>>((ref) {
  final catalog = ref.watch(catalogProvider);
  final filters = ref.watch(searchFiltersProvider);
  return catalog.whenData((cards) => filterCards(cards, filters));
});

/// Browse results collapsed into one entry per card name. Kept for tests and
/// any callers that still want the grouped shape; Browse UI lists printings
/// flat via [browseResultsProvider] instead.
final browseGroupsProvider = Provider<AsyncValue<List<CardGroup>>>((ref) {
  final results = ref.watch(browseResultsProvider);
  final sort = ref.watch(searchFiltersProvider).sort;
  return results.whenData((cards) => groupCardsByName(cards, sort));
});

/// The most recent moment the pricing pipeline refreshed any card in the
/// catalog (max `price_updated_at`). Drives the "prices last updated" toast.
final priceUpdatedAtProvider = Provider<DateTime?>((ref) {
  return ref.watch(catalogProvider).maybeWhen(
        data: (cards) {
          DateTime? latest;
          for (final c in cards) {
            final t = c.priceUpdatedAt;
            if (t != null && (latest == null || t.isAfter(latest))) {
              latest = t;
            }
          }
          return latest;
        },
        orElse: () => null,
      );
});

// ---------------------------------------------------------------------------
// Binder & want lists
// ---------------------------------------------------------------------------

/// Search / sort for the Binder tab (independent of Browse filters).
final binderFiltersProvider =
    NotifierProvider<BinderFiltersNotifier, CardFilters>(
        BinderFiltersNotifier.new);

class BinderFiltersNotifier extends Notifier<CardFilters> {
  @override
  CardFilters build() => const CardFilters();

  void setQuery(String q) => state = state.copyWith(query: q);
  void setFoilOnly(bool v) => state = state.copyWith(foilOnly: v);
  void setSort(CardSort s) => state = state.copyWith(sort: s);
  void clear() => state = const CardFilters();
}

/// Binder-tab entries (`!isWanted`) after the same query / sort rules
/// as Browse. Non-card products are kept if the user already added them.
final filteredBinderProvider = Provider<List<BinderEntry>>((ref) {
  final binderId = ref.watch(openBinderIdProvider) ?? BinderIds.trade;
  final entries = ref.watch(binderProvider).where(
        (e) => !e.isWanted && e.resolvedBinderId == binderId,
      );
  final filters = ref.watch(binderFiltersProvider);
  return filterByCardFilters(
    entries,
    (e) => e.card,
    filters,
    excludeNonCards: false,
  );
});

final binderRepositoryProvider = Provider<BinderRepository>((ref) =>
    BinderRepository(
        ref.watch(sharedPreferencesProvider), ref.watch(syncJournalProvider)));

final bindersRepositoryProvider = Provider<BindersRepository>((ref) =>
    BindersRepository(
        ref.watch(sharedPreferencesProvider), ref.watch(syncJournalProvider)));

/// Currently drilled-in Binder, or null when the grid is showing.
final openBinderIdProvider = NotifierProvider<OpenBinderIdNotifier, String?>(
    OpenBinderIdNotifier.new);

class OpenBinderIdNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void open(String binderId) => state = binderId;

  void close() => state = null;
}

class BindersNotifier extends Notifier<List<Binder>> {
  @override
  List<Binder> build() {
    final repo = ref.watch(bindersRepositoryProvider);
    return Binder.gridOrder(repo.loadAndPersistSeed());
  }

  void _persist() => ref.read(bindersRepositoryProvider).save(state);

  List<Binder> get live => state.where((b) => b.isLive).toList();

  Binder? byId(String clientId) {
    for (final binder in state) {
      if (binder.clientId == clientId) return binder;
    }
    return null;
  }

  String get tradeBinderId {
    for (final binder in live) {
      if (binder.isTrade) return binder.clientId;
    }
    return BinderIds.trade;
  }
}

final bindersProvider =
    NotifierProvider<BindersNotifier, List<Binder>>(BindersNotifier.new);

class BinderNotifier extends Notifier<List<BinderEntry>> {
  @override
  List<BinderEntry> build() => ref.watch(binderRepositoryProvider).load();

  void _persist() => ref.read(binderRepositoryProvider).save(state);

  /// Adds [card], returning false when the free-tier cap is reached and
  /// nothing changed — callers should offer an upgrade rather than appear to
  /// do nothing. See `addToBinderOrUpsell`.
  ///
  /// Owned identity is `(printing, binderId, condition)`. Distinct owned
  /// Printings are counted across all Binders. Topping up a Printing already
  /// owned in any Binder always works.
  bool add(
    CardModel card, {
    int quantity = 1,
    String condition = 'NM',
    bool isWanted = false,
    String? binderId,
  }) {
    final targetBinder =
        isWanted ? null : (binderId ?? ref.read(openBinderIdProvider) ?? BinderIds.trade);
    final idx = state.indexWhere((e) {
      if (e.card.id != card.id || e.isWanted != isWanted) return false;
      if (isWanted) return true;
      return e.resolvedBinderId == targetBinder && e.condition == condition;
    });
    if (idx >= 0) {
      final existing = state[idx];
      final updated = [...state];
      updated[idx] = existing.copyWith(quantity: existing.quantity + quantity);
      state = updated;
    } else {
      if (isWanted) {
        if (!_canAddNewCard(isWanted: true)) return false;
      } else {
        final alreadyOwned = state.any((e) => !e.isWanted && e.card.id == card.id);
        if (!alreadyOwned && !_canAddNewCard(isWanted: false)) return false;
      }
      state = [
        BinderEntry(
          card: card,
          quantity: quantity,
          condition: condition,
          isWanted: isWanted,
          binderId: targetBinder,
          addedAt: DateTime.now(),
        ),
        ...state,
      ];
    }
    _persist();
    return true;
  }

  bool _canAddNewCard({required bool isWanted}) {
    if (ref.read(isProProvider)) return true;
    if (isWanted) {
      final listed = state.where((e) => e.isWanted).map((e) => e.card.id).toSet().length;
      return listed < FreeLimits.wantListCards;
    }
    final listed =
        state.where((e) => !e.isWanted).map((e) => e.card.id).toSet().length;
    return listed < FreeLimits.binderCards;
  }

  void setQuantity(String cardId, bool isWanted, int quantity) {
    if (quantity <= 0) {
      remove(cardId, isWanted);
      return;
    }
    state = [
      for (final e in state)
        if (e.card.id == cardId && e.isWanted == isWanted)
          e.copyWith(quantity: quantity)
        else
          e
    ];
    _persist();
    ref.read(analyticsProvider).capture(
      isWanted ? 'want_list_card_updated' : 'binder_card_updated',
      {'card_id': cardId, 'field': 'quantity'},
    );
  }

  void setCondition(String cardId, bool isWanted, String condition) {
    state = [
      for (final e in state)
        if (e.card.id == cardId && e.isWanted == isWanted)
          e.copyWith(condition: condition)
        else
          e
    ];
    _persist();
    ref.read(analyticsProvider).capture(
      isWanted ? 'want_list_card_updated' : 'binder_card_updated',
      {'card_id': cardId, 'field': 'condition'},
    );
  }

  /// Swaps the printing of an existing binder/want entry (e.g. First Edition →
  /// Unlimited), keeping quantity and condition. Merges if the target printing
  /// is already present on the same list.
  void replaceCard(String oldCardId, bool isWanted, CardModel newCard) {
    if (oldCardId == newCard.id) return;
    final idx =
        state.indexWhere((e) => e.card.id == oldCardId && e.isWanted == isWanted);
    if (idx < 0) return;
    final existing = state[idx];
    final mergeIdx = state.indexWhere(
        (e) => e.card.id == newCard.id && e.isWanted == isWanted);
    final updated = [...state];
    if (mergeIdx >= 0 && mergeIdx != idx) {
      updated[mergeIdx] = updated[mergeIdx]
          .copyWith(quantity: updated[mergeIdx].quantity + existing.quantity);
      updated.removeAt(idx);
    } else {
      updated[idx] = existing.copyWith(card: newCard);
    }
    state = updated;
    _persist();
  }

  void remove(String cardId, bool isWanted) {
    state = state
        .where((e) => !(e.card.id == cardId && e.isWanted == isWanted))
        .toList();
    _persist();
    ref.read(analyticsProvider).capture(
      isWanted ? 'want_list_card_removed' : 'binder_card_removed',
      {'card_id': cardId},
    );
  }

  /// Decrements binder/want qty, clamping at zero (silent — no warnings).
  void decrement(String cardId, int quantity, {bool isWanted = false}) {
    final current = quantityOf(cardId, isWanted: isWanted);
    setQuantity(cardId, isWanted, current - quantity);
  }

  int quantityOf(String cardId, {bool isWanted = false}) => state
      .where((e) => e.card.id == cardId && e.isWanted == isWanted)
      .fold<int>(0, (s, e) => s + e.quantity);

  bool isWanted(String cardId) =>
      state.any((e) => e.card.id == cardId && e.isWanted && e.quantity > 0);

  /// Applies Confirm Trade binder side-effects (given leave / received enter /
  /// want-list clear). Does not touch trade history or the draft.
  ///
  /// Intentionally exempt from the free-tier cap: these cards were just traded
  /// for, and dropping them to enforce a limit would lose real information.
  void applyTradeConfirm(
    Trade trade, {
    required bool removeGivenFromBinder,
    required bool addReceivedToBinder,
  }) {
    state = reconcileBinderAfterTrade(
      entries: state,
      trade: trade,
      removeGivenFromBinder: removeGivenFromBinder,
      addReceivedToBinder: addReceivedToBinder,
      binders: ref.read(bindersProvider),
    );
    _persist();
  }
}

final binderProvider =
    NotifierProvider<BinderNotifier, List<BinderEntry>>(BinderNotifier.new);

// ---------------------------------------------------------------------------
// Lend / borrow tracker
// ---------------------------------------------------------------------------
final lendRepositoryProvider = Provider<LendRepository>((ref) =>
    LendRepository(
        ref.watch(sharedPreferencesProvider), ref.watch(syncJournalProvider)));

class LendNotifier extends Notifier<List<LendGroup>> {
  @override
  List<LendGroup> build() => ref.watch(lendRepositoryProvider).load();

  void _persist() => ref.read(lendRepositoryProvider).save(state);

  /// Creates a new (empty) group and returns its id so the caller can open it.
  String createGroup({String? personName, bool isBorrowing = false}) {
    final name = personName?.trim();
    final id = DateTime.now().microsecondsSinceEpoch.toString();
    state = [
      LendGroup(
        id: id,
        personName: (name == null || name.isEmpty) ? null : name,
        isBorrowing: isBorrowing,
        createdAt: DateTime.now(),
      ),
      ...state,
    ];
    _persist();
    // Never the person name — it is PII that has no place in analytics.
    ref.read(analyticsProvider).capture('lend_group_created', {
      'type': isBorrowing ? 'borrow' : 'loan',
      'card_count': 0,
    });
    return id;
  }

  void removeGroup(String groupId) {
    LendGroup? group;
    for (final g in state) {
      if (g.id == groupId) {
        group = g;
        break;
      }
    }
    state = state.where((g) => g.id != groupId).toList();
    _persist();
    if (group != null) {
      ref.read(analyticsProvider).capture('lend_group_deleted', {
        'type': group.isBorrowing ? 'borrow' : 'loan',
      });
    }
  }

  void setPersonName(String groupId, String? personName) {
    final name = personName?.trim();
    _updateGroup(
        groupId,
        (g) => g.copyWith(
              personName: name,
              clearPersonName: name == null || name.isEmpty,
            ));
  }

  /// Adds [card] to [groupId], or returns false when a free account is already
  /// at the loaned-card cap. Borrowing groups are never capped.
  bool addCard(String groupId, CardModel card, {int quantity = 1}) {
    if (!_canLendMore(groupId, quantity)) return false;
    bool? isBorrowing;
    _updateGroup(groupId, (g) {
      isBorrowing = g.isBorrowing;
      final items = [...g.items];
      final idx = items.indexWhere((i) => i.card.id == card.id);
      if (idx >= 0) {
        items[idx] =
            items[idx].copyWith(quantity: items[idx].quantity + quantity);
      } else {
        items.add(LendItem(card: card, quantity: quantity));
      }
      return g.copyWith(items: items);
    });
    ref.read(analyticsProvider).capture('lend_card_added', {
      if (isBorrowing != null) 'type': isBorrowing! ? 'borrow' : 'loan',
    });
    return true;
  }

  /// Sets quantity, or returns false when raising it would exceed the free
  /// loaned-card cap. Decreases and removals always succeed.
  bool setCardQuantity(String groupId, String cardId, int quantity) {
    if (quantity <= 0) {
      removeCard(groupId, cardId);
      return true;
    }
    LendGroup? group;
    for (final g in state) {
      if (g.id == groupId) {
        group = g;
        break;
      }
    }
    if (group == null) return false;
    final current = group.items
        .where((i) => i.card.id == cardId)
        .fold<int>(0, (sum, i) => sum + i.quantity);
    final delta = quantity - current;
    if (delta > 0 && !_canLendMore(groupId, delta)) return false;
    _updateGroup(groupId, (g) {
      final items = [
        for (final i in g.items)
          if (i.card.id == cardId) i.copyWith(quantity: quantity) else i
      ];
      return g.copyWith(items: items);
    });
    return true;
  }

  void removeCard(String groupId, String cardId) {
    _updateGroup(groupId, (g) {
      final items = g.items.where((i) => i.card.id != cardId).toList();
      return g.copyWith(items: items);
    });
  }

  /// Whether [additional] more cards can be lent out from [groupId].
  ///
  /// Borrowing is uncapped. Pro is uncapped. Free accounts count total
  /// quantity across every lent-out group against [FreeLimits.loanedCards].
  bool _canLendMore(String groupId, int additional) {
    if (additional <= 0) return true;
    if (ref.read(isProProvider)) return true;
    LendGroup? group;
    for (final g in state) {
      if (g.id == groupId) {
        group = g;
        break;
      }
    }
    if (group == null || group.isBorrowing) return true;
    final loaned = state
        .where((g) => !g.isBorrowing)
        .fold<int>(0, (sum, g) => sum + g.cardCount);
    return loaned + additional <= FreeLimits.loanedCards;
  }

  void _updateGroup(String groupId, LendGroup Function(LendGroup) update) {
    state = [
      for (final g in state)
        if (g.id == groupId) update(g) else g
    ];
    _persist();
  }
}

final lendProvider =
    NotifierProvider<LendNotifier, List<LendGroup>>(LendNotifier.new);

/// A single group looked up by id, so a detail screen stays in sync and
/// re-renders as cards are added/removed (returns null if it was deleted).
final lendGroupProvider = Provider.family<LendGroup?, String>((ref, id) {
  final groups = ref.watch(lendProvider);
  for (final g in groups) {
    if (g.id == id) return g;
  }
  return null;
});

// ---------------------------------------------------------------------------
// Trade history (saved trades)
// ---------------------------------------------------------------------------
final tradeRepositoryProvider = Provider<TradeRepository>((ref) =>
    TradeRepository(
        ref.watch(sharedPreferencesProvider), ref.watch(syncJournalProvider)));

class TradeHistoryNotifier extends Notifier<List<Trade>> {
  @override
  List<Trade> build() => ref.watch(tradeRepositoryProvider).load();

  void _persist() => ref.read(tradeRepositoryProvider).save(state);

  /// Saves [trade], returning how many older trades rolled off to stay inside
  /// the free-tier window (always 0 for Pro).
  ///
  /// Never refuses: confirming a trade also reconciles the binder, so blocking
  /// it would be destructive. The window trims the oldest instead.
  int addTrade(Trade trade) {
    final all = [trade, ...state];
    if (ref.read(isProProvider) || all.length <= FreeLimits.savedTrades) {
      state = all;
      _persist();
      return 0;
    }
    state = all.take(FreeLimits.savedTrades).toList();
    _persist();
    return all.length - FreeLimits.savedTrades;
  }

  void remove(String id) {
    state = state.where((t) => t.id != id).toList();
    _persist();
  }
}

final tradeHistoryProvider =
    NotifierProvider<TradeHistoryNotifier, List<Trade>>(
        TradeHistoryNotifier.new);

// ---------------------------------------------------------------------------
// Live trade draft (the balancer)
// ---------------------------------------------------------------------------
class TradeDraftNotifier extends Notifier<Trade> {
  @override
  Trade build() {
    // Re-price the live draft whenever the price source/type changes, so
    // switching settings updates every existing line (and the currency),
    // not just cards added afterwards. We listen (rather than watch) so the
    // draft's cards are kept instead of being wiped on a settings change.
    ref.listen(pricingProvider, (_, next) => _repriceAll(next));
    final pricing = ref.read(pricingProvider);
    return Trade(
      id: 'draft',
      createdAt: DateTime.now(),
      currencySymbol: pricing.symbol,
    );
  }

  /// Recomputes [TradeItem.priceEach] for every line from the current pricing
  /// and refreshes the draft's currency symbol.
  void _repriceAll(Pricing pricing) {
    state = state.copyWith(
      haveItems: [
        for (final i in state.haveItems)
          i.copyWith(priceEach: pricing.value(i.card) ?? 0)
      ],
      wantItems: [
        for (final i in state.wantItems)
          i.copyWith(priceEach: pricing.value(i.card) ?? 0)
      ],
      currencySymbol: pricing.symbol,
    );
  }

  void addCard(
    TradeSide side,
    CardModel card, {
    int quantity = 1,
    String source = 'unknown',
  }) {
    final pricing = ref.read(pricingProvider);
    final price = pricing.value(card) ?? 0;
    final items = side == TradeSide.have
        ? [...state.haveItems]
        : [...state.wantItems];
    final idx = items.indexWhere((i) => i.card.id == card.id);
    if (idx >= 0) {
      items[idx] =
          items[idx].copyWith(quantity: items[idx].quantity + quantity);
    } else {
      items.add(
          TradeItem(card: card, quantity: quantity, priceEach: price));
    }
    state = side == TradeSide.have
        ? state.copyWith(haveItems: items)
        : state.copyWith(wantItems: items);
    ref.read(analyticsProvider).capture('trade_card_added', {
      'side': side.analyticsLabel,
      'source': source,
      'card_id': card.id,
    });
  }

  /// Swaps the printing of an existing line (e.g. Normal <-> Foil), keeping the
  /// quantity and re-pricing for the new finish. Merges if the target printing
  /// is already present on the same side.
  void replaceCard(TradeSide side, String oldCardId, CardModel newCard) {
    if (oldCardId == newCard.id) return;
    final pricing = ref.read(pricingProvider);
    final items = side == TradeSide.have
        ? [...state.haveItems]
        : [...state.wantItems];
    final idx = items.indexWhere((i) => i.card.id == oldCardId);
    if (idx < 0) return;
    final qty = items[idx].quantity;
    final existing = items.indexWhere((i) => i.card.id == newCard.id);
    if (existing >= 0 && existing != idx) {
      items[existing] =
          items[existing].copyWith(quantity: items[existing].quantity + qty);
      items.removeAt(idx);
    } else {
      items[idx] = TradeItem(
          card: newCard, quantity: qty, priceEach: pricing.value(newCard) ?? 0);
    }
    state = side == TradeSide.have
        ? state.copyWith(haveItems: items)
        : state.copyWith(wantItems: items);
  }

  void setQuantity(TradeSide side, String cardId, int quantity) {
    List<TradeItem> items = side == TradeSide.have
        ? [...state.haveItems]
        : [...state.wantItems];
    if (quantity <= 0) {
      items = items.where((i) => i.card.id != cardId).toList();
    } else {
      items = [
        for (final i in items)
          if (i.card.id == cardId) i.copyWith(quantity: quantity) else i
      ];
    }
    state = side == TradeSide.have
        ? state.copyWith(haveItems: items)
        : state.copyWith(wantItems: items);
    ref.read(analyticsProvider).capture('trade_quantity_changed', {
      'side': side.analyticsLabel,
      'new_quantity': quantity,
    });
  }

  void removeCard(TradeSide side, String cardId) {
    final items = (side == TradeSide.have ? state.haveItems : state.wantItems)
        .where((i) => i.card.id != cardId)
        .toList();
    state = side == TradeSide.have
        ? state.copyWith(haveItems: items)
        : state.copyWith(wantItems: items);
    ref
        .read(analyticsProvider)
        .capture('trade_card_removed', {'side': side.analyticsLabel});
  }

  void setCash(TradeSide side, double amount) {
    state = side == TradeSide.have
        ? state.copyWith(haveCash: amount)
        : state.copyWith(wantCash: amount);
    ref.read(analyticsProvider).capture('trade_cash_adjusted', {
      'side': side.analyticsLabel,
      'amount': amount,
    });
  }

  void setNotes(String notes) => state = state.copyWith(notes: notes);

  void clear() {
    ref.read(analyticsProvider).capture('trade_cleared', {
      'their_card_count': state.wantCount,
      'my_card_count': state.haveCount,
    });
    final pricing = ref.read(pricingProvider);
    state = Trade(
      id: 'draft',
      createdAt: DateTime.now(),
      currencySymbol: pricing.symbol,
    );
  }
}

final tradeDraftProvider =
    NotifierProvider<TradeDraftNotifier, Trade>(TradeDraftNotifier.new);
