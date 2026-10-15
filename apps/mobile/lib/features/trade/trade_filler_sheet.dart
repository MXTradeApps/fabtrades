import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/analytics/analytics.dart';
import '../../core/logic/pricing.dart';
import '../../core/logic/trade_filler.dart';
import '../../core/models/binder_entry.dart';
import '../../core/models/card_model.dart';
import '../../core/models/trade.dart';
import '../../core/providers.dart';

/// Opens the "Find Trade Filler" popup. It looks at the current value gap
/// between the two sides of the live trade and suggests catalog cards whose
/// price most closely matches that gap, boosting binder / want-list cards
/// to the top without filtering the rest of the catalog.
Future<void> showTradeFillerSheet(BuildContext context, WidgetRef ref) async {
  final before = ref.read(tradeDraftProvider);
  final gapBefore = (before.wantTotal - before.haveTotal).abs();
  ref
      .read(analyticsProvider)
      .capture('trade_filler_opened', {'value_gap': gapBefore});

  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    routeSettings: const RouteSettings(name: 'Trade Filler'),
    builder: (_) => const _TradeFillerSheet(),
  );

  final after = ref.read(tradeDraftProvider);
  final cardsAdded = (after.haveCount + after.wantCount) -
      (before.haveCount + before.wantCount);
  if (cardsAdded > 0) {
    final gapAfter = (after.wantTotal - after.haveTotal).abs();
    ref.read(analyticsProvider).capture('trade_filler_applied', {
      'cards_added': cardsAdded,
      'value_gap_before': gapBefore,
      'value_gap_after': gapAfter,
    });
  }
}

class _TradeFillerSheet extends ConsumerStatefulWidget {
  const _TradeFillerSheet();

  @override
  ConsumerState<_TradeFillerSheet> createState() => _TradeFillerSheetState();
}

class _TradeFillerSheetState extends ConsumerState<_TradeFillerSheet> {
  static const int _maxResults = 60;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final trade = ref.watch(tradeDraftProvider);
    final pricing = ref.watch(pricingProvider);
    final catalog = ref.watch(catalogProvider).asData?.value ?? const [];
    final binder = ref.watch(binderProvider);

    final symbol = trade.currencySymbol;
    // + gap => their side is worth more, so MY (have) side needs value.
    // - gap => my side is worth more, so THEIR (want) side needs value.
    final gap = trade.wantTotal - trade.haveTotal;
    final target = gap.abs();
    final balanced = target < 0.01;
    final fillSide = gap > 0 ? TradeSide.have : TradeSide.want;
    final sideIsMine = fillSide == TradeSide.have;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.8,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _header(theme, symbol, target, balanced, sideIsMine),
              const SizedBox(height: 12),
              if (balanced)
                _balancedState(theme)
              else ...[
                Flexible(
                  child: _results(
                    context: context,
                    theme: theme,
                    catalog: catalog,
                    pricing: pricing,
                    target: target,
                    fillSide: fillSide,
                    symbol: symbol,
                    sideIsMine: sideIsMine,
                    binderEntries: binder,
                    catalogLoading:
                        ref.watch(catalogProvider).asData == null,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(
    ThemeData theme,
    String symbol,
    double target,
    bool balanced,
    bool sideIsMine,
  ) {
    final scheme = theme.colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: scheme.primaryContainer,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(Icons.balance, color: scheme.onPrimaryContainer),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Find Trade Filler',
                  style: theme.textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(
                balanced
                    ? 'This trade is already even.'
                    : '${sideIsMine ? 'Your' : 'Their'} side needs '
                        '$symbol${target.toStringAsFixed(2)} more to balance.',
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: scheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _balancedState(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.check_circle_outline,
                size: 40, color: context.tokens.gain),
            const SizedBox(height: 8),
            Text('Nothing to fill — the trade is balanced.',
                style: theme.textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(ThemeData theme, String label) {
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 6),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _results({
    required BuildContext context,
    required ThemeData theme,
    required List<CardModel> catalog,
    required Pricing pricing,
    required double target,
    required TradeSide fillSide,
    required String symbol,
    required bool sideIsMine,
    required List<BinderEntry> binderEntries,
    required bool catalogLoading,
  }) {
    if (catalogLoading && catalog.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator.adaptive()),
      );
    }

    final partition = partitionFillerMatches(
      catalog: catalog,
      pricing: pricing,
      target: target,
      fillSide: fillSide,
      binderEntries: binderEntries,
      maxResults: _maxResults,
    );

    if (partition.boosted.isEmpty && partition.catalog.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Text(
            'No priced cards available to suggest.',
            style: theme.textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    final boostLabel =
        sideIsMine ? 'From your Binder' : 'From your Want List';

    return ListView(
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      children: [
        if (partition.boosted.isNotEmpty) ...[
          _sectionLabel(theme, boostLabel),
          for (var i = 0; i < partition.boosted.length; i++) ...[
            if (i > 0) const Divider(height: 1, indent: 72),
            _matchRow(context, pricing, partition.boosted[i], target, symbol,
                fillSide),
          ],
          if (partition.catalog.isNotEmpty) ...[
            const SizedBox(height: 8),
            _sectionLabel(theme, 'Catalog'),
          ],
        ] else
          _sectionLabel(theme, 'Closest matches first'),
        for (var i = 0; i < partition.catalog.length; i++) ...[
          if (i > 0 || partition.boosted.isNotEmpty)
            const Divider(height: 1, indent: 72),
          _matchRow(context, pricing, partition.catalog[i], target, symbol,
              fillSide),
        ],
      ],
    );
  }

  Widget _matchRow(
    BuildContext context,
    Pricing pricing,
    FillerMatch m,
    double target,
    String symbol,
    TradeSide fillSide,
  ) {
    final low = pricing.lowPriceLabel(m.card);
    final closeness = _closenessLabel(m, target, symbol);
    return CardRow(
      card: m.card,
      priceLabel: pricing.priceLabel(m.card),
      secondaryLabel: low == null ? closeness : '$low · $closeness',
      onAdd: () => _addFiller(context, m.card, fillSide),
      onTap: () => _addFiller(context, m.card, fillSide),
    );
  }

  String _closenessLabel(FillerMatch m, double target, String symbol) {
    if (m.gapDistance < 0.01) return 'Exact match';
    final over = m.price > target;
    return '$symbol${m.gapDistance.toStringAsFixed(2)} ${over ? 'over' : 'under'}';
  }

  void _addFiller(BuildContext context, CardModel card, TradeSide side) {
    ref
        .read(tradeDraftProvider.notifier)
        .addCard(side, card, source: 'filler');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Added ${card.name} to ${side == TradeSide.have ? 'your' : 'their'} side',
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}
