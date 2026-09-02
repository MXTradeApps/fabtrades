import '../models/binder_entry.dart';

/// Observed start Low vs latest catalog Low for one Printing, plus the derived
/// percent and amount. Ranking uses [percentChange], never the currency amount.
class RecentLowChange {
  const RecentLowChange({
    required this.cardId,
    required this.startOn,
    required this.startLow,
    required this.latestLow,
    required this.percentChange,
    required this.amountChange,
  });

  final String cardId;

  /// Catalog calendar date (`YYYY-MM-DD`) of the start snapshot.
  final String startOn;

  /// Observed marketplace Low on [startOn]. Never invented.
  final double startLow;

  /// Observed current catalog Low. Never invented.
  final double latestLow;

  /// `(latestLow - startLow) / startLow`.
  final double percentChange;

  /// `latestLow - startLow`.
  final double amountChange;

  Map<String, dynamic> toJson() => {
        'card_id': cardId,
        'start_on': startOn,
        'start_low': startLow,
        'latest_low': latestLow,
        'percent_change': percentChange,
        'amount_change': amountChange,
      };

  factory RecentLowChange.fromMap(Map<String, dynamic> map) {
    double requireLow(String key) {
      final value = map[key];
      if (value is num) return value.toDouble();
      throw FormatException('Recent change $key must be a number, got $value');
    }

    return RecentLowChange(
      cardId: map['card_id'] as String,
      startOn: (map['start_on'] as Object).toString(),
      startLow: requireLow('start_low'),
      latestLow: requireLow('latest_low'),
      percentChange: requireLow('percent_change'),
      amountChange: requireLow('amount_change'),
    );
  }
}

/// One row from `fab_recent_movers`. Identity fields come from the catalog
/// join; Low fields are observed snapshots, not interpolated.
class RecentMoverRow {
  const RecentMoverRow({
    required this.direction,
    required this.rank,
    required this.cardId,
    required this.name,
    required this.setName,
    required this.finish,
    this.imageUrl,
    required this.startLow,
    required this.startOn,
    required this.latestLow,
    required this.percentChange,
    required this.amountChange,
  });

  final String direction;
  final int rank;
  final String cardId;
  final String name;
  final String setName;
  final String finish;
  final String? imageUrl;
  final double startLow;
  final String startOn;
  final double latestLow;
  final double percentChange;
  final double amountChange;

  bool get isGainer => direction == 'gainer';

  factory RecentMoverRow.fromMap(Map<String, dynamic> map) {
    double requireLow(String key) {
      final value = map[key];
      if (value is num) return value.toDouble();
      throw FormatException('Recent mover $key must be a number, got $value');
    }

    final direction = map['direction'] as String? ?? '';
    if (direction != 'gainer' && direction != 'loser') {
      throw FormatException('Recent mover direction must be gainer or loser');
    }

    return RecentMoverRow(
      direction: direction,
      rank: (map['rank'] as num).toInt(),
      cardId: map['card_id'] as String,
      name: map['name'] as String? ?? '',
      setName: map['set_name'] as String? ?? '',
      finish: map['finish'] as String? ?? '',
      imageUrl: map['image_url'] as String?,
      startLow: requireLow('start_low'),
      startOn: (map['start_on'] as Object).toString(),
      latestLow: requireLow('latest_low'),
      percentChange: requireLow('percent_change'),
      amountChange: requireLow('amount_change'),
    );
  }
}

void _assertSource(String source) {
  switch (source) {
    case 'tcgplayer':
    case 'cardmarket':
      return;
    default:
      throw ArgumentError.value(
        source,
        'source',
        'must be tcgplayer or cardmarket',
      );
  }
}

double? _lowForSource(String source, Map<String, dynamic> row) {
  _assertSource(source);
  switch (source) {
    case 'tcgplayer':
      return _asDouble(row['tcg_low']);
    case 'cardmarket':
      return _asDouble(row['cm_low']);
    default:
      throw ArgumentError.value(
        source,
        'source',
        'must be tcgplayer or cardmarket',
      );
  }
}

double? _asDouble(Object? value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return null;
}

const double _startLowFloor = 1;
const double _maxObservedLow = 10000;
const double _maxAbsPercentChange = 10;

DateTime _parseDate(String ymd) {
  final parts = ymd.split('-');
  return DateTime(
    int.parse(parts[0]),
    int.parse(parts[1]),
    int.parse(parts[2]),
  );
}

String _formatDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// Inclusive start-Low window: `[today - 5 days, today - 3 days]`.
({String from, String to}) startLowWindow(String today) {
  final date = _parseDate(today);
  return (
    from: _formatDate(date.subtract(const Duration(days: 5))),
    to: _formatDate(date.subtract(const Duration(days: 3))),
  );
}

/// Observed start Low vs latest Low for one Printing. No floor, no sealed
/// filter, no rank cut — those belong to [rankRecentMovers] only.
RecentLowChange? observedPrintingRecentChange({
  required String today,
  required String source,
  required List<Map<String, dynamic>> snapshots,
  required Map<String, dynamic>? current,
  required String cardId,
}) {
  if (current == null) return null;
  final latestLow = _lowForSource(source, current);
  if (latestLow == null) return null;

  final window = startLowWindow(today);
  String? startOn;
  double? startLow;
  for (final snap in snapshots) {
    final capturedOn = snap['captured_on'] as String?;
    if (capturedOn == null) continue;
    if (capturedOn.compareTo(window.from) < 0) continue;
    if (capturedOn.compareTo(window.to) > 0) continue;
    final low = _lowForSource(source, snap);
    if (low == null) continue;
    if (startOn == null || capturedOn.compareTo(startOn) > 0) {
      startOn = capturedOn;
      startLow = low;
    }
  }
  if (startOn == null || startLow == null) return null;
  if (startLow > _maxObservedLow || latestLow > _maxObservedLow) return null;
  if (latestLow == startLow) return null;

  final amountChange = latestLow - startLow;
  final percentChange = amountChange / startLow;
  if (percentChange.abs() > _maxAbsPercentChange) return null;
  return RecentLowChange(
    cardId: cardId,
    startOn: startOn,
    startLow: startLow,
    latestLow: latestLow,
    percentChange: percentChange,
    amountChange: amountChange,
  );
}

/// Rank eligible Printings by percent change of observed Low.
///
/// [snapshotsByCard] maps Printing id → history rows (`captured_on`, `tcg_low`,
/// `cm_low`). [currentLows] maps Printing id → `{tcg_low, cm_low, is_sealed}`.
/// Null Lows are omitted, never treated as zero.
({List<RecentLowChange> gainers, List<RecentLowChange> losers}) rankRecentMovers({
  required String today,
  required String source,
  required Map<String, List<Map<String, dynamic>>> snapshotsByCard,
  required Map<String, Map<String, dynamic>> currentLows,
}) {
  _assertSource(source);
  final eligible = <RecentLowChange>[];

  currentLows.forEach((cardId, current) {
    if (current['is_sealed'] == true) return;
    final change = observedPrintingRecentChange(
      today: today,
      source: source,
      snapshots: snapshotsByCard[cardId] ?? const <Map<String, dynamic>>[],
      current: current,
      cardId: cardId,
    );
    if (change == null) return;
    if (change.startLow < _startLowFloor) return;
    eligible.add(change);
  });

  int byCardId(RecentLowChange a, RecentLowChange b) =>
      a.cardId.compareTo(b.cardId);

  final gainers = eligible.where((r) => r.percentChange > 0).toList()
    ..sort((a, b) {
      final byPercent = b.percentChange.compareTo(a.percentChange);
      return byPercent != 0 ? byPercent : byCardId(a, b);
    });
  final losers = eligible.where((r) => r.percentChange < 0).toList()
    ..sort((a, b) {
      final byPercent = a.percentChange.compareTo(b.percentChange);
      return byPercent != 0 ? byPercent : byCardId(a, b);
    });

  return (
    gainers: gainers.take(10).toList(),
    losers: losers.take(10).toList(),
  );
}

/// Displayable recent Low change for requested Printing ids. No floor, no
/// top-10, no sealed extra-filter. Ids not in [cardIds] are ignored.
List<RecentLowChange> lookupPrintingRecentChanges({
  required String today,
  required String source,
  required Map<String, List<Map<String, dynamic>>> snapshotsByCard,
  required Map<String, Map<String, dynamic>> currentLows,
  required List<String> cardIds,
}) {
  _assertSource(source);
  final seen = <String>{};
  final overlays = <RecentLowChange>[];
  for (final cardId in cardIds) {
    if (!seen.add(cardId)) continue;
    final change = observedPrintingRecentChange(
      today: today,
      source: source,
      snapshots: snapshotsByCard[cardId] ?? const <Map<String, dynamic>>[],
      current: currentLows[cardId],
      cardId: cardId,
    );
    if (change != null) overlays.add(change);
  }
  return overlays;
}

String? _printingId(Object entry) {
  if (entry is BinderEntry) return entry.card.id;
  if (entry is Map) {
    final cardId = entry['cardId'] ?? entry['card_id'];
    if (cardId is String && cardId.isNotEmpty) return cardId;
    final card = entry['card'];
    if (card is Map && card['id'] is String) return card['id'] as String;
  }
  return null;
}

bool _isWanted(Object entry) {
  if (entry is BinderEntry) return entry.isWanted;
  if (entry is Map) return entry['isWanted'] == true || entry['is_wanted'] == true;
  return false;
}

int _quantity(Object entry) {
  if (entry is BinderEntry) return entry.quantity;
  if (entry is Map) {
    final qty = entry['quantity'];
    if (qty is num) return qty.toInt();
  }
  return 0;
}

bool _isTombstoned(Object entry) {
  if (entry is Map) {
    final deleted = entry['deletedAt'] ?? entry['deleted_at'];
    return deleted != null && deleted.toString().isNotEmpty;
  }
  return false;
}

/// Sums quantity per Printing id for a **pre-filtered** Binder list.
/// Display only — not a rank key and not sent to SQL.
///
/// Callers MUST filter to the open Binder first. Do not change
/// [ownedPrintingIds] to take a binder id.
Map<String, int> copiesByPrintingId(Iterable<Object> entries) {
  final copies = <String, int>{};
  for (final entry in entries) {
    if (_isWanted(entry) || _isTombstoned(entry)) continue;
    final qty = _quantity(entry);
    if (qty <= 0) continue;
    final id = _printingId(entry);
    if (id == null) continue;
    copies[id] = (copies[id] ?? 0) + qty;
  }
  return copies;
}

/// Distinct owned Printing ids: qty > 0 in any Binder, not Want List, not
/// tombstoned. Same Printing in two Binders or two conditions is one id.
List<String> ownedPrintingIds(Iterable<Object> entries) {
  final ids = <String>{};
  for (final entry in entries) {
    if (_isWanted(entry) || _isTombstoned(entry) || _quantity(entry) <= 0) {
      continue;
    }
    final id = _printingId(entry);
    if (id != null) ids.add(id);
  }
  return ids.toList();
}
