import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/models/binder_entry.dart';
import 'package:fabtrades/core/models/binder.dart';

import '../../support/fixtures.dart';

void main() {
  group('BinderEntry', () {
    test('copyWith overrides only provided fields and keeps card/addedAt', () {
      final added = DateTime(2026, 2, 3);
      final entry = BinderEntry(
        card: buildCard(id: 'c1'),
        quantity: 1,
        condition: 'NM',
        addedAt: added,
      );
      final updated = entry.copyWith(quantity: 5, condition: 'LP');
      expect(updated.quantity, 5);
      expect(updated.condition, 'LP');
      expect(updated.card.id, 'c1');
      expect(updated.addedAt, added);
      expect(updated.isWanted, isFalse);
    });

    test('toJson -> fromJson round-trips', () {
      final entry = BinderEntry(
        card: buildCard(id: 'c2', name: 'Jinx'),
        quantity: 3,
        condition: 'MP',
        isWanted: true,
        addedAt: DateTime.utc(2026, 4, 5, 6, 7, 8),
      );
      final restored = BinderEntry.fromJson(entry.toJson());
      expect(restored.card.id, 'c2');
      expect(restored.card.name, 'Jinx');
      expect(restored.quantity, 3);
      expect(restored.condition, 'MP');
      expect(restored.isWanted, isTrue);
      expect(restored.binderId, isNull);
      expect(restored.addedAt, DateTime.utc(2026, 4, 5, 6, 7, 8));
    });

    test('fromJson applies defaults for a minimal payload', () {
      final restored = BinderEntry.fromJson({
        'card': buildCard().toStub(),
      });
      expect(restored.quantity, 1);
      expect(restored.condition, 'NM');
      expect(restored.isWanted, isFalse);
      expect(restored.binderId, BinderIds.trade);
      expect(restored.addedAt, isA<DateTime>());
    });

    test('fromJson assigns Trade Binder to owned rows missing binder_id', () {
      final restored = BinderEntry.fromJson({
        'card': buildCard(id: 'legacy').toStub(),
        'is_wanted': false,
      });
      expect(restored.binderId, BinderIds.trade);
      expect(restored.isWanted, isFalse);
    });

    test('fromJson keeps Want List binderId null', () {
      final restored = BinderEntry.fromJson({
        'card': buildCard(id: 'want').toStub(),
        'is_wanted': true,
        'binder_id': 'system:trade',
      });
      expect(restored.isWanted, isTrue);
      expect(restored.binderId, isNull);
    });

    test('toJson round-trips binder_id for owned rows', () {
      final entry = BinderEntry(
        card: buildCard(id: 'c3'),
        quantity: 1,
        binderId: BinderIds.collection,
        addedAt: DateTime.utc(2026, 4, 5),
      );
      final restored = BinderEntry.fromJson(entry.toJson());
      expect(restored.binderId, BinderIds.collection);
    });

    test('conditions constant lists all grades', () {
      expect(BinderEntry.conditions, ['NM', 'LP', 'MP', 'HP', 'DMG']);
    });
  });
}
