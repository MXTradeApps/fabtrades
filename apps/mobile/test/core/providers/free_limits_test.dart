import 'package:fabtrades/core/logic/free_limits.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/models/subscription_status.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fixtures.dart';

class _FakeSubscription extends SubscriptionNotifier {
  _FakeSubscription({required this.isPro});

  final bool isPro;

  @override
  Future<SubscriptionStatus> build() async =>
      isPro ? const SubscriptionStatus(isPro: true) : SubscriptionStatus.free;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<ProviderContainer> makeContainer({required bool isPro}) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        subscriptionProvider.overrideWith(() => _FakeSubscription(isPro: isPro)),
      ],
    );
    addTearDown(container.dispose);
    // Resolve the entitlement so isProProvider reflects the fake.
    await container.read(subscriptionProvider.future);
    expect(container.read(isProProvider), isPro);
    return container;
  }

  Trade buildTrade(String id) => Trade(id: id, createdAt: DateTime.now());

  group('binder free-tier cap', () {
    test('accepts cards up to the limit, then refuses', () async {
      final c = await makeContainer(isPro: false);
      final binder = c.read(binderProvider.notifier);

      for (var i = 0; i < FreeLimits.binderCards; i++) {
        expect(binder.add(buildCard(id: 'card-$i')), isTrue,
            reason: 'card $i should fit');
      }
      expect(c.read(binderProvider), hasLength(FreeLimits.binderCards));

      expect(binder.add(buildCard(id: 'one-too-many')), isFalse);
      expect(c.read(binderProvider), hasLength(FreeLimits.binderCards));
    });

    test('counts distinct owned printings across Binders against one cap', () async {
      final c = await makeContainer(isPro: false);
      final binder = c.read(binderProvider.notifier);
      final half = FreeLimits.binderCards ~/ 2;
      for (var i = 0; i < FreeLimits.binderCards; i++) {
        expect(
          binder.add(
            buildCard(id: 'card-$i'),
            binderId: i < half ? BinderIds.trade : BinderIds.collection,
          ),
          isTrue,
        );
      }
      expect(binder.add(buildCard(id: 'one-too-many')), isFalse);
      expect(
        binder.add(buildCard(id: 'card-0'), binderId: BinderIds.collection),
        isTrue,
      );
    });
      final c = await makeContainer(isPro: false);
      final binder = c.read(binderProvider.notifier);
      for (var i = 0; i < FreeLimits.binderCards; i++) {
        binder.add(buildCard(id: 'card-$i'));
      }

      expect(binder.add(buildCard(id: 'card-0'), quantity: 3), isTrue);
      expect(binder.quantityOf('card-0'), 4);
      expect(c.read(binderProvider), hasLength(FreeLimits.binderCards));
    });

    test('counts the binder and want list against separate caps', () async {
      final c = await makeContainer(isPro: false);
      final binder = c.read(binderProvider.notifier);
      for (var i = 0; i < FreeLimits.binderCards; i++) {
        binder.add(buildCard(id: 'card-$i'));
      }

      // The binder is full, but the want list is untouched.
      expect(binder.add(buildCard(id: 'wanted'), isWanted: true), isTrue);
    });

    test('lifts the cap for Pro', () async {
      final c = await makeContainer(isPro: true);
      final binder = c.read(binderProvider.notifier);

      for (var i = 0; i < FreeLimits.binderCards + 5; i++) {
        expect(binder.add(buildCard(id: 'card-$i')), isTrue);
      }
      expect(c.read(binderProvider), hasLength(FreeLimits.binderCards + 5));
    });

    test('trade reconciliation is exempt from the cap', () async {
      final c = await makeContainer(isPro: false);
      final binder = c.read(binderProvider.notifier);
      for (var i = 0; i < FreeLimits.binderCards; i++) {
        binder.add(buildCard(id: 'card-$i'));
      }

      // Cards just traded for must never be dropped to enforce a limit.
      final received = buildCard(id: 'traded-for');
      binder.applyTradeConfirm(
        Trade(
          id: 't1',
          createdAt: DateTime.now(),
          wantItems: [TradeItem(card: received, quantity: 1, priceEach: 1)],
        ),
        removeGivenFromBinder: false,
        addReceivedToBinder: true,
      );

      expect(binder.quantityOf('traded-for'), 1);
      expect(c.read(binderProvider), hasLength(FreeLimits.binderCards + 1));
    });
  });

  group('trade history free-tier window', () {
    test('keeps every trade below the limit and reports no roll-off', () async {
      final c = await makeContainer(isPro: false);
      final history = c.read(tradeHistoryProvider.notifier);

      for (var i = 0; i < FreeLimits.savedTrades; i++) {
        expect(history.addTrade(buildTrade('t$i')), 0);
      }
      expect(c.read(tradeHistoryProvider), hasLength(FreeLimits.savedTrades));
    });

    test('rolls the oldest off rather than refusing the trade', () async {
      final c = await makeContainer(isPro: false);
      final history = c.read(tradeHistoryProvider.notifier);
      for (var i = 0; i < FreeLimits.savedTrades; i++) {
        history.addTrade(buildTrade('t$i'));
      }

      expect(history.addTrade(buildTrade('newest')), 1);

      final saved = c.read(tradeHistoryProvider);
      expect(saved, hasLength(FreeLimits.savedTrades));
      expect(saved.first.id, 'newest');
      expect(saved.map((t) => t.id), isNot(contains('t0')));
    });

    test('keeps unlimited history for Pro', () async {
      final c = await makeContainer(isPro: true);
      final history = c.read(tradeHistoryProvider.notifier);

      for (var i = 0; i < FreeLimits.savedTrades + 4; i++) {
        expect(history.addTrade(buildTrade('t$i')), 0);
      }
      expect(
        c.read(tradeHistoryProvider),
        hasLength(FreeLimits.savedTrades + 4),
      );
    });
  });

  group('loaned-card free-tier cap', () {
    test('accepts cards up to the limit, then refuses', () async {
      final c = await makeContainer(isPro: false);
      final lend = c.read(lendProvider.notifier);
      final groupId = lend.createGroup(isBorrowing: false);

      for (var i = 0; i < FreeLimits.loanedCards; i++) {
        expect(lend.addCard(groupId, buildCard(id: 'lent-$i')), isTrue);
      }
      expect(lend.addCard(groupId, buildCard(id: 'one-too-many')), isFalse);
    });

    test('does not count borrowed cards against the loaned cap', () async {
      final c = await makeContainer(isPro: false);
      final lend = c.read(lendProvider.notifier);
      // createGroup keys on microsecondsSinceEpoch; space the two calls so the
      // borrowed and lent groups cannot collide on the same id.
      final borrowed = lend.createGroup(isBorrowing: true);
      await Future<void>.delayed(const Duration(milliseconds: 2));
      final lent = lend.createGroup(isBorrowing: false);

      for (var i = 0; i < FreeLimits.loanedCards + 3; i++) {
        expect(lend.addCard(borrowed, buildCard(id: 'borrowed-$i')), isTrue);
      }
      for (var i = 0; i < FreeLimits.loanedCards; i++) {
        expect(lend.addCard(lent, buildCard(id: 'lent-$i')), isTrue);
      }
      expect(lend.addCard(lent, buildCard(id: 'one-too-many')), isFalse);
    });

    test('refuses raising quantity past the cap', () async {
      final c = await makeContainer(isPro: false);
      final lend = c.read(lendProvider.notifier);
      final groupId = lend.createGroup(isBorrowing: false);
      lend.addCard(groupId, buildCard(id: 'only'));

      expect(
        lend.setCardQuantity(groupId, 'only', FreeLimits.loanedCards),
        isTrue,
      );
      expect(
        lend.setCardQuantity(groupId, 'only', FreeLimits.loanedCards + 1),
        isFalse,
      );
      expect(
        c.read(lendGroupProvider(groupId))!.items.single.quantity,
        FreeLimits.loanedCards,
      );
    });

    test('lifts the cap for Pro', () async {
      final c = await makeContainer(isPro: true);
      final lend = c.read(lendProvider.notifier);
      final groupId = lend.createGroup(isBorrowing: false);

      for (var i = 0; i < FreeLimits.loanedCards + 3; i++) {
        expect(lend.addCard(groupId, buildCard(id: 'lent-$i')), isTrue);
      }
    });
  });

  group('freeUsageProvider', () {
    test('is null for Pro, since nothing is capped', () async {
      final c = await makeContainer(isPro: true);
      expect(c.read(freeUsageProvider), isNull);
    });

    test('splits binder, want-list, loaned, and trade counts', () async {
      final c = await makeContainer(isPro: false);
      final binder = c.read(binderProvider.notifier);
      binder.add(buildCard(id: 'a'));
      binder.add(buildCard(id: 'b'));
      binder.add(buildCard(id: 'c'), isWanted: true);
      final lend = c.read(lendProvider.notifier);
      final groupId = lend.createGroup(isBorrowing: false);
      lend.addCard(groupId, buildCard(id: 'out'));
      c.read(tradeHistoryProvider.notifier).addTrade(buildTrade('t1'));

      final usage = c.read(freeUsageProvider)!;
      expect(usage.binderCards, 2);
      expect(usage.wantListCards, 1);
      expect(usage.loanedCards, 1);
      expect(usage.savedTrades, 1);
    });

    test('only flags pressure once a cap is in sight', () async {
      final c = await makeContainer(isPro: false);
      final binder = c.read(binderProvider.notifier);
      binder.add(buildCard(id: 'a'));
      expect(c.read(freeUsageProvider)!.isNearAnyLimit, isFalse);

      for (var i = 0; i < FreeLimits.binderCards - 1; i++) {
        binder.add(buildCard(id: 'card-$i'));
      }
      expect(c.read(freeUsageProvider)!.isNearAnyLimit, isTrue);
    });
  });
}
