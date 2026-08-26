import '../models/binder.dart';
import '../sync/binders_sync.dart';
import 'cached_collection.dart';

class BindersRepository extends CachedCollection<Binder> {
  BindersRepository(super.prefs, super.journal);

  List<Binder>? _firstRunSeed;

  @override
  String get storageKey => 'binders';

  @override
  BindersSyncAdapter get adapter => const BindersSyncAdapter();

  @override
  Map<String, dynamic> encode(Binder value) => value.toJson();

  @override
  Binder decode(Map<String, dynamic> json) => Binder.fromJson(json);

  /// First run (no storage key) seeds Trade Binder + Collection in memory so
  /// every load on this instance returns the same pair. After a write, Trade
  /// Binder is restored if missing or tombstoned; Collection is not resurrected.
  @override
  List<Binder> load() {
    if (!hasStorageKey) {
      return _firstRunSeed ??= Binder.seedDefaults();
    }
    _firstRunSeed = null;
    return Binder.ensureTrade(super.load());
  }

  /// Never persist a tombstoned Trade Binder.
  @override
  Future<void> save(List<Binder> values) =>
      super.save(Binder.ensureTrade(values));

  /// Persist first-run defaults so they journal and sync. Also persist a Trade
  /// Binder restore so it is not only in memory.
  List<Binder> loadAndPersistSeed() {
    if (!hasStorageKey) {
      final seeded = Binder.seedDefaults();
      save(seeded);
      return seeded;
    }
    final stored = super.load();
    final restored = Binder.ensureTrade(stored);
    if (!_hasLiveTrade(stored)) {
      save(restored);
    }
    return restored;
  }

  bool _hasLiveTrade(List<Binder> binders) =>
      binders.any((b) => b.role == BinderRole.trade && b.isLive);
}

