import 'package:fabtrades/core/data/price_alert_repository.dart';
import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/models/price_alert.dart';
import 'package:mocktail/mocktail.dart';

/// An in-memory [PriceAlertRepository], so widget tests never reach Supabase.
class FakePriceAlertRepository extends Mock implements PriceAlertRepository {
  FakePriceAlertRepository([List<PriceAlert> seed = const []])
      : alerts = [...seed];

  final List<PriceAlert> alerts;
  final registeredTokens = <String>[];
  int _next = 0;

  @override
  Future<List<PriceAlert>> list() async => [...alerts];

  @override
  Future<PriceAlert> create({
    required String cardId,
    required PriceAlertDirection direction,
    required PriceSource source,
    required double targetPrice,
    double? currentPrice,
  }) async {
    final alert = PriceAlert(
      id: 'alert-${_next++}',
      cardId: cardId,
      direction: direction,
      source: source,
      targetPrice: targetPrice,
      priceAtCreation: currentPrice,
      createdAt: DateTime.utc(2026, 10, 19),
    );
    alerts.insert(0, alert);
    return alert;
  }

  @override
  Future<void> delete(String id) async => alerts.removeWhere((a) => a.id == id);

  @override
  Future<void> rearm(String id) async {
    final i = alerts.indexWhere((a) => a.id == id);
    if (i >= 0) alerts[i] = alerts[i].rearmed();
  }

  @override
  Future<void> registerPushToken(String token, String platform) async =>
      registeredTokens.add(token);
}
