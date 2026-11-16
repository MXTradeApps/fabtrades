// Options and rows for the Trending screen (`fab_trending_movers`), the same
// function the web Trending page calls.

/// Time windows offered on Trending, in days. 2 is for overnight spikes.
const trendingDayOptions = <int>[2, 7, 30];

/// Price floors offered on Trending, in the marketplace currency. 0 is any.
const trendingFloorOptions = <int>[0, 2, 10, 50];

/// What the two lists are ranked by.
enum TrendingSort {
  percent('percent'),
  amount('amount');

  const TrendingSort(this.param);

  /// Value sent as `p_sort`.
  final String param;
}

/// The controls on the Trending screen. Defaults match the web page.
class TrendingOptions {
  const TrendingOptions({
    this.days = 7,
    this.sort = TrendingSort.percent,
    this.minPrice = 0,
  });

  final int days;
  final TrendingSort sort;
  final int minPrice;

  TrendingOptions copyWith({int? days, TrendingSort? sort, int? minPrice}) =>
      TrendingOptions(
        days: days ?? this.days,
        sort: sort ?? this.sort,
        minPrice: minPrice ?? this.minPrice,
      );

  @override
  bool operator ==(Object other) =>
      other is TrendingOptions &&
      other.days == days &&
      other.sort == sort &&
      other.minPrice == minPrice;

  @override
  int get hashCode => Object.hash(days, sort, minPrice);

  @override
  String toString() => 'TrendingOptions($days days, ${sort.param}, $minPrice+)';
}

/// "this week" for 7 days, otherwise "in the last N days".
String trendingWindowLabel(int days) =>
    days == 7 ? 'this week' : 'in the last $days days';

/// One row from `fab_trending_movers`. Risers are measured on the catalog Low,
/// fallers on Market (CardMarket: Trend); [priceKind] says which.
class TrendingMoverRow {
  const TrendingMoverRow({
    required this.direction,
    required this.rank,
    required this.directionTotal,
    required this.priceKind,
    required this.cardId,
    required this.name,
    required this.setName,
    required this.finish,
    this.imageUrl,
    required this.startPrice,
    required this.startOn,
    required this.latestPrice,
    required this.percentChange,
    required this.amountChange,
  });

  final String direction;
  final int rank;

  /// How many cards moved in this direction before the top-N cut.
  final int directionTotal;

  /// `low` or `market`.
  final String priceKind;
  final String cardId;
  final String name;
  final String setName;
  final String finish;
  final String? imageUrl;
  final double startPrice;
  final String startOn;
  final double latestPrice;
  final double percentChange;
  final double amountChange;

  bool get isGainer => direction == 'gainer';

  factory TrendingMoverRow.fromMap(Map<String, dynamic> map) {
    double requireNumber(String key) {
      final value = map[key];
      if (value is num) return value.toDouble();
      throw FormatException('Trending mover $key must be a number, got $value');
    }

    final direction = map['direction'] as String? ?? '';
    if (direction != 'gainer' && direction != 'loser') {
      throw const FormatException(
        'Trending mover direction must be gainer or loser',
      );
    }

    final rank = (map['rank'] as num).toInt();
    return TrendingMoverRow(
      direction: direction,
      rank: rank,
      directionTotal: (map['direction_total'] as num?)?.toInt() ?? rank,
      priceKind: map['price_kind'] as String? ?? 'low',
      cardId: map['card_id'] as String,
      name: map['name'] as String? ?? '',
      setName: map['set_name'] as String? ?? '',
      finish: map['finish'] as String? ?? '',
      imageUrl: map['image_url'] as String?,
      startPrice: requireNumber('start_price'),
      startOn: (map['start_on'] as Object).toString(),
      latestPrice: requireNumber('latest_price'),
      percentChange: requireNumber('percent_change'),
      amountChange: requireNumber('amount_change'),
    );
  }
}
