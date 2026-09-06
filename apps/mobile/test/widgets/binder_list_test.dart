import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/binder/binder_screen.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

Map<String, Object> _onboarded() => {
      OnboardingRepository.storageKey:
          jsonEncode(OnboardingTourId.all.toList()),
    };

Future<ProviderContainer> pumpBinder(WidgetTester tester) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final container = await pumpApp(
    tester,
    const BinderScreen(),
    seed: _onboarded(),
  );
  await tester.pump();
  return container;
}

Future<void> _openTradeBinder(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('binderTile-system:trade')));
  await tester.pumpAndSettle();
}

Future<void> _moveQty({
  required WidgetTester tester,
  required String printingId,
  required String destId,
  required int tapRemove,
}) async {
  await tester.tap(find.byKey(Key('moveBinder-$printingId')));
  await tester.pumpAndSettle();
  expect(find.byKey(Key('moveDest-$destId')), findsOneWidget);
  expect(find.text('Want List'), findsNothing);
  await tester.tap(find.byKey(Key('moveDest-$destId')));
  await tester.pumpAndSettle();
  for (var i = 0; i < tapRemove; i++) {
    await tester.tap(find.descendant(
      of: find.byType(AlertDialog),
      matching: find.byIcon(Icons.remove),
    ));
    await tester.pump();
  }
  await tester.tap(find.descendant(
    of: find.byType(AlertDialog),
    matching: find.text('Move'),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('move 2 of 3 Trade Binder copies to Collection and updates tiles',
      (tester) async {
    final container = await pumpBinder(tester);
    container.read(binderProvider.notifier).add(
          buildCard(
            id: 'alpha-Normal',
            name: 'Alpha',
            tcgMarket: 2,
            imageUrl: 'https://example.com/a.png',
          ),
          quantity: 3,
          binderId: BinderIds.trade,
        );
    await tester.pump();

    await _openTradeBinder(tester);
    expect(find.text('Alpha'), findsOneWidget);

    await _moveQty(
      tester: tester,
      printingId: 'alpha-Normal',
      destId: BinderIds.collection,
      tapRemove: 1,
    );

    await tester.tap(find.byKey(const Key('binderBackToGrid')));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileCount-system:trade')))
          .data,
      '1',
    );
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileCount-system:collection')))
          .data,
      '2',
    );
    expect(
      find.byKey(const Key('binderTileCover-system:trade')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('binderTileCover-system:collection')),
      findsOneWidget,
    );
  });

  testWidgets('destination merges on the same printing and condition',
      (tester) async {
    final container = await pumpBinder(tester);
    final card = buildCard(id: 'bravo-Normal', name: 'Bravo', tcgMarket: 1.5);
    container.read(binderProvider.notifier).add(
          card,
          quantity: 3,
          binderId: BinderIds.trade,
        );
    container.read(binderProvider.notifier).add(
          card,
          quantity: 1,
          binderId: BinderIds.collection,
        );
    await tester.pump();

    await _openTradeBinder(tester);
    await _moveQty(
      tester: tester,
      printingId: 'bravo-Normal',
      destId: BinderIds.collection,
      tapRemove: 1,
    );

    await tester.tap(find.byKey(const Key('binderBackToGrid')));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileCount-system:trade')))
          .data,
      '1',
    );
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileCount-system:collection')))
          .data,
      '3',
    );
  });

  testWidgets('Want List is absent from move destinations', (tester) async {
    final container = await pumpBinder(tester);
    container.read(binderProvider.notifier).add(
          buildCard(id: 'alpha-Normal', name: 'Alpha', tcgMarket: 2),
          quantity: 2,
          binderId: BinderIds.trade,
        );
    container.read(binderProvider.notifier).add(
          buildCard(id: 'want-1', name: 'Wanted'),
          isWanted: true,
        );
    await tester.pump();

    await _openTradeBinder(tester);
    await tester.tap(find.byKey(const Key('moveBinder-alpha-Normal')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('moveDest-system:collection')), findsOneWidget);
    expect(find.text('Want List'), findsNothing);
    expect(find.byKey(const Key('moveDest-want')), findsNothing);
  });
}
