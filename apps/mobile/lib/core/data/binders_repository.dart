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

  /// First run (no storage key) seeds Trade Binder, Want List, and Collection
  /// in memory so every load on this instance returns the same set. After a
  /// write, Trade Binder is kept if missing; Collection is not resurrected.
  @override
  List<Binder> load() {
    if (!hasStorageKey) {
      return _firstRunSeed ??= Binder.seedDefaults();
    }
    _firstRunSeed = null;
    return super.load();
  }

  /// Persist first-run defaults so they journal and sync. Existing installs
  /// also get Want List if it is missing and the name is free.
  List<Binder> loadAndPersistSeed() {
    final loaded = load();
    final next = Binder.ensureWant(loaded);
    if (!hasStorageKey || next.length != loaded.length) {
      save(next);
    }
    return next;
  }
}

