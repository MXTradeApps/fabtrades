import '../models/app_settings.dart';
import 'binder_value_snapshot.dart';

/// Picked cover Printing for a Binder tile. [printingId] is null when empty.
class BinderCover {
  const BinderCover({this.printingId, this.condition});

  final String? printingId;
  final String? condition;

  bool get isEmpty => printingId == null;
}

/// Cover pick for one Binder's owned rows. Same `source` / `headline` split as
/// [buildBinderValueSnapshot]. Empty → none; max `qty × sourceValue`; ties
/// name A–Z then printing id then condition; all-unpriced still picks by name.
BinderCover pickBinderCover(
  Iterable<BinderValueRow> entries, {
  PriceSource source = PriceSource.tcgplayer,
  BinderValueHeadline headline = BinderValueHeadline.pricingValue,
}) {
  final rows = [
    for (final row in entries)
      if (row.quantity >= 1) row,
  ];
  if (rows.isEmpty) return const BinderCover();

  int byNameIdCondition(BinderValueRow a, BinderValueRow b) {
    final byName = a.name.compareTo(b.name);
    if (byName != 0) return byName;
    final byId = a.printingId.compareTo(b.printingId);
    if (byId != 0) return byId;
    return a.condition.compareTo(b.condition);
  }

  BinderCover coverOf(BinderValueRow row) => BinderCover(
        printingId: row.printingId,
        condition: row.condition.isEmpty ? null : row.condition,
      );

  final priced = <({BinderValueRow row, double contribution})>[];
  for (final row in rows) {
    final value = row.sourceValue(source, headline);
    if (!isPricedField(value)) continue;
    priced.add((row: row, contribution: value! * row.quantity));
  }
  if (priced.isEmpty) {
    final ranked = [...rows]..sort(byNameIdCondition);
    return coverOf(ranked.first);
  }

  priced.sort((a, b) {
    final byContrib = b.contribution.compareTo(a.contribution);
    if (byContrib != 0) return byContrib;
    return byNameIdCondition(a.row, b.row);
  });
  return coverOf(priced.first.row);
}
