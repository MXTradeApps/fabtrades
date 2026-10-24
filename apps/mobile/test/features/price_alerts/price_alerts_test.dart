import 'package:fabtrades/app/more_sheet.dart';
import 'package:fabtrades/core/models/account.dart';
import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/models/price_alert.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/card_detail/card_detail_screen.dart';
import 'package:fabtrades/features/price_alerts/price_alerts_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/fixtures.dart';
import '../../support/harness.dart';
import '../../support/price_alert_fake.dart';

const _account = Account(
  id: '9f1c0b62-0000-4000-8000-000000000001',
  email: 'bravo@example.com',
  displayName: 'Rhinar Hothead',
  provider: AuthProviderKind.discord,
);

final _card = buildCard(id: 'card-1', name: 'Command and Conquer', tcgMarket: 20);

PriceAlert _alert({
  String id = 'a1',
  PriceAlertDirection direction = PriceAlertDirection.above,
  double target = 25,
  DateTime? triggeredAt,
  double? triggeredPrice,
}) =>
    PriceAlert(
      id: id,
      cardId: 'card-1',
      direction: direction,
      source: PriceSource.tcgplayer,
      targetPrice: target,
      createdAt: DateTime.utc(2026, 10, 19),
      triggeredAt: triggeredAt,
      triggeredPrice: triggeredPrice,
    );

void main() {
  testWidgets('More lists Price Alerts with a count of fired alerts',
      (tester) async {
    await pumpApp(
      tester,
      const _Opener(),
      account: _account,
      priceAlerts: FakePriceAlertRepository([
        _alert(triggeredAt: DateTime.utc(2026, 10, 20), triggeredPrice: 26),
        _alert(id: 'a2', direction: PriceAlertDirection.below, target: 15),
      ]),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Open More'));
    await tester.pumpAndSettle();

    expect(find.text('Price Alerts'), findsOneWidget);
    expect(find.text('1'), findsOneWidget);

    await tester.tap(find.text('Price Alerts'));
    await tester.pumpAndSettle();
    expect(find.byType(PriceAlertsScreen), findsOneWidget);
  });

  testWidgets('the alerts list shows hit alerts above watching ones',
      (tester) async {
    await pumpApp(
      tester,
      const PriceAlertsScreen(),
      catalog: [_card],
      account: _account,
      priceAlerts: FakePriceAlertRepository([
        _alert(id: 'a2', direction: PriceAlertDirection.below, target: 15),
        _alert(triggeredAt: DateTime.utc(2026, 10, 20, 12), triggeredPrice: 26),
      ]),
    );
    await tester.pumpAndSettle();

    expect(find.text('Hit'), findsOneWidget);
    expect(find.text('Watching'), findsOneWidget);
    expect(find.text(r'Rises to $25.00'), findsOneWidget);
    expect(find.text(r'Hit Oct 20 at $26.00'), findsOneWidget);
    expect(find.text(r'Drops to $15.00'), findsOneWidget);
    expect(find.text(r'Now $20.00 · Watching'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text(r'Rises to $25.00')).dy,
      lessThan(tester.getTopLeft(find.text(r'Drops to $15.00')).dy),
    );
  });

  testWidgets('deleting from the list removes the alert', (tester) async {
    final repo = FakePriceAlertRepository([_alert()]);
    await pumpApp(
      tester,
      const PriceAlertsScreen(),
      catalog: [_card],
      account: _account,
      priceAlerts: repo,
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Alert options'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();

    expect(repo.alerts, isEmpty);
    expect(find.text('No price alerts yet'), findsOneWidget);
  });

  testWidgets('a hit alert can be watched again', (tester) async {
    final repo = FakePriceAlertRepository([
      _alert(triggeredAt: DateTime.utc(2026, 10, 20), triggeredPrice: 26),
    ]);
    await pumpApp(
      tester,
      const PriceAlertsScreen(),
      catalog: [_card],
      account: _account,
      priceAlerts: repo,
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Alert options'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Watch again'));
    await tester.pumpAndSettle();

    expect(repo.alerts.single.isTriggered, isFalse);
    expect(find.text('Hit'), findsNothing);
    expect(find.text(r'Now $20.00 · Watching'), findsOneWidget);
  });

  testWidgets('signed out, the list asks to sign in', (tester) async {
    await pumpApp(tester, const PriceAlertsScreen());
    await tester.pumpAndSettle();
    expect(find.text('Sign in for price alerts'), findsOneWidget);
  });

  testWidgets('a card page sets a rise alert from the suggested price',
      (tester) async {
    final repo = FakePriceAlertRepository();
    final container = await pumpApp(
      tester,
      CardDetailScreen(card: _card),
      catalog: [_card],
      account: _account,
      priceAlerts: repo,
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Notify me when the price moves'));
    await tester.tap(find.text('Notify me when the price moves'));
    await tester.pumpAndSettle();

    expect(find.text(r'Now $20.00 on TCGplayer'), findsOneWidget);
    expect(find.widgetWithText(TextField, '24.00'), findsOneWidget);

    await tester.tap(find.text('Set alert'));
    await tester.pumpAndSettle();

    expect(repo.alerts, hasLength(1));
    expect(repo.alerts.single.targetPrice, 24.0);
    expect(repo.alerts.single.direction, PriceAlertDirection.above);
    expect(repo.alerts.single.priceAtCreation, 20.0);
    expect(container.read(priceAlertsProvider).value, hasLength(1));
    expect(find.text(r'Rises to $24.00'), findsOneWidget);
  });

  testWidgets('a drop alert above the current price is refused',
      (tester) async {
    final repo = FakePriceAlertRepository();
    await pumpApp(
      tester,
      CardDetailScreen(card: _card),
      catalog: [_card],
      account: _account,
      priceAlerts: repo,
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Notify me when the price moves'));
    await tester.tap(find.text('Notify me when the price moves'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Drops to'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, '16.00'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '22');
    await tester.tap(find.text('Set alert'));
    await tester.pumpAndSettle();

    expect(find.text(r'Pick a price below $20.00'), findsOneWidget);
    expect(repo.alerts, isEmpty);
  });
}

class _Opener extends StatelessWidget {
  const _Opener();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Builder(
          builder: (context) => TextButton(
            onPressed: () => showMoreSheet(context),
            child: const Text('Open More'),
          ),
        ),
      ),
    );
  }
}
