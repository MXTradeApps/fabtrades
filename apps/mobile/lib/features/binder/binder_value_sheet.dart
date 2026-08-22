import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/logic/binder_value_snapshot.dart';
import '../../core/logic/pricing.dart';
import '../../core/models/app_settings.dart';
import '../../core/models/binder.dart';
import '../../core/providers.dart';

/// Overlay inspect of the Binder total. Reads live Binder + Settings so qty
/// changes while open refresh the numbers without a network fetch.
Future<void> showBinderValueSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    routeSettings: const RouteSettings(name: 'Binder Value'),
    builder: (_) => const BinderValueSheet(),
  );
}

class BinderValueSheet extends ConsumerWidget {
  const BinderValueSheet({super.key});

  static const usd = Pricing(AppSettings(source: PriceSource.tcgplayer));
  static const eur = Pricing(AppSettings(source: PriceSource.cardmarket));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final pricing = ref.watch(pricingProvider);
    final settings = ref.watch(settingsProvider);
    final binder = ref
        .watch(binderProvider)
        .where((e) =>
            !e.isWanted &&
            e.resolvedBinderId ==
                (ref.watch(openBinderIdProvider) ?? BinderIds.trade))
        .toList(growable: false);

    final headlineTotal = binder.fold<double>(
      0,
      (sum, e) => sum + (pricing.value(e.card) ?? 0) * e.quantity,
    );
    final snapshot = snapshotForBinder(
      binder,
      source: settings.source,
      headline: BinderValueHeadline.pricingValue,
    );

    final maxHeight = MediaQuery.sizeOf(context).height * 0.88;

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          children: [
            Text(
              'Binder value',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              settings.source.label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              pricing.formatValue(headlineTotal),
              key: const Key('binderValueHeadline'),
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: AppTheme.positive,
              ),
            ),
            const SizedBox(height: 20),
            _MarketplaceGroup(
              title: 'TCGplayer (USD)',
              rows: [
                _PriceLine('Market', usd.format(snapshot.tcgMarket.amount),
                    snapshot.tcgMarket.unpricedCopies),
                _PriceLine('Low', usd.format(snapshot.tcgLow.amount),
                    snapshot.tcgLow.unpricedCopies),
              ],
            ),
            const SizedBox(height: 16),
            _MarketplaceGroup(
              title: 'CardMarket (EUR)',
              rows: [
                _PriceLine('Trend', eur.format(snapshot.cmTrend.amount),
                    snapshot.cmTrend.unpricedCopies),
                _PriceLine('Low', eur.format(snapshot.cmLow.amount),
                    snapshot.cmLow.unpricedCopies),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              'Stock',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${snapshot.copies} copies · ${snapshot.distinctPrintings} Printings',
              style: theme.textTheme.bodyMedium,
            ),
            Text(
              '${snapshot.foilCopies} foil · ${snapshot.regularCopies} Regular',
              style: theme.textTheme.bodyMedium,
            ),
            if (snapshot.tcgUnpricedCopies > 0)
              Text(
                '${snapshot.tcgUnpricedCopies} unpriced on TCGplayer',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            if (snapshot.cmUnpricedCopies > 0)
              Text(
                '${snapshot.cmUnpricedCopies} unpriced on CardMarket',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            if (snapshot.topPrintings.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                'Top Printings',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              for (final row in snapshot.topPrintings)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              row.name,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              '${row.finish} · ×${row.quantity}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        pricing.formatValue(row.contribution),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PriceLine {
  const _PriceLine(this.label, this.value, this.unpricedCopies);
  final String label;
  final String value;
  final int unpricedCopies;
}

class _MarketplaceGroup extends StatelessWidget {
  const _MarketplaceGroup({required this.title, required this.rows});
  final String title;
  final List<_PriceLine> rows;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                Expanded(
                  child: Text(row.label, style: theme.textTheme.bodyMedium),
                ),
                if (row.unpricedCopies > 0)
                  Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: Text(
                      '${row.unpricedCopies} unpriced',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                Text(
                  row.value,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
