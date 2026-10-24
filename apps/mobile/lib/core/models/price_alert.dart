import 'app_settings.dart';

/// Which way the price has to move for an alert to fire.
enum PriceAlertDirection {
  /// Fires when the price is at or above the target.
  above('above', 'Rises to'),

  /// Fires when the price is at or below the target.
  below('below', 'Drops to');

  const PriceAlertDirection(this.id, this.label);

  /// Value stored in `fab_price_alerts.direction`.
  final String id;
  final String label;

  static PriceAlertDirection fromId(String? id) =>
      id == 'below' ? PriceAlertDirection.below : PriceAlertDirection.above;
}

/// One row of `fab_price_alerts`: "tell me when this printing rises to / drops
/// to a price". Fired server-side after the daily price ingest; the app only
/// creates, lists, deletes and re-arms them.
class PriceAlert {
  const PriceAlert({
    required this.id,
    required this.cardId,
    required this.direction,
    required this.source,
    required this.targetPrice,
    required this.createdAt,
    this.priceAtCreation,
    this.triggeredAt,
    this.triggeredPrice,
  });

  final String id;
  final String cardId;
  final PriceAlertDirection direction;

  /// The marketplace (and so currency) [targetPrice] is in. Fixed when the
  /// alert is set, so changing the price source setting later does not
  /// silently compare dollars to euros.
  final PriceSource source;
  final double targetPrice;
  final double? priceAtCreation;
  final DateTime createdAt;
  final DateTime? triggeredAt;
  final double? triggeredPrice;

  bool get isTriggered => triggeredAt != null;

  /// Whether [price] satisfies this alert — the same rule as the server's
  /// `fab_fire_price_alerts`, used to reject a target that would fire at once.
  bool firesAt(double price) => direction == PriceAlertDirection.above
      ? price >= targetPrice
      : price <= targetPrice;

  factory PriceAlert.fromRow(Map<String, dynamic> row) {
    double? num_(Object? v) => v == null ? null : (v as num).toDouble();
    DateTime? date(Object? v) =>
        v == null ? null : DateTime.parse(v as String);
    return PriceAlert(
      id: row['id'] as String,
      cardId: row['card_id'] as String,
      direction: PriceAlertDirection.fromId(row['direction'] as String?),
      source: row['source'] == 'cardmarket'
          ? PriceSource.cardmarket
          : PriceSource.tcgplayer,
      targetPrice: num_(row['target_price'])!,
      priceAtCreation: num_(row['price_at_creation']),
      createdAt: date(row['created_at']) ?? DateTime.now(),
      triggeredAt: date(row['triggered_at']),
      triggeredPrice: num_(row['triggered_price']),
    );
  }

  PriceAlert rearmed() => PriceAlert(
        id: id,
        cardId: cardId,
        direction: direction,
        source: source,
        targetPrice: targetPrice,
        priceAtCreation: priceAtCreation,
        createdAt: createdAt,
      );
}
