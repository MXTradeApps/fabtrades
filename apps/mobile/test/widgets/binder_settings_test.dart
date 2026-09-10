import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/binder/binder_screen.dart';
import 'package:fabtrades/features/binder/binder_settings_screen.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';
import 'package:fabtrades/features/settings/settings_screen.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

Map<String, Object> _onboarded() => {
      OnboardingRepository.storageKey:
          jsonEncode(OnboardingTourId.all.toList()),
    };

const _headers =
    'Identifier,Name,Pitch,Set,Set number,Edition,Foiling,Treatment,Have,Want in trade,Want to buy,Extra for trade,Extra to sell';

String _csv(List<String> rows) => '$_headers\n${rows.join('\n')}\n';

final _lightning = buildCard(
  id: '123-Normal',
  name: 'Lightning Press',
  collectorNumber: 'SUP001',
  subTypeName: 'Normal',
  setName: 'Super Slam',
  tcgMarket: 12.5,
);

String get _ownedCsv => _csv([
      '1,Lightning Press,,Super Slam,SUP001,,,,2,9,,8,',
      '2,Unknown Junk,,Nowhere,ZZZ999,,,,1,,,,',
    ]);

String get _wantOnlyCsv => _csv([
      '1,Lightning Press,,Super Slam,SUP001,,,,0,5,,3,',
    ]);

Future<ProviderContainer> _pumpImport(
  WidgetTester tester, {
  Future<String?> Function()? pickCsv,
  List<CardModel>? catalog,
}) async {
  return pumpApp(
    tester,
    BinderSettingsScreen(
      pickCsv: pickCsv,
    ),
    catalog: catalog ?? [_lightning],
    seed: _onboarded(),
  );
}

void main() {
  testWidgets('hamburger offers Import from Fabrary; binder tiles do not',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpApp(
      tester,
      const BinderScreen(),
      seed: _onboarded(),
    );
    await tester.pump();

    await tester.tap(find.byKey(const Key('binderTileMenu-system:collection')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('binderTileSettings-system:collection')),
        findsNothing);
    expect(find.text('Settings'), findsNothing);
    await tester.tapAt(const Offset(8, 400));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    expect(find.text('Import from Fabrary'), findsOneWidget);
    await tester.tap(find.text('Import from Fabrary'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Import from Fabrary'), findsOneWidget);
    expect(find.byKey(const Key('importFabrary')), findsOneWidget);
  });

  testWidgets('Want List tab and app Settings have no Fabrary import',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpApp(
      tester,
      const BinderScreen(),
      seed: _onboarded(),
    );
    await tester.pump();
    await tester.tap(find.widgetWithText(Tab, 'Want List (0)'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('binderSettings')), findsNothing);
    expect(find.byKey(const Key('importFabrary')), findsNothing);

    await pumpApp(tester, const SettingsScreen());
    expect(find.text('Import from Fabrary'), findsNothing);
    expect(find.byKey(const Key('importFabrary')), findsNothing);
  });

  testWidgets('open Binder no longer shows Settings', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpApp(
      tester,
      const BinderScreen(),
      seed: _onboarded(),
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('binderTile-system:collection')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('collectionStatsButton')), findsNothing);
    expect(find.byKey(const Key('binderSettings')), findsNothing);
  });

  testWidgets('preview lists unmatched names; cancel writes nothing',
      (tester) async {
    var picked = false;
    final container = await _pumpImport(
      tester,
      pickCsv: () async {
        picked = true;
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return _ownedCsv;
      },
    );

    await tester.tap(find.byKey(const Key('importFabrary')));
    await tester.pump();
    expect(find.byKey(const Key('fabraryWorking')), findsOneWidget);
    await tester.pumpAndSettle();
    expect(picked, isTrue);
    expect(find.byKey(const Key('fabraryPreview')), findsOneWidget);
    expect(find.textContaining('Rows with quantities: 2'), findsOneWidget);
    expect(find.textContaining('Collection: 2'), findsOneWidget);
    expect(find.textContaining('Want List: 9'), findsOneWidget);
    expect(find.textContaining('Trade Binder: 8'), findsOneWidget);
    expect(find.textContaining('Matched: 3'), findsOneWidget);
    expect(find.textContaining('Unmatched: 1'), findsOneWidget);
    expect(find.textContaining('Copies to add: 19'), findsOneWidget);
    expect(find.textContaining('Unknown Junk'), findsOneWidget);
    expect(find.textContaining('adds Have copies to Collection'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byKey(const Key('fabraryConfirm'))).onPressed,
        isNotNull);

    final before = container.read(binderProvider);
    await tester.tap(find.byKey(const Key('fabraryCancel')));
    await tester.pump();
    expect(container.read(binderProvider), before);
    expect(find.byKey(const Key('fabraryPreview')), findsNothing);
  });

  testWidgets('Want and Extra preview into Want List and Trade Binder',
      (tester) async {
    await _pumpImport(
      tester,
      pickCsv: () async => _wantOnlyCsv,
    );
    await tester.tap(find.byKey(const Key('importFabrary')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('fabraryPreview')), findsOneWidget);
    expect(find.textContaining('Collection: 0'), findsOneWidget);
    expect(find.textContaining('Want List: 5'), findsOneWidget);
    expect(find.textContaining('Trade Binder: 3'), findsOneWidget);
    expect(find.byKey(const Key('fabraryRefuse')), findsNothing);
  });

  testWidgets('confirm adds Collection, Want List, and Trade; second doubles',
      (tester) async {
    final other = buildCard(id: 'other-Normal', name: 'Other');
    final container = await _pumpImport(
      tester,
      pickCsv: () async => _ownedCsv,
    );
    container.read(binderProvider.notifier).add(
          other,
          binderId: BinderIds.trade,
        );
    container.read(binderProvider.notifier).add(
          _lightning,
          isWanted: true,
        );
    container.read(binderProvider.notifier).add(
          _lightning,
          condition: 'LP',
          binderId: BinderIds.collection,
        );
    await tester.pump();

    await tester.tap(find.byKey(const Key('importFabrary')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('fabraryConfirm')));
    await tester.pumpAndSettle();

    final afterFirst = container.read(binderProvider);
    expect(
      afterFirst
          .where((e) =>
              !e.isWanted &&
              e.resolvedBinderId == BinderIds.collection &&
              e.card.id == _lightning.id &&
              e.condition == 'NM')
          .single
          .quantity,
      2,
    );
    expect(
      afterFirst
          .where((e) =>
              e.resolvedBinderId == BinderIds.collection && e.condition == 'LP')
          .single
          .quantity,
      1,
    );
    expect(
      afterFirst
          .where((e) =>
              !e.isWanted &&
              e.resolvedBinderId == BinderIds.trade &&
              e.card.id == _lightning.id)
          .single
          .quantity,
      8,
    );
    expect(
      afterFirst
          .where((e) => e.resolvedBinderId == BinderIds.trade && e.card.id == 'other-Normal')
          .single
          .quantity,
      1,
    );
    expect(afterFirst.where((e) => e.isWanted && e.card.id == _lightning.id).single.quantity, 10);
    expect(find.textContaining('Unknown Junk'), findsOneWidget);

    await tester.tap(find.byKey(const Key('fabraryConfirm')));
    await tester.pumpAndSettle();
    expect(
      container
          .read(binderProvider)
          .where((e) =>
              !e.isWanted &&
              e.resolvedBinderId == BinderIds.collection &&
              e.card.id == _lightning.id &&
              e.condition == 'NM')
          .single
          .quantity,
      4,
    );
  });

  testWidgets('confirm restores a deleted Collection binder', (tester) async {
    final container = await _pumpImport(
      tester,
      pickCsv: () async => _ownedCsv,
    );
    expect(
      container.read(bindersProvider.notifier).delete(BinderIds.collection),
      isNull,
    );
    expect(
      container
          .read(bindersProvider)
          .where((b) => b.clientId == BinderIds.collection && b.isLive),
      isEmpty,
    );

    await tester.tap(find.byKey(const Key('importFabrary')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('fabraryConfirm')));
    await tester.pumpAndSettle();

    final collection = container
        .read(bindersProvider)
        .where((b) => b.clientId == BinderIds.collection && b.isLive)
        .single;
    expect(collection.name, 'Collection');
  });

  testWidgets('refuses bad file and no match; large Binder still previews',
      (tester) async {
    final owned = [
      for (var i = 0; i < 50; i++)
        buildCard(id: 'owned-$i', name: 'Owned $i', collectorNumber: 'X$i'),
    ];
    final container = await _pumpImport(
      tester,
      catalog: [_lightning, ...owned],
      pickCsv: () async => 'not,a,fabrary\n1,2,3\n',
    );
    for (var i = 0; i < 50; i++) {
      container.read(binderProvider.notifier).add(
            owned[i],
            binderId: BinderIds.trade,
          );
    }
    await tester.pump();

    await tester.tap(find.byKey(const Key('importFabrary')));
    await tester.pumpAndSettle();
    expect(find.text('This is not a Fabrary collection export'), findsOneWidget);
    expect(container.read(binderProvider).where((e) => !e.isWanted).length, 50);

    await _pumpImport(
      tester,
      pickCsv: () async => _csv([
        '1,Unknown Junk,,Nowhere,ZZZ999,,,,1,,,,',
      ]),
    );
    await tester.tap(find.byKey(const Key('importFabrary')));
    await tester.pumpAndSettle();
    expect(
      find.text('None of those cards were found in the catalog'),
      findsOneWidget,
    );

    final largeContainer = await _pumpImport(
      tester,
      catalog: [_lightning, ...owned],
      pickCsv: () async => _ownedCsv,
    );
    for (var i = 0; i < 50; i++) {
      largeContainer.read(binderProvider.notifier).add(
            owned[i],
            binderId: BinderIds.trade,
          );
    }
    await tester.pump();
    await tester.tap(find.byKey(const Key('importFabrary')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('fabraryPreview')), findsOneWidget);
    expect(find.textContaining('Copies to add: 19'), findsOneWidget);
    expect(find.text('Upgrade to Pro'), findsNothing);
    expect(find.byKey(const Key('fabraryUpgrade')), findsNothing);
    expect(
      largeContainer
          .read(binderProvider)
          .where((e) => e.card.id == _lightning.id && !e.isWanted),
      isEmpty,
    );
  });
}
