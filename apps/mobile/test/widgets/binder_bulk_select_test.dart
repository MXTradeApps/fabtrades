import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/binder/binder_screen.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

Future<ProviderContainer> pumpTradeBinder(WidgetTester tester) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final container = await pumpApp(
    tester,
    const BinderScreen(),
    seed: {
      OnboardingRepository.storageKey:
          jsonEncode(OnboardingTourId.all.toList()),
    },
  );
  final binder = container.read(binderProvider.notifier);
  binder.add(buildCard(id: 'a-Normal', name: 'Alpha', tcgMarket: 3),
      quantity: 2, binderId: BinderIds.trade);
  binder.add(buildCard(id: 'b-Normal', name: 'Beta', tcgMarket: 1),
      binderId: BinderIds.trade);
  binder.add(buildCard(id: 'c-Normal', name: 'Gamma', tcgMarket: 5),
      binderId: BinderIds.trade);
  await tester.pump();
  await tester.tap(find.byKey(const Key('binderTile-system:trade')));
  await tester.pumpAndSettle();
  return container;
}

Future<void> select(WidgetTester tester, String id) async {
  await tester.longPress(find.byKey(Key('binderRow-$id')));
  await tester.pumpAndSettle();
}

List<String> idsIn(ProviderContainer c, String binderId) => c
    .read(binderProvider)
    .where((e) => !e.isWanted && e.resolvedBinderId == binderId)
    .map((e) => e.card.id)
    .toList()
  ..sort();

void main() {
  testWidgets('long-press starts selection; taps toggle; close ends it',
      (tester) async {
    await pumpTradeBinder(tester);
    expect(find.byKey(const Key('binderSelectionBar')), findsNothing);

    await select(tester, 'a-Normal');
    expect(find.byKey(const Key('binderSelectionBar')), findsOneWidget);
    expect(find.text('1 selected'), findsOneWidget);
    // The per-row Move button and stepper step aside while selecting.
    expect(find.byKey(const Key('moveBinder-b-Normal')), findsNothing);

    await tester.tap(find.byKey(const Key('binderRow-b-Normal')));
    await tester.pumpAndSettle();
    expect(find.text('2 selected'), findsOneWidget);

    await tester.tap(find.byKey(const Key('binderRow-b-Normal')));
    await tester.pumpAndSettle();
    expect(find.text('1 selected'), findsOneWidget);

    await tester.tap(find.byKey(const Key('binderSelectAll')));
    await tester.pumpAndSettle();
    expect(find.text('3 selected'), findsOneWidget);

    await tester.tap(find.byKey(const Key('binderSelectionClose')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('binderSelectionBar')), findsNothing);
    expect(find.text('Add card'), findsOneWidget);
  });

  testWidgets('moves every copy of the selected rows to another Binder',
      (tester) async {
    final container = await pumpTradeBinder(tester);
    await select(tester, 'a-Normal');
    await tester.tap(find.byKey(const Key('binderRow-c-Normal')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('binderBulkMove')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('bulkMoveDest-system:want')), findsNothing);
    await tester.tap(find.byKey(const Key('bulkMoveDest-system:collection')));
    await tester.pumpAndSettle();

    expect(idsIn(container, BinderIds.trade), ['b-Normal']);
    expect(idsIn(container, BinderIds.collection), ['a-Normal', 'c-Normal']);
    final alpha = container
        .read(binderProvider)
        .singleWhere((e) => e.card.id == 'a-Normal');
    expect(alpha.quantity, 2);
    expect(find.text('Moved 2 cards to Collection'), findsOneWidget);
    expect(find.byKey(const Key('binderSelectionBar')), findsNothing);
  });

  testWidgets('removes selected rows and Undo puts them back',
      (tester) async {
    final container = await pumpTradeBinder(tester);
    await select(tester, 'a-Normal');
    await tester.tap(find.byKey(const Key('binderRow-b-Normal')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('binderBulkRemove')));
    await tester.pumpAndSettle();
    expect(idsIn(container, BinderIds.trade), ['c-Normal']);
    expect(find.text('Removed 2 cards'), findsOneWidget);

    await tester.tap(find.byKey(const Key('binderBulkRemovedUndo')));
    await tester.pumpAndSettle();
    expect(idsIn(container, BinderIds.trade),
        ['a-Normal', 'b-Normal', 'c-Normal']);
    expect(
      container
          .read(binderProvider)
          .singleWhere((e) => e.card.id == 'a-Normal')
          .quantity,
      2,
    );
  });

  testWidgets('adds selected cards to my side of the trade', (tester) async {
    final container = await pumpTradeBinder(tester);
    await select(tester, 'b-Normal');
    await tester.tap(find.byKey(const Key('binderRow-c-Normal')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('binderBulkTrade')));
    await tester.pumpAndSettle();

    final draft = container.read(tradeDraftProvider);
    expect(draft.haveItems.map((i) => i.card.id).toList()..sort(),
        ['b-Normal', 'c-Normal']);
    expect(draft.wantItems, isEmpty);
    // Cards stay in the Binder until the trade is confirmed.
    expect(idsIn(container, BinderIds.trade),
        ['a-Normal', 'b-Normal', 'c-Normal']);
    expect(find.byKey(const Key('binderBulkTradeSnack')), findsOneWidget);
  });

  testWidgets('Want List selection adds cards to the side I want',
      (tester) async {
    final container = await pumpTradeBinder(tester);
    final binder = container.read(binderProvider.notifier);
    binder.add(buildCard(id: 'w1-Normal', name: 'Wanted One', tcgMarket: 2),
        isWanted: true);
    binder.add(buildCard(id: 'w2-Normal', name: 'Wanted Two', tcgMarket: 4),
        isWanted: true);
    container
        .read(tradeDraftProvider.notifier)
        .addCard(TradeSide.want, buildCard(id: 'x-Normal', name: 'Existing'));
    container.read(openBinderIdProvider.notifier).open(BinderIds.want);
    await tester.pumpAndSettle();

    await tester.longPress(find.byKey(const Key('wantCard-w1-Normal')));
    await tester.pumpAndSettle();
    expect(find.text('1 selected'), findsOneWidget);
    // Wants can't be moved between Binders or sold.
    expect(find.byKey(const Key('binderBulkMove')), findsNothing);
    expect(find.byKey(const Key('binderBulkSell')), findsNothing);

    await tester.tap(find.byKey(const Key('wantCard-w2-Normal')));
    await tester.pumpAndSettle();
    expect(find.text('2 selected'), findsOneWidget);

    await tester.tap(find.byKey(const Key('binderBulkTrade')));
    await tester.pumpAndSettle();

    final draft = container.read(tradeDraftProvider);
    // Appended after what was already on that side.
    final wantIds = draft.wantItems.map((i) => i.card.id).toList();
    expect(wantIds.first, 'x-Normal');
    expect(wantIds.skip(1).toList()..sort(), ['w1-Normal', 'w2-Normal']);
    expect(draft.haveItems, isEmpty);
    expect(find.text('Added 2 cards to Cards I Want'), findsOneWidget);
    expect(find.byKey(const Key('binderSelectionBar')), findsNothing);
  });
}
