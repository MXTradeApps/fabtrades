import '../models/binder_entry.dart';
import '../models/binder.dart';
import '../models/card_model.dart';
import '../models/trade.dart';
import 'pricing.dart';

/// A candidate filler card together with how far its price sits from the gap.
class FillerMatch {
  const FillerMatch({
    required this.card,
    required this.price,
    required this.gapDistance,
  });

  final CardModel card;
  final double price;

  /// Absolute distance between this card's price and the value gap to fill.
  final double gapDistance;
}

/// Partitioned filler suggestions: binder/want boosts first, then the rest
/// of the catalog. Boost never filters — sparse binders still see full results.
class FillerPartition {
  const FillerPartition({
    required this.boosted,
    required this.catalog,
  });

  final List<FillerMatch> boosted;
  final List<FillerMatch> catalog;
}

/// Builds filler suggestions near [target], boosting cards from [boostEntries]
/// (binder when filling my side, want list when filling theirs) to the top.
FillerPartition partitionFillerMatches({
  required List<CardModel> catalog,
  required Pricing pricing,
  required double target,
  required TradeSide fillSide,
  required List<BinderEntry> binderEntries,
  int maxResults = 60,
  String tradeBinderId = BinderIds.trade,
}) {
  final boostWanted = fillSide == TradeSide.want;
  final boostIds = <String>{
    for (final e in binderEntries)
      if (e.quantity > 0 &&
          (boostWanted
              ? e.isWanted
              : (!e.isWanted && e.resolvedBinderId == tradeBinderId)))
        e.card.id,
  };

  final boosted = <FillerMatch>[];
  final rest = <FillerMatch>[];

  for (final card in catalog) {
    final price = pricing.value(card);
    if (price == null || price <= 0) continue;
    final match = FillerMatch(
      card: card,
      price: price,
      gapDistance: (price - target).abs(),
    );
    if (boostIds.contains(card.id)) {
      boosted.add(match);
    } else {
      rest.add(match);
    }
  }

  int byDistance(FillerMatch a, FillerMatch b) =>
      a.gapDistance.compareTo(b.gapDistance);
  boosted.sort(byDistance);
  rest.sort(byDistance);

  // Cap total results; keep all boosted that fit, then fill from catalog.
  final boostedTake = boosted.take(maxResults).toList();
  final remaining = maxResults - boostedTake.length;
  final catalogTake = rest.take(remaining).toList();

  return FillerPartition(boosted: boostedTake, catalog: catalogTake);
}
