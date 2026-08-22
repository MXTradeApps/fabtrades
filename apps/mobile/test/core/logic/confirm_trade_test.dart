import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/logic/confirm_trade.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/models/binder_entry.dart';
import 'package:fabtrades/core/models/trade.dart';

import '../../support/fixtures.dart';

void main() {
  final now = DateTime.utc(2026, 7, 1);

  BinderEntry binder(String id, int qty, {bool wanted = false}) => BinderEntry(
        card: buildCard(id: id),
        quantity: qty,
        isWanted: wanted,
        addedAt: now,
      );

  group('reconcileBinderAfterTrade', () {
    test('decrements given cards and clamps at zero', () {
      final trade = Trade(
        id: 't',
        createdAt: now,
        haveItems: [
          TradeItem(card: buildCard(id: 'a'), quantity: 3, priceEach: 1),
        ],
      );
      final next = reconcileBinderAfterTrade(
        entries: [binder('a', 1)],
        trade: trade,
        removeGivenFromBinder: true,
        addReceivedToBinder: false,
        now: now,
      );
      expect(next, isEmpty);
    });

    test('adds received cards to binder with NM merge', () {
      final card = buildCard(id: 'b');
      final trade = Trade(
        id: 't',
        createdAt: now,
        wantItems: [TradeItem(card: card, quantity: 2, priceEach: 1)],
      );
      final next = reconcileBinderAfterTrade(
        entries: [binder('b', 1)],
        trade: trade,
        removeGivenFromBinder: false,
        addReceivedToBinder: true,
        now: now,
      );
      expect(next.single.quantity, 3);
      expect(next.single.condition, 'NM');
      expect(next.single.isWanted, isFalse);
    });

    test('clears received cards from want list even when add is off', () {
      final card = buildCard(id: 'c');
      final trade = Trade(
        id: 't',
        createdAt: now,
        wantItems: [TradeItem(card: card, quantity: 1, priceEach: 1)],
      );
      final next = reconcileBinderAfterTrade(
        entries: [binder('c', 2, wanted: true)],
        trade: trade,
        removeGivenFromBinder: false,
        addReceivedToBinder: false,
        now: now,
      );
      expect(next.single.quantity, 1);
      expect(next.single.isWanted, isTrue);
    });

    test('does not edit Collection when reconciling Trade Binder', () {
      final trade = Trade(
        id: 't',
        createdAt: now,
        haveItems: [
          TradeItem(card: buildCard(id: 'keep'), quantity: 1, priceEach: 1),
        ],
        wantItems: [
          TradeItem(card: buildCard(id: 'got'), quantity: 1, priceEach: 1),
        ],
      );
      final collection = BinderEntry(
        card: buildCard(id: 'keep'),
        quantity: 4,
        binderId: BinderIds.collection,
        addedAt: now,
      );
      final next = reconcileBinderAfterTrade(
        entries: [collection],
        trade: trade,
        removeGivenFromBinder: true,
        addReceivedToBinder: true,
        now: now,
      );
      expect(
        next.where((e) => e.resolvedBinderId == BinderIds.collection).single.quantity,
        4,
      );
      expect(
        next.where((e) => e.resolvedBinderId == BinderIds.trade).single.card.id,
        'got',
      );
    });

    test('skips binder mutations when both checkboxes are off but still clears wants', () {
      final given = buildCard(id: 'g');
      final recv = buildCard(id: 'r');
      final trade = Trade(
        id: 't',
        createdAt: now,
        haveItems: [TradeItem(card: given, quantity: 1, priceEach: 1)],
        wantItems: [TradeItem(card: recv, quantity: 1, priceEach: 1)],
      );
      final start = [binder('g', 5), binder('r', 1, wanted: true)];
      final next = reconcileBinderAfterTrade(
        entries: start,
        trade: trade,
        removeGivenFromBinder: false,
        addReceivedToBinder: false,
        now: now,
      );
      // Given stays; received want still cleared.
      expect(next.where((e) => e.card.id == 'g').single.quantity, 5);
      expect(next.where((e) => e.card.id == 'r'), isEmpty);
    });
  });
}
