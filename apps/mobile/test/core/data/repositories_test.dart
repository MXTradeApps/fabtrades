import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/data/catalog_repository.dart';
import 'package:fabtrades/core/data/binder_repository.dart';
import 'package:fabtrades/core/data/lend_repository.dart';
import 'package:fabtrades/core/data/settings_repository.dart';
import 'package:fabtrades/core/data/trade_repository.dart';
import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/models/binder_entry.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/models/lend_group.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/sync/sync_journal.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fixtures.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<SharedPreferences> freshPrefs([Map<String, Object> seed = const {}]) {
    SharedPreferences.setMockInitialValues(seed);
    return SharedPreferences.getInstance();
  }

  Future<BinderRepository> binderRepo([Map<String, Object> seed = const {}]) async {
    final prefs = await freshPrefs(seed);
    return BinderRepository(prefs, SyncJournal(prefs));
  }

  Future<TradeRepository> tradeRepo([Map<String, Object> seed = const {}]) async {
    final prefs = await freshPrefs(seed);
    return TradeRepository(prefs, SyncJournal(prefs));
  }

  Future<LendRepository> lendRepo([Map<String, Object> seed = const {}]) async {
    final prefs = await freshPrefs(seed);
    return LendRepository(prefs, SyncJournal(prefs));
  }

  Future<SettingsRepository> settingsRepo(
      [Map<String, Object> seed = const {}]) async {
    final prefs = await freshPrefs(seed);
    return SettingsRepository(prefs, SyncJournal(prefs));
  }

  group('BinderRepository', () {
    test('returns empty when nothing stored', () async {
      expect((await binderRepo()).load(), isEmpty);
    });

    test('save then load round-trips entries', () async {
      final repo = await binderRepo();
      final entries = [
        BinderEntry(
          card: buildCard(id: 'c1', name: 'Vex'),
          quantity: 2,
          condition: 'LP',
          isWanted: true,
          addedAt: DateTime.utc(2026, 1, 1),
        ),
      ];
      await repo.save(entries);

      final loaded = repo.load();
      expect(loaded.single.card.id, 'c1');
      expect(loaded.single.quantity, 2);
      expect(loaded.single.condition, 'LP');
      expect(loaded.single.isWanted, isTrue);
    });

    test('returns empty on corrupt json', () async {
      final repo = await binderRepo({'collection_entries': 'not json'});
      expect(repo.load(), isEmpty);
    });

    test('reads legacy collection_entries key payloads', () async {
      // Simulate a pre-rename payload written under the legacy key.
      final repo = await binderRepo({
        'collection_entries':
            '[{"card":{"id":"legacy","name":"Old","is_foil":false},'
                '"quantity":4,"condition":"NM","is_wanted":false,'
                '"added_at":"2026-01-01T00:00:00.000Z"}]',
      });
      final loaded = repo.load();
      expect(loaded.single.card.id, 'legacy');
      expect(loaded.single.quantity, 4);
      expect(loaded.single.isWanted, isFalse);
      expect(loaded.single.binderId, BinderIds.trade);
    });
  });

  group('TradeRepository', () {
    test('save then load round-trips trades', () async {
      final repo = await tradeRepo();
      final trade = Trade(
        id: 't1',
        createdAt: DateTime.utc(2026, 2, 2),
        haveItems: [
          TradeItem(card: buildCard(id: 'h'), quantity: 1, priceEach: 3),
        ],
      );
      await repo.save([trade]);

      final loaded = repo.load();
      expect(loaded.single.id, 't1');
      expect(loaded.single.haveItems.single.card.id, 'h');
    });

    test('returns empty on corrupt json', () async {
      expect((await tradeRepo({'saved_trades': '{bad'})).load(), isEmpty);
    });
  });

  group('LendRepository', () {
    test('save then load round-trips groups', () async {
      final repo = await lendRepo();
      final group = LendGroup(
        id: 'g1',
        personName: 'Sam',
        createdAt: DateTime.utc(2026, 3, 3),
        items: [LendItem(card: buildCard(id: 'x'), quantity: 2)],
      );
      await repo.save([group]);

      final loaded = repo.load();
      expect(loaded.single.id, 'g1');
      expect(loaded.single.personName, 'Sam');
      expect(loaded.single.cardCount, 2);
    });

    test('returns empty on corrupt json', () async {
      expect((await lendRepo({'lend_groups': 'x'})).load(), isEmpty);
    });
  });

  group('SettingsRepository', () {
    test('defaults when nothing stored', () async {
      final s = (await settingsRepo()).load();
      expect(s.source, PriceSource.tcgplayer);
      expect(s.themeMode, AppThemeMode.dark);
    });

    test('save then load round-trips settings', () async {
      final repo = await settingsRepo();
      await repo.save(const AppSettings(
        source: PriceSource.cardmarket,
        themeMode: AppThemeMode.dark,
      ));
      final s = repo.load();
      expect(s.source, PriceSource.cardmarket);
      expect(s.themeMode, AppThemeMode.dark);
    });

    test('defaults on corrupt json', () async {
      final repo = await settingsRepo({'app_settings': 'nope'});
      expect(repo.load().source, PriceSource.tcgplayer);
    });
  });

  group('journal bookkeeping', () {
    test('a save marks only the records that actually changed', () async {
      final prefs = await freshPrefs();
      final journal = SyncJournal(prefs);
      final repo = BinderRepository(prefs, journal);

      final first = BinderEntry(
        card: buildCard(id: 'a'),
        addedAt: DateTime.utc(2026, 1, 1),
      );
      final second = BinderEntry(
        card: buildCard(id: 'b'),
        addedAt: DateTime.utc(2026, 1, 2),
      );
      await repo.save([first, second]);

      final afterFirstSave = journal.localTimestamps(SyncDomain.binder);
      expect(afterFirstSave.keys, hasLength(2));

      await repo.save([first, second.copyWith(quantity: 3)]);
      final afterEdit = journal.localTimestamps(SyncDomain.binder);

      // Restamping every record on every save would make this device win every
      // merge, so an untouched entry must keep its original timestamp.
      expect(afterEdit['binder|system:trade|a|NM'], afterFirstSave['binder|system:trade|a|NM']);
      expect(
        afterEdit['binder|system:trade|b|NM']!.isAfter(afterFirstSave['binder|system:trade|b|NM']!) ||
            afterEdit['binder|system:trade|b|NM'] == afterFirstSave['binder|system:trade|b|NM'],
        isTrue,
      );
    });

    test('removing a record leaves a tombstone', () async {
      final prefs = await freshPrefs();
      final journal = SyncJournal(prefs);
      final repo = BinderRepository(prefs, journal);

      final entry = BinderEntry(
        card: buildCard(id: 'a'),
        addedAt: DateTime.utc(2026, 1, 1),
      );
      await repo.save([entry]);
      await repo.save(const []);

      expect(journal.localTimestamps(SyncDomain.binder), isEmpty);
      expect(journal.tombstones(SyncDomain.binder).keys, ['binder|system:trade|a|NM']);
    });

    test('re-adding a deleted record clears its tombstone', () async {
      final prefs = await freshPrefs();
      final journal = SyncJournal(prefs);
      final repo = BinderRepository(prefs, journal);

      final entry = BinderEntry(
        card: buildCard(id: 'a'),
        addedAt: DateTime.utc(2026, 1, 1),
      );
      await repo.save([entry]);
      await repo.save(const []);
      await repo.save([entry]);

      expect(journal.tombstones(SyncDomain.binder), isEmpty);
      expect(journal.localTimestamps(SyncDomain.binder).keys, ['binder|system:trade|a|NM']);
    });

    test('settings are only stamped once a choice is actually made', () async {
      final prefs = await freshPrefs();
      final journal = SyncJournal(prefs);
      final repo = SettingsRepository(prefs, journal);

      // Saving the values already in effect is not a preference; without this a
      // fresh install would push its defaults over a real choice made elsewhere.
      await repo.save(const AppSettings());
      expect(journal.localTimestamps(SyncDomain.settings), isEmpty);

      await repo.save(const AppSettings(source: PriceSource.cardmarket));
      expect(journal.localTimestamps(SyncDomain.settings).keys, ['settings']);
    });
  });

  group('CatalogRepository', () {
    test('load returns null when empty', () async {
      final repo = CatalogRepository(await freshPrefs());
      expect(repo.load(), isNull);
      expect(repo.lastUpdated(), isNull);
    });

    test('save then load round-trips the catalog and stamps updated time',
        () async {
      final repo = CatalogRepository(await freshPrefs());
      await repo.save([buildCard(id: 'a'), buildCard(id: 'b')]);

      final loaded = repo.load();
      expect(loaded, isNotNull);
      expect(loaded!.map((c) => c.id), ['a', 'b']);
      expect(repo.lastUpdated(), isA<DateTime>());
    });

    test('load returns null on corrupt json', () async {
      final repo = CatalogRepository(await freshPrefs({'card_catalog': '!!'}));
      expect(repo.load(), isNull);
    });
  });
}
