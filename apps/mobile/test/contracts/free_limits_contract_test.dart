// Contract tests for the free-tier caps.
//
// The same fixture is read by the web app's Jest suite, so both clients are held
// to one set of numbers. See packages/contracts/README.md.
//
// Each case runs through the real notifiers rather than recomputing the rule:
// a fixture checked against a second copy of the arithmetic would agree with
// itself while the app did something else.
import 'dart:convert';

import 'package:fabtrades/core/logic/free_limits.dart';
import 'package:fabtrades/core/models/subscription_status.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/fixtures.dart';
import 'contract_fixtures.dart';

class _FreeSubscription extends SubscriptionNotifier {
  @override
  Future<SubscriptionStatus> build() async => SubscriptionStatus.free;
}

Trade _trade(String id) => Trade(id: id, createdAt: DateTime.now());

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final contract = loadContract('free_limits');
  final limits = Map<String, dynamic>.from(contract['limits'] as Map);
  final cases = contractCases(contract, 'cases');

  /// A free account whose history already holds [trades].
  ///
  /// Seeded through storage rather than by calling `addTrade` in a loop, because
  /// that trims as it goes and could never produce an overfull history. Arriving
  /// overfull is a real state all the same: a lapsed subscription, or a sync that
  /// pulled down what another device saved while Pro.
  Future<ProviderContainer> freeContainer({int trades = 0}) async {
    SharedPreferences.setMockInitialValues({
      if (trades > 0)
        'saved_trades': jsonEncode([
          for (var i = 0; i < trades; i++) _trade('seeded-$i').toJson(),
        ]),
    });
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        subscriptionProvider.overrideWith(_FreeSubscription.new),
      ],
    );
    addTearDown(container.dispose);
    await container.read(subscriptionProvider.future);
    return container;
  }

  group('free limits contract', () {
    test('agrees with the shared caps', () {
      expect(FreeLimits.binderCards, limits['binderCards']);
      expect(FreeLimits.wantListCards, limits['wantListCards']);
      expect(FreeLimits.savedTrades, limits['savedTrades']);
      expect(FreeLimits.loanedCards, limits['loanedCards']);
      expect(FreeLimits.binders, limits['binders']);
    });

    for (final testCase in cases.where(
      (c) =>
          (c['limit'] == 'binderCards' || c['limit'] == 'wantListCards') &&
          c['action'] != 'move',
    )) {
      test(testCase['name'] as String, () async {
        final container = await freeContainer();
        final binder = container.read(binderProvider.notifier);
        final isWanted = testCase['limit'] == 'wantListCards';
        final split = testCase['splitAcrossBinders'] == true;

        if (split) {
          final existing = testCase['existing'] as int;
          final tradeCount = existing ~/ 2;
          for (var i = 0; i < existing; i++) {
            binder.add(
              buildCard(id: 'card-$i'),
              binderId: i < tradeCount
                  ? 'system:trade'
                  : 'system:collection',
            );
          }
        } else {
          for (var i = 0; i < (testCase['existing'] as int); i++) {
            binder.add(buildCard(id: 'card-$i'), isWanted: isWanted);
          }
        }

        expect(
          binder.add(buildCard(id: 'one-more'), isWanted: isWanted),
          testCase['allowed'],
        );
      });
    }

    for (final testCase in cases.where((c) => c['limit'] == 'loanedCards')) {
      test(testCase['name'] as String, () async {
        final container = await freeContainer();
        final lend = container.read(lendProvider.notifier);
        final groupId = lend.createGroup(isBorrowing: false);

        for (var i = 0; i < (testCase['existing'] as int); i++) {
          expect(lend.addCard(groupId, buildCard(id: 'lent-$i')), isTrue);
        }

        expect(
          lend.addCard(groupId, buildCard(id: 'one-more')),
          testCase['allowed'],
        );
      });
    }

    for (final testCase in cases.where((c) => c['limit'] == 'savedTrades')) {
      test(testCase['name'] as String, () async {
        final container = await freeContainer(
          trades: testCase['existing'] as int,
        );
        final history = container.read(tradeHistoryProvider.notifier);

        final trimmed = history.addTrade(_trade('newest'));

        // Saving is never refused, only trimmed: confirming a trade also
        // reconciles the binder, so blocking it would lose real information.
        expect(testCase['allowed'], true);
        expect(trimmed, testCase['trimmed']);

        final saved = container.read(tradeHistoryProvider);
        expect(saved.first.id, 'newest');
        expect(
          saved,
          hasLength(
            testCase['trimmed'] == 0
                ? (testCase['existing'] as int) + 1
                : FreeLimits.savedTrades,
          ),
        );
      });
    }

    for (final testCase in cases.where((c) => c['limit'] == 'binders')) {
      test(testCase['name'] as String, () {
        var live = testCase['existing'] as int;
        if (testCase['tombstonedCollection'] == true) {
          // Three live + a deleted Collection still allows create on free.
          live = testCase['existing'] as int;
        }
        expect(
          FreeLimits.canCreateBinder(
            live,
            isPro: testCase['isPro'] as bool? ?? false,
          ),
          testCase['allowed'],
        );
      });
    }

    for (final testCase in cases.where(
      (c) => c['limit'] == 'binderCards' && c['action'] == 'move',
    )) {
      test(testCase['name'] as String, () async {
        final container = await freeContainer();
        final binder = container.read(binderProvider.notifier);
        for (var i = 0; i < (testCase['existing'] as int); i++) {
          binder.add(buildCard(id: 'card-$i'), binderId: 'system:trade');
        }
        // Same Printing into Collection is not a new distinct owned card.
        expect(
          binder.add(
            buildCard(id: 'card-0'),
            binderId: 'system:collection',
          ),
          testCase['allowed'],
        );
        expect(
          container
              .read(binderProvider)
              .where((e) => !e.isWanted)
              .map((e) => e.card.id)
              .toSet(),
          hasLength(testCase['existing'] as int),
        );
      });
    }
  });
}
