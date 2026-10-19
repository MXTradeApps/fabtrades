import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/models/price_alert.dart';
import 'package:fabtrades/features/price_alerts/price_alert_sheet.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PriceAlert.fromRow', () {
    test('reads a fired CardMarket drop alert', () {
      final alert = PriceAlert.fromRow({
        'id': 'a1',
        'card_id': 'card-1',
        'direction': 'below',
        'source': 'cardmarket',
        'target_price': 4,
        'price_at_creation': 5.5,
        'created_at': '2026-10-19T21:00:00Z',
        'triggered_at': '2026-10-20T06:05:00Z',
        'triggered_price': 3.9,
      });
      expect(alert.direction, PriceAlertDirection.below);
      expect(alert.source, PriceSource.cardmarket);
      expect(alert.targetPrice, 4.0);
      expect(alert.isTriggered, isTrue);
      expect(alert.triggeredPrice, 3.9);
    });

    test('an armed alert has no fired state', () {
      final alert = PriceAlert.fromRow({
        'id': 'a1',
        'card_id': 'card-1',
        'direction': 'above',
        'source': 'tcgplayer',
        'target_price': 12.5,
        'created_at': '2026-10-19T21:00:00Z',
      });
      expect(alert.isTriggered, isFalse);
      expect(alert.direction, PriceAlertDirection.above);
      expect(alert.source, PriceSource.tcgplayer);
    });
  });

  test('firesAt matches the server rule, inclusive of the target', () {
    PriceAlert alert(PriceAlertDirection d) => PriceAlert(
          id: 'a',
          cardId: 'c',
          direction: d,
          source: PriceSource.tcgplayer,
          targetPrice: 10,
          createdAt: DateTime.utc(2026),
        );
    final rise = alert(PriceAlertDirection.above);
    expect(rise.firesAt(9.99), isFalse);
    expect(rise.firesAt(10), isTrue);
    final drop = alert(PriceAlertDirection.below);
    expect(drop.firesAt(10), isTrue);
    expect(drop.firesAt(10.01), isFalse);
  });

  group('parsePriceInput', () {
    test('accepts plain, symbol and decimal-comma input', () {
      expect(parsePriceInput('12'), 12.0);
      expect(parsePriceInput(r'$12.50'), 12.5);
      expect(parsePriceInput('12,5'), 12.5);
      expect(parsePriceInput('1,250.00'), 1250.0);
      expect(parsePriceInput('3.456'), 3.46);
    });

    test('rejects empty and zero', () {
      expect(parsePriceInput(''), isNull);
      expect(parsePriceInput('0'), isNull);
      expect(parsePriceInput('abc'), isNull);
    });
  });

  test('suggestedTarget starts 20% away from the current price', () {
    expect(suggestedTarget(10, PriceAlertDirection.above), 12.0);
    expect(suggestedTarget(10, PriceAlertDirection.below), 8.0);
    expect(suggestedTarget(0.33, PriceAlertDirection.above), 0.4);
  });
}
