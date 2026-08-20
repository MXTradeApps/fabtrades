import '../models/app_settings.dart';
import '../models/binder_entry.dart';

/// Observed catalog field vs missing. Numeric `0` is unpriced, never a summand.
bool isPricedField(double? value) =>
    value != null && value != 0 && !value.isNaN;

double? _firstPriced(Iterable<double?> values) {
  for (final value in values) {
    if (isPricedField(value)) return value;
  }
  return null;
}

/// How [BinderValueSnapshot.topPrintings] pick a per-copy value.
enum BinderValueHeadline {
  /// Mobile chip: [PriceSource] fallbacks (`Pricing.value` with 0 treated as
  /// unpriced).
  pricingValue,

  /// Web Binder header: TCGplayer Market only, no Low/Mid/High fallback.
  tcgMarketOnly,
}

class MoneyTotal {
  const MoneyTotal({
    required this.amount,
    required this.pricedCopies,
    required this.unpricedCopies,
  });

  /// `null` when [pricedCopies] is 0 — display as unpriced, never `$0.00`.
  final double? amount;
  final int pricedCopies;
  final int unpricedCopies;
}

class BinderValueTopPrinting {
  const BinderValueTopPrinting({
    required this.printingId,
    required this.name,
    required this.finish,
    required this.quantity,
    required this.contribution,
  });

  final String printingId;
  final String name;
  final String finish;
  final int quantity;
  final double contribution;
}

/// Quantity-weighted Binder totals for the value overlay. Input must be Binder
/// rows only (not Want List).
class BinderValueSnapshot {
  const BinderValueSnapshot({
    required this.copies,
    required this.distinctPrintings,
    required this.foilCopies,
    required this.regularCopies,
    required this.tcgMarket,
    required this.tcgLow,
    required this.cmTrend,
    required this.cmLow,
    required this.tcgUnpricedCopies,
    required this.cmUnpricedCopies,
    required this.topPrintings,
  });

  final int copies;
  final int distinctPrintings;
  final int foilCopies;
  final int regularCopies;
  final MoneyTotal tcgMarket;
  final MoneyTotal tcgLow;
  final MoneyTotal cmTrend;
  final MoneyTotal cmLow;
  final int tcgUnpricedCopies;
  final int cmUnpricedCopies;
  final List<BinderValueTopPrinting> topPrintings;
}

/// One Printing's observed fields for the snapshot. Contract tests build this
/// from JSON; the Binder screen maps [BinderEntry] through [fromBinderEntry].
class BinderValueRow {
  const BinderValueRow({
    required this.printingId,
    required this.name,
    required this.finish,
    required this.isFoil,
    required this.quantity,
    this.tcgMarket,
    this.tcgLow,
    this.tcgMid,
    this.tcgHigh,
    this.cmTrend,
    this.cmLow,
    this.cmAvg,
    this.cmTrendFoil,
    this.cmLowFoil,
    this.cmAvgFoil,
  });

  final String printingId;
  final String name;
  final String finish;
  final bool isFoil;
  final int quantity;
  final double? tcgMarket;
  final double? tcgLow;
  final double? tcgMid;
  final double? tcgHigh;
  final double? cmTrend;
  final double? cmLow;
  final double? cmAvg;
  final double? cmTrendFoil;
  final double? cmLowFoil;
  final double? cmAvgFoil;

  factory BinderValueRow.fromBinderEntry(BinderEntry entry) {
    final card = entry.card;
    return BinderValueRow(
      printingId: card.id,
      name: card.name,
      finish: card.subTypeName ?? (card.isFoil ? 'Foil' : 'Normal'),
      isFoil: card.isFoil,
      quantity: entry.quantity,
      tcgMarket: card.tcgMarket,
      tcgLow: card.tcgLow,
      tcgMid: card.tcgMid,
      tcgHigh: card.tcgHigh,
      cmTrend: card.cmTrend,
      cmLow: card.cmLow,
      cmAvg: card.cmAvg,
      cmTrendFoil: card.cmTrendFoil,
      cmLowFoil: card.cmLowFoil,
      cmAvgFoil: card.cmAvgFoil,
    );
  }

  factory BinderValueRow.fromJson(Map<String, dynamic> json) {
    double? n(String key) {
      final v = json[key];
      if (v == null) return null;
      return (v as num).toDouble();
    }

    return BinderValueRow(
      printingId: json['printingId'] as String,
      name: json['name'] as String,
      finish: json['finish'] as String,
      isFoil: json['isFoil'] as bool? ?? false,
      quantity: (json['quantity'] as num).toInt(),
      tcgMarket: n('tcgMarket'),
      tcgLow: n('tcgLow'),
      tcgMid: n('tcgMid'),
      tcgHigh: n('tcgHigh'),
      cmTrend: n('cmTrend'),
      cmLow: n('cmLow'),
      cmAvg: n('cmAvg'),
      cmTrendFoil: n('cmTrendFoil'),
      cmLowFoil: n('cmLowFoil'),
      cmAvgFoil: n('cmAvgFoil'),
    );
  }

  double? get foilAwareTrend =>
      isFoil ? _firstPriced([cmTrendFoil, cmTrend]) : _firstPriced([cmTrend]);

  double? get foilAwareLow =>
      isFoil ? _firstPriced([cmLowFoil, cmLow]) : _firstPriced([cmLow]);

  double? sourceValue(PriceSource source, BinderValueHeadline headline) {
    if (headline == BinderValueHeadline.tcgMarketOnly) {
      return _firstPriced([tcgMarket]);
    }
    switch (source) {
      case PriceSource.tcgplayer:
        return _firstPriced([tcgMarket, tcgLow, tcgMid, tcgHigh]);
      case PriceSource.cardmarket:
        if (isFoil) {
          return _firstPriced([cmTrendFoil, cmTrend, cmAvg, cmLow]);
        }
        return _firstPriced([cmTrend, cmAvg, cmLow]);
    }
  }
}

MoneyTotal _sumField(List<BinderValueRow> rows, double? Function(BinderValueRow) field) {
  var amount = 0.0;
  var pricedCopies = 0;
  var unpricedCopies = 0;
  var anyPriced = false;
  for (final row in rows) {
    final value = field(row);
    if (isPricedField(value)) {
      amount += value! * row.quantity;
      pricedCopies += row.quantity;
      anyPriced = true;
    } else {
      unpricedCopies += row.quantity;
    }
  }
  return MoneyTotal(
    amount: anyPriced ? amount : null,
    pricedCopies: pricedCopies,
    unpricedCopies: unpricedCopies,
  );
}

/// Builds overlay totals from Binder rows. Drops quantity &lt; 1.
BinderValueSnapshot buildBinderValueSnapshot(
  Iterable<BinderValueRow> entries, {
  PriceSource source = PriceSource.tcgplayer,
  BinderValueHeadline headline = BinderValueHeadline.pricingValue,
}) {
  final rows = [
    for (final row in entries)
      if (row.quantity >= 1) row,
  ];

  var copies = 0;
  var foilCopies = 0;
  var tcgUnpricedCopies = 0;
  var cmUnpricedCopies = 0;
  for (final row in rows) {
    copies += row.quantity;
    if (row.isFoil) foilCopies += row.quantity;
    final tcgPriced =
        isPricedField(row.tcgMarket) || isPricedField(row.tcgLow);
    if (!tcgPriced) tcgUnpricedCopies += row.quantity;
    if (!isPricedField(row.foilAwareTrend) && !isPricedField(row.foilAwareLow)) {
      cmUnpricedCopies += row.quantity;
    }
  }

  final ranked = <BinderValueTopPrinting>[];
  for (final row in rows) {
    final value = row.sourceValue(source, headline);
    if (!isPricedField(value)) continue;
    ranked.add(BinderValueTopPrinting(
      printingId: row.printingId,
      name: row.name,
      finish: row.finish,
      quantity: row.quantity,
      contribution: value! * row.quantity,
    ));
  }
  ranked.sort((a, b) {
    final byContrib = b.contribution.compareTo(a.contribution);
    if (byContrib != 0) return byContrib;
    final byName = a.name.compareTo(b.name);
    if (byName != 0) return byName;
    return a.printingId.compareTo(b.printingId);
  });

  return BinderValueSnapshot(
    copies: copies,
    distinctPrintings: rows.length,
    foilCopies: foilCopies,
    regularCopies: copies - foilCopies,
    tcgMarket: _sumField(rows, (r) => r.tcgMarket),
    tcgLow: _sumField(rows, (r) => r.tcgLow),
    cmTrend: _sumField(rows, (r) => r.foilAwareTrend),
    cmLow: _sumField(rows, (r) => r.foilAwareLow),
    tcgUnpricedCopies: tcgUnpricedCopies,
    cmUnpricedCopies: cmUnpricedCopies,
    topPrintings: ranked.take(5).toList(growable: false),
  );
}

BinderValueSnapshot snapshotForBinder(
  Iterable<BinderEntry> entries, {
  required PriceSource source,
  BinderValueHeadline headline = BinderValueHeadline.pricingValue,
}) {
  return buildBinderValueSnapshot(
    [
      for (final entry in entries)
        if (!entry.isWanted) BinderValueRow.fromBinderEntry(entry),
    ],
    source: source,
    headline: headline,
  );
}
