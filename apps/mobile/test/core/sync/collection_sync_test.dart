import 'package:fabtrades/core/data/binder_repository.dart';
import 'package:fabtrades/core/models/binder_entry.dart';
import 'package:fabtrades/core/sync/binder_sync.dart';
import 'package:fabtrades/core/sync/collection_sync.dart';
import 'package:fabtrades/core/sync/remote_store.dart';
import 'package:fabtrades/core/sync/sync_journal.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fixtures.dart';

const _userId = '9f1c0b62-0000-4000-8000-000000000001';
const _adapter = BinderSyncAdapter();

/// An in-memory stand-in for one Postgres table, keyed the way the real unique
/// constraint is, so upsert conflicts behave the same way.
class FakeRemoteCollection implements RemoteCollection {
  FakeRemoteCollection([List<Map<String, Object?>> seed = const []]) {
    for (final row in seed) {
      rows[_key(row)] = {...row};
    }
  }

  final Map<String, Map<String, Object?>> rows = {};
  int upsertCalls = 0;
  bool failOnWrite = false;

  static String _key(Map<String, Object?> row) =>
      (row['client_id'] as String?) ??
      '${row['is_wanted']}|${row['binder_id']}|${row['card_id']}|${row['condition']}';

  @override
  Future<List<Map<String, dynamic>>> fetchAll(String userId) async => [
        for (final row in rows.values)
          if (row['user_id'] == userId) Map<String, dynamic>.from(row),
      ];

  @override
  Future<void> upsertAll(List<Map<String, Object?>> incoming) async {
    if (incoming.isEmpty) return;
    if (failOnWrite) throw Exception('network down');
    upsertCalls++;
    for (final row in incoming) {
      rows[_key(row)] = {...row};
    }
  }

  @override
  Future<void> markDeleted({
    required String userId,
    required Map<String, Object?> identity,
    required DateTime at,
  }) async {
    if (failOnWrite) throw Exception('network down');
    final key = _key(identity);
    final row = rows[key];
    if (row == null) return;
    row['deleted_at'] = at.toIso8601String();
    row['updated_at'] = at.toIso8601String();
  }
}

/// A row as the server would hold it.
Map<String, Object?> remoteRow(
  String cardId, {
  bool isWanted = false,
  int quantity = 1,
  String condition = 'NM',
  String? binderId,
  required DateTime updatedAt,
  DateTime? deletedAt,
}) {
  final ownedBinder = isWanted ? null : (binderId ?? 'system:trade');
  return {
    'user_id': _userId,
    'client_id': isWanted
        ? 'want|$cardId'
        : 'binder|$ownedBinder|$cardId|$condition',
    'card_id': cardId,
    'is_wanted': isWanted,
    'binder_id': ownedBinder,
    'quantity': quantity,
    'condition': condition,
    'card': buildCard(id: cardId, name: 'Card $cardId').toStub(),
    'added_at': DateTime.utc(2026, 1, 1).toIso8601String(),
    'updated_at': updatedAt.toIso8601String(),
    'deleted_at': deletedAt?.toIso8601String(),
  };
}

BinderEntry entry(
  String cardId, {
  int quantity = 1,
  bool isWanted = false,
  DateTime? addedAt,
}) {
  return BinderEntry(
    card: buildCard(id: cardId, name: 'Card $cardId'),
    quantity: quantity,
    isWanted: isWanted,
    addedAt: addedAt ?? DateTime.utc(2026, 1, 1),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SharedPreferences prefs;
  late SyncJournal journal;
  late BinderRepository local;

  Future<void> setUpStore([Map<String, Object> seed = const {}]) async {
    SharedPreferences.setMockInitialValues(seed);
    prefs = await SharedPreferences.getInstance();
    journal = SyncJournal(prefs);
    local = BinderRepository(prefs, journal);
  }

  CollectionSync<BinderEntry> syncWith(FakeRemoteCollection remote) =>
      CollectionSync(
        adapter: _adapter,
        local: local,
        remote: remote,
        journal: journal,
      );

  setUp(setUpStore);

  group('first sign-in', () {
    test('uploads collection data built while signed out', () async {
      await local.save([entry('a', quantity: 2), entry('b', isWanted: true)]);
      final remote = FakeRemoteCollection();

      final changed = await syncWith(remote).run(userId: _userId);

      expect(changed, isFalse, reason: 'nothing came back, so nothing to apply');
      expect(remote.rows, hasLength(2));
      expect(remote.rows['binder|system:trade|a|NM']!['quantity'], 2);
      expect(remote.rows['want|b']!['is_wanted'], isTrue);
      expect(remote.rows['binder|system:trade|a|NM']!['user_id'], _userId);
    });

    test('uploads data that predates the journal entirely', () async {
      // An existing install upgrading into a version that syncs: the data is there
      // but nothing recorded when it changed.
      await setUpStore({
        'collection_entries':
            '[{"card":{"id":"legacy","name":"Old","is_foil":false},'
                '"quantity":4,"condition":"NM","is_wanted":false,'
                '"added_at":"2026-01-01T00:00:00.000Z"}]',
      });
      final remote = FakeRemoteCollection();

      await syncWith(remote).run(userId: _userId);

      expect(remote.rows['binder|system:trade|legacy|NM']!['quantity'], 4);
      // Falling back to the record's own creation time means a later edit made on
      // another device still wins.
      expect(remote.rows['binder|system:trade|legacy|NM']!['updated_at'],
          startsWith('2026-01-01T00:00:00'));
    });
  });

  group('pulling', () {
    test('brings down a binder built on another device', () async {
      final remote = FakeRemoteCollection([
        remoteRow('x', quantity: 3, updatedAt: DateTime.utc(2026, 6, 1)),
      ]);

      final changed = await syncWith(remote).run(userId: _userId);

      expect(changed, isTrue);
      expect(local.load().single.card.id, 'x');
      expect(local.load().single.quantity, 3);
    });

    test('ignores another account\'s rows', () async {
      final remote = FakeRemoteCollection([
        {
          ...remoteRow('theirs', updatedAt: DateTime.utc(2026, 6, 1)),
          'user_id': 'someone-else',
        },
      ]);

      await syncWith(remote).run(userId: _userId);

      expect(local.load(), isEmpty);
    });

    test('does not report a change when both sides already agree', () async {
      await local.save([entry('a')]);
      final remote = FakeRemoteCollection();
      await syncWith(remote).run(userId: _userId);

      final changed = await syncWith(remote).run(userId: _userId);

      expect(changed, isFalse);
      expect(remote.upsertCalls, 1,
          reason: 'a settled collection should not be rewritten every sync');
    });

    test('skips a row it cannot read without losing the rest', () async {
      final remote = FakeRemoteCollection([
        {'user_id': _userId, 'card_id': 'broken'}, // no updated_at
        remoteRow('good', updatedAt: DateTime.utc(2026, 6, 1)),
      ]);

      await syncWith(remote).run(userId: _userId);

      expect(local.load().map((e) => e.card.id), ['good']);
    });
  });

  group('conflicts', () {
    test('a newer remote edit replaces the local copy', () async {
      await local.save([entry('a', quantity: 1)]);
      final remote = FakeRemoteCollection([
        remoteRow('a', quantity: 9, updatedAt: DateTime.utc(2030, 1, 1)),
      ]);

      await syncWith(remote).run(userId: _userId);

      expect(local.load().single.quantity, 9);
    });

    test('a newer local edit is pushed over the remote copy', () async {
      await local.save([entry('a', quantity: 7)]);
      final remote = FakeRemoteCollection([
        remoteRow('a', quantity: 1, updatedAt: DateTime.utc(2020, 1, 1)),
      ]);

      await syncWith(remote).run(userId: _userId);

      expect(local.load().single.quantity, 7);
      expect(remote.rows['binder|system:trade|a|NM']!['quantity'], 7);
    });

    test('a pulled record is not then mistaken for a local edit', () async {
      // The regression this guards: `save` stamps everything as changed now, so
      // without restamping, the next sync would treat pulled data as newer than
      // anything upstream and this device would win every future merge.
      final remote = FakeRemoteCollection([
        remoteRow('a', quantity: 3, updatedAt: DateTime.utc(2026, 6, 1)),
      ]);
      await syncWith(remote).run(userId: _userId);

      expect(
        journal.localTimestamps(SyncDomain.binder)['binder|system:trade|a|NM'],
        DateTime.utc(2026, 6, 1),
      );

      remote.upsertCalls = 0;
      await syncWith(remote).run(userId: _userId);
      expect(remote.upsertCalls, 0);
    });
  });

  group('deletions', () {
    test('a local delete is tombstoned upstream, not silently dropped', () async {
      await local.save([entry('a')]);
      final remote = FakeRemoteCollection();
      await syncWith(remote).run(userId: _userId);

      await local.save(const []);
      await syncWith(remote).run(userId: _userId);

      expect(remote.rows['binder|system:trade|a|NM']!['deleted_at'], isNotNull);
      expect(local.load(), isEmpty);
    });

    test('a remote delete removes the local copy', () async {
      await local.save([entry('a')]);
      final remote = FakeRemoteCollection([
        remoteRow(
          'a',
          updatedAt: DateTime.utc(2030, 1, 1),
          deletedAt: DateTime.utc(2030, 1, 1),
        ),
      ]);

      final changed = await syncWith(remote).run(userId: _userId);

      expect(changed, isTrue);
      expect(local.load(), isEmpty);
    });

    test('a deleted record does not come back on the next sync', () async {
      await local.save([entry('a')]);
      final remote = FakeRemoteCollection();
      await syncWith(remote).run(userId: _userId);
      await local.save(const []);
      await syncWith(remote).run(userId: _userId);

      await syncWith(remote).run(userId: _userId);

      expect(local.load(), isEmpty);
    });

    test('a re-add is stamped past the deletion it replaces', () async {
      // Wall-clock stamps are too coarse to order edits made in quick succession,
      // and the tie rule favours deletion, so a naive clock would lose the re-add.
      await local.save([entry('a')]);
      final created = journal.localTimestamps(SyncDomain.binder)['binder|system:trade|a|NM']!;

      await local.save(const []);
      final deleted = journal.tombstones(SyncDomain.binder)['binder|system:trade|a|NM']!;
      expect(deleted.isAfter(created), isTrue);

      await local.save([entry('a', quantity: 5)]);
      final readded = journal.localTimestamps(SyncDomain.binder)['binder|system:trade|a|NM']!;
      expect(readded.isAfter(deleted), isTrue);
    });

    test('a re-add outlives a tombstone the journal has already dropped',
        () async {
      await local.save([entry('a')]);
      final remote = FakeRemoteCollection();
      await syncWith(remote).run(userId: _userId);
      await local.save(const []);
      // This sync pushes the tombstone and then stops tracking it locally, so the
      // domain's high-water mark is the only thing left ordering what comes next.
      await syncWith(remote).run(userId: _userId);
      expect(journal.tombstones(SyncDomain.binder), isEmpty);

      await local.save([entry('a', quantity: 5)]);
      await syncWith(remote).run(userId: _userId);

      expect(local.load().single.quantity, 5);
    });

    test('drops a tombstone stamped ahead of the wall clock', () async {
      // Two edits inside one millisecond push the second's stamp into the future.
      // A sync that treated `DateTime.now()` as the present would read that
      // tombstone as concurrent with itself, keep it, and re-delete the record on
      // every sync from then on. Forced here rather than raced for.
      await local.save([entry('a')]);
      final remote = FakeRemoteCollection();
      await syncWith(remote).run(userId: _userId);

      await local.save(const []);
      await journal.noteLocalWrite(
        SyncDomain.binder,
        before: {'binder|system:trade|a|NM': 'live'},
        after: const {},
        at: DateTime.now().toUtc().add(const Duration(seconds: 30)),
      );
      expect(journal.tombstones(SyncDomain.binder), isNotEmpty);

      await syncWith(remote).run(userId: _userId);

      expect(journal.tombstones(SyncDomain.binder), isEmpty);
      expect(local.load(), isEmpty);
    });

    test('re-adding after a delete wins over the tombstone', () async {
      await local.save([entry('a')]);
      final remote = FakeRemoteCollection();
      await syncWith(remote).run(userId: _userId);
      await local.save(const []);
      await syncWith(remote).run(userId: _userId);

      await local.save([entry('a', quantity: 5)]);
      await syncWith(remote).run(userId: _userId);

      expect(local.load().single.quantity, 5);
      expect(remote.rows['binder|system:trade|a|NM']!['deleted_at'], isNull,
          reason: 'pushing a live record must clear its tombstone');
    });
  });

  group('failure', () {
    test('leaves both sides untouched so the next attempt is a clean retry',
        () async {
      await local.save([entry('a', quantity: 4)]);
      final before = journal.localTimestamps(SyncDomain.binder);
      final remote = FakeRemoteCollection()..failOnWrite = true;

      await expectLater(
        syncWith(remote).run(userId: _userId),
        throwsA(isA<Exception>()),
      );

      expect(local.load().single.quantity, 4);
      expect(journal.localTimestamps(SyncDomain.binder), before);

      remote.failOnWrite = false;
      await syncWith(remote).run(userId: _userId);
      expect(remote.rows['binder|system:trade|a|NM']!['quantity'], 4);
    });
  });

  group('identity', () {
    test('the same printing on both lists stays two separate entries', () async {
      await local.save([
        entry('a', quantity: 1),
        entry('a', quantity: 2, isWanted: true),
      ]);
      final remote = FakeRemoteCollection();

      await syncWith(remote).run(userId: _userId);

      expect(remote.rows.keys, containsAll(['binder|system:trade|a|NM', 'want|a']));
      expect(local.load(), hasLength(2));
    });

    test('a card id containing the separator still round-trips', () async {
      await local.save([entry('weird|id')]);
      final remote = FakeRemoteCollection();
      await syncWith(remote).run(userId: _userId);

      await local.save(const []);
      await syncWith(remote).run(userId: _userId);

      // Splitting on the wrong separator would tombstone nothing, or the wrong row.
      expect(remote.rows['binder|system:trade|weird|id|NM']!['deleted_at'], isNotNull);
    });
  });
}
