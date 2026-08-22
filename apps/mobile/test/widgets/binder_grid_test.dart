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

Future<ProviderContainer> pumpGrid(WidgetTester tester) async {
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

void main() {
  testWidgets('grid shows two default tiles', (tester) async {
    await pumpGrid(tester);

    expect(find.byKey(const Key('binderGrid')), findsOneWidget);
    expect(find.byKey(const Key('binderTile-system:trade')), findsOneWidget);
    expect(find.byKey(const Key('binderTile-system:collection')), findsOneWidget);
    expect(find.text('Want List'), findsNothing);
    expect(find.widgetWithText(Tab, 'Want List (0)'), findsOneWidget);
    expect(find.widgetWithText(Tab, 'Binder (0)'), findsOneWidget);
  });

  testWidgets('empty tiles show 0, true-zero value, and no cover', (tester) async {
    await pumpGrid(tester);

    expect(find.byKey(const Key('binderTileCount-system:trade')), findsOneWidget);
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileCount-system:trade')))
          .data,
      '0',
    );
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileValue-system:trade')))
          .data,
      '\$0.00',
    );
    expect(find.byKey(const Key('binderTileCover-system:trade')), findsNothing);
    expect(find.byKey(const Key('binderTileCover-system:collection')), findsNothing);
  });

  testWidgets('tile name, count, and value match owned cards; unpriced is dash',
      (tester) async {
    final container = await pumpGrid(tester);

    container.read(binderProvider.notifier).add(
          buildCard(
            id: 'a-Normal',
            name: 'Alpha',
            tcgMarket: 12.5,
            imageUrl: 'https://example.com/a.png',
          ),
          binderId: BinderIds.trade,
        );
    container.read(binderProvider.notifier).add(
          buildCard(id: 'u-Normal', name: 'Unpriced', imageUrl: 'https://example.com/u.png'),
          binderId: BinderIds.collection,
        );
    await tester.pump();

    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileName-system:trade')))
          .data,
      'Trade Binder',
    );
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileCount-system:trade')))
          .data,
      '1',
    );
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileValue-system:trade')))
          .data,
      '\$12.50',
    );
    expect(find.byKey(const Key('binderTileCover-system:trade')), findsOneWidget);

    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileCount-system:collection')))
          .data,
      '1',
    );
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileValue-system:collection')))
          .data,
      '—',
    );
    expect(find.text('\$0.00'), findsNothing);
    expect(find.text('€0.00'), findsNothing);
    expect(
      find.byKey(const Key('binderTileCover-system:collection')),
      findsOneWidget,
    );
  });

  testWidgets('tile opens that Binder list and back returns to the grid',
      (tester) async {
    final container = await pumpGrid(tester);
    container.read(binderProvider.notifier).add(
          buildCard(id: 'a-Normal', name: 'Alpha', tcgMarket: 12.5),
          binderId: BinderIds.trade,
        );
    await tester.pump();

    await tester.tap(find.byKey(const Key('binderTile-system:trade')));
    await tester.pumpAndSettle();

    expect(find.text('Alpha'), findsOneWidget);
    expect(find.byKey(const Key('binderGrid')), findsNothing);
    expect(find.byKey(const Key('binderValueChip')), findsOneWidget);

    await tester.tap(find.byKey(const Key('binderBackToGrid')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('binderGrid')), findsOneWidget);
    expect(find.text('Alpha'), findsNothing);
  });

  testWidgets('existing owned cards appear in Trade Binder; signed-out still grids',
      (tester) async {
    final container = await pumpGrid(tester);
    container.read(binderProvider.notifier).add(
          buildCard(id: 'legacy', name: 'Legacy Card', tcgMarket: 3),
        );
    await tester.pump();

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
      '0',
    );

    await tester.tap(find.byKey(const Key('binderTile-system:trade')));
    await tester.pumpAndSettle();
    expect(find.text('Legacy Card'), findsOneWidget);
  });

  testWidgets('Want List is a sibling tab, not a tile, and does not change tiles',
      (tester) async {
    final container = await pumpGrid(tester);
    container.read(binderProvider.notifier).add(
          buildCard(id: 'want-1', name: 'Wanted Card', tcgMarket: 99),
          isWanted: true,
        );
    await tester.pump();

    expect(find.byKey(const Key('binderGrid')), findsOneWidget);
    expect(find.text('Want List'), findsNothing);
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileCount-system:trade')))
          .data,
      '0',
    );
    expect(
      tester
          .widget<Text>(find.byKey(const Key('binderTileValue-system:trade')))
          .data,
      '\$0.00',
    );

    await tester.tap(find.widgetWithText(Tab, 'Want List (1)'));
    await tester.pumpAndSettle();
    expect(find.text('Wanted Card'), findsOneWidget);
    expect(find.byKey(const Key('binderGrid')), findsNothing);

    await tester.tap(find.widgetWithText(Tab, 'Binder (0)'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('binderGrid')), findsOneWidget);
  });

  testWidgets('move copies between Binders and updates tiles', (tester) async {
    final container = await pumpGrid(tester);
    container.read(binderProvider.notifier).add(
          buildCard(id: 'alpha-Normal', name: 'Alpha', tcgMarket: 2),
          quantity: 3,
          binderId: BinderIds.trade,
        );
    await tester.pump();

    await tester.tap(find.byKey(const Key('binderTile-system:trade')));
    await tester.pumpAndSettle();
    expect(find.text('Alpha'), findsOneWidget);

    await tester.tap(find.byKey(const Key('moveBinder-alpha-Normal')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('moveDest-system:collection')), findsOneWidget);
    expect(find.text('Want List'), findsNothing);
    await tester.tap(find.byKey(const Key('moveDest-system:collection')));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(
      of: find.byType(AlertDialog),
      matching: find.byIcon(Icons.remove),
    ));
    await tester.pump();
    await tester.tap(find.descendant(
      of: find.byType(AlertDialog),
      matching: find.text('Move'),
    ));
    await tester.pumpAndSettle();

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
  });

  testWidgets('create, rename collision, Trade Binder delete, 5th is Pro',
      (tester) async {
    final container = await pumpGrid(tester);

    final binders = container.read(bindersProvider.notifier);
    expect(binders.create('Side Event', isPro: false).ok, isTrue);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Side Event'),
      64,
      scrollable: find.descendant(
        of: find.byKey(const Key('binderGrid')),
        matching: find.byType(Scrollable),
      ),
    );
    expect(find.text('Side Event'), findsOneWidget);

    expect(binders.rename(BinderIds.collection, 'Side Event').ok, isFalse);
    expect(binders.rename(BinderIds.collection, 'Side Event').reason, 'duplicate');

    await tester.tap(find.byKey(const Key('binderTileMenu-system:trade')));
    await tester.pumpAndSettle();
    expect(find.text('Delete'), findsNothing);
    await tester.tapAt(const Offset(8, 8));
    await tester.pumpAndSettle();

    container.read(binderProvider.notifier).add(
          buildCard(id: 'keep', name: 'Keep'),
          binderId: BinderIds.collection,
        );
    await tester.pump();
    await tester.ensureVisible(find.byKey(const Key('binderTileMenu-system:collection')));
    await tester.tap(find.byKey(const Key('binderTileMenu-system:collection')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('deleteBinder-system:collection')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.textContaining('Move or remove cards'), findsOneWidget);
    expect(find.byKey(const Key('binderTile-system:collection')), findsOneWidget);

    expect(binders.create('Third', isPro: false).ok, isTrue);
    await tester.pump();
    expect(binders.live, hasLength(4));
    ScaffoldMessenger.of(tester.element(find.byType(Scaffold))).clearSnackBars();
    await tester.pump();
    await tester.ensureVisible(find.byKey(const Key('createBinder')));
    await tester.tap(find.byKey(const Key('createBinder')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(binders.live, hasLength(4));
    expect(
      find.textContaining('Subscriptions are unavailable'),
      findsOneWidget,
    );
  });
}
