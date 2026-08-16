import 'dart:async';

import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/card_detail/card_detail_screen.dart';
import 'package:fabtrades/features/card_detail/price_history_section.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

void main() {
  final today = DateTime.now();
  final inWindow = today.subtract(const Duration(days: 5));
  final inWindowEarlier = today.subtract(const Duration(days: 20));
  final older = today.subtract(const Duration(days: 60));

  final card = buildCard(
    id: '111-normal',
    name: 'Vex',
    subTypeName: 'Normal',
    tcgLow: 2.0,
    tcgMarket: 3.0,
  );
  final foil = buildCard(
    id: '111-foil',
    name: 'Vex',
    subTypeName: 'Rainbow Foil',
    isFoil: true,
    tcgLow: 8.0,
    tcgMarket: 10.0,
  );

  List<PricePoint> chartable({bool withOlder = false}) => [
        if (withOlder) buildPricePoint(capturedOn: older, tcgLow: 1.0),
        buildPricePoint(capturedOn: inWindowEarlier, tcgLow: 2.0),
        buildPricePoint(capturedOn: inWindow, tcgLow: 4.0),
      ];

  Future<void> pumpDetails(
    WidgetTester tester, {
    required List<CardModel> catalog,
    CardModel? open,
    Map<String, List<PricePoint>> priceHistory = const {},
    Object? priceHistoryError,
    Future<List<PricePoint>> Function(String cardId)? onPriceHistory,
    bool isPro = false,
  }) async {
    await pumpApp(
      tester,
      CardDetailScreen(card: open ?? catalog.first),
      catalog: catalog,
      priceHistory: priceHistory,
      priceHistoryError: priceHistoryError,
      onPriceHistory: onPriceHistory,
      isPro: isPro,
    );
    await tester.pump();
    await tester.pump();
  }

  testWidgets('history sits under the Prices heading', (tester) async {
    await pumpDetails(
      tester,
      catalog: [card],
      priceHistory: {card.id: chartable()},
    );

    expect(find.text('Prices'), findsOneWidget);
    expect(find.byKey(PriceHistorySection.sectionKey), findsOneWidget);
    final pricesY = tester.getBottomLeft(find.text('Prices')).dy;
    final historyY =
        tester.getTopLeft(find.byKey(PriceHistorySection.sectionKey)).dy;
    expect(historyY, greaterThan(pricesY));
  });

  testWidgets('chartable state shows one Low line and a numeric change',
      (tester) async {
    await pumpDetails(
      tester,
      catalog: [card],
      priceHistory: {card.id: chartable()},
    );

    expect(find.byType(LineChart), findsOneWidget);
    expect(find.text('Low up \$2.00'), findsOneWidget);
    expect(
      find.textContaining('Observed catalog Low'),
      findsOneWidget,
    );
  });

  testWidgets('loading leaves Prices visible', (tester) async {
    final pending = Completer<List<PricePoint>>();
    await pumpDetails(
      tester,
      catalog: [card],
      onPriceHistory: (_) => pending.future,
    );

    expect(find.text('Prices'), findsOneWidget);
    expect(find.byKey(PriceHistorySection.loadingKey), findsOneWidget);
    expect(find.byType(LineChart), findsNothing);
    pending.complete(chartable());
    await tester.pump();
    expect(find.byType(LineChart), findsOneWidget);
  });

  testWidgets('empty leaves Prices visible and shows copy, not a chart',
      (tester) async {
    await pumpDetails(
      tester,
      catalog: [card],
      priceHistory: {
        card.id: [
          buildPricePoint(capturedOn: inWindow, tcgLow: 1.0),
        ],
      },
    );

    expect(find.text('Prices'), findsOneWidget);
    expect(find.text('History not available yet'), findsOneWidget);
    expect(find.byType(LineChart), findsNothing);
    expect(find.byKey(PriceHistorySection.proCtaKey), findsNothing);
    expect(find.byKey(PriceHistorySection.spanToggleKey), findsNothing);
  });

  testWidgets('error + Retry leave Prices and the action bar visible',
      (tester) async {
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    var calls = 0;
    await pumpApp(
      tester,
      CardDetailScreen(card: card),
      catalog: [card],
      extraOverrides: [
        priceHistoryProvider.overrideWith((ref, id) async {
          calls++;
          if (calls == 1) throw Exception('network');
          return chartable();
        }),
      ],
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Prices'), findsOneWidget);
    expect(find.text('Want List'), findsOneWidget);
    expect(find.text("Couldn't load history"), findsOneWidget);
    expect(find.byKey(PriceHistorySection.proCtaKey), findsNothing);

    await tester.ensureVisible(find.byKey(PriceHistorySection.retryKey));
    await tester.tap(find.byKey(PriceHistorySection.retryKey));
    await tester.pump();
    await tester.pump();
    expect(find.byType(LineChart), findsOneWidget);
  });

  testWidgets('free + older snapshots show Pro line, not a span control',
      (tester) async {
    await pumpDetails(
      tester,
      catalog: [card],
      priceHistory: {card.id: chartable(withOlder: true)},
    );

    expect(find.text('See full history with Pro'), findsOneWidget);
    expect(find.byKey(PriceHistorySection.spanToggleKey), findsNothing);
    expect(find.byType(LineChart), findsOneWidget);
  });

  testWidgets('Pro + older snapshots show span control, default 30-day window',
      (tester) async {
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpDetails(
      tester,
      catalog: [card],
      priceHistory: {card.id: chartable(withOlder: true)},
      isPro: true,
    );

    expect(find.text('See full history with Pro'), findsNothing);
    expect(find.byKey(PriceHistorySection.spanToggleKey), findsOneWidget);
    expect(find.text('Low up \$2.00'), findsOneWidget);

    await tester.ensureVisible(find.text('All recorded'));
    await tester.pump();
    await tester.tap(find.text('All recorded'));
    await tester.pump();
    expect(find.text('Low up \$3.00'), findsOneWidget);

    await tester.tap(find.text('30 days'));
    await tester.pump();
    expect(find.text('Low up \$2.00'), findsOneWidget);
  });

  testWidgets('switching Versions loads that Printing and drops the previous line',
      (tester) async {
    await pumpDetails(
      tester,
      catalog: [card, foil],
      priceHistory: {
        card.id: chartable(),
        foil.id: [
          buildPricePoint(capturedOn: inWindowEarlier, tcgLow: 8.0),
          buildPricePoint(capturedOn: inWindow, tcgLow: 9.0),
        ],
      },
    );

    expect(find.text('Low up \$2.00'), findsOneWidget);
    await tester.tap(find.text('Rainbow Foil'));
    await tester.pump();
    await tester.pump();
    expect(find.text('Low up \$1.00'), findsOneWidget);
    expect(find.text('Low up \$2.00'), findsNothing);
  });

  testWidgets('a Printing with <2 Lows shows empty, not the previous chart',
      (tester) async {
    await pumpDetails(
      tester,
      catalog: [card, foil],
      priceHistory: {
        card.id: chartable(),
        foil.id: [
          buildPricePoint(capturedOn: inWindow, tcgLow: 9.0),
        ],
      },
    );

    await tester.tap(find.text('Rainbow Foil'));
    await tester.pump();
    await tester.pump();
    expect(find.text('History not available yet'), findsOneWidget);
    expect(find.byType(LineChart), findsNothing);
  });

  testWidgets('CardMarket with only tcgLow is empty, not a silent TCG line',
      (tester) async {
    final container = await pumpApp(
      tester,
      CardDetailScreen(card: card),
      catalog: [card],
      priceHistory: {card.id: chartable()},
    );
    await tester.pump();
    await tester.pump();
    expect(find.byType(LineChart), findsOneWidget);

    container.read(settingsProvider.notifier).setSource(PriceSource.cardmarket);
    await tester.pump();

    expect(find.byType(LineChart), findsNothing);
    expect(
      find.text("History isn't available for CardMarket yet"),
      findsOneWidget,
    );
    expect(find.text('Prices'), findsOneWidget);
  });

  testWidgets('a gap day is omitted, never shown as \$0.00', (tester) async {
    await pumpDetails(
      tester,
      catalog: [card],
      priceHistory: {
        card.id: [
          buildPricePoint(capturedOn: inWindowEarlier, tcgLow: 2.0),
          buildPricePoint(capturedOn: today.subtract(const Duration(days: 10))),
          buildPricePoint(capturedOn: inWindow, tcgLow: 3.0),
        ],
      },
    );

    expect(find.byType(LineChart), findsOneWidget);
    expect(find.text('Low up \$1.00'), findsOneWidget);
    expect(find.text('\$0.00'), findsNothing);
  });
}
