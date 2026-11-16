import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/analytics/analytics.dart';
import '../../core/logic/pricing.dart';
import '../../core/logic/trending_movers.dart';
import '../../core/models/app_settings.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import '../card_detail/card_detail_screen.dart';

/// Catalog-wide Trending: the web page's controls (time window, rank by
/// percent or amount, price floor) over Rising and Falling lists. Rising is
/// measured on the catalog Low, Falling on Market (CardMarket: Trend).
///
/// The parent owns [options] so they survive a pull-to-refresh, which
/// recreates this widget to drop its cached lists.
class TrendingSection extends ConsumerStatefulWidget {
  const TrendingSection({
    super.key,
    required this.options,
    required this.onOptionsChanged,
  });

  final TrendingOptions options;
  final ValueChanged<TrendingOptions> onOptionsChanged;

  @override
  ConsumerState<TrendingSection> createState() => _TrendingSectionState();
}

class _TrendingSectionState extends ConsumerState<TrendingSection> {
  final _cache = <String, List<TrendingMoverRow>>{};
  int _gen = 0;
  var _loading = true;
  Object? _error;
  List<TrendingMoverRow> _rows = const [];
  var _showRising = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void didUpdateWidget(covariant TrendingSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.options != widget.options) _load();
  }

  Future<void> _load({bool force = false}) async {
    final source = ref.read(settingsProvider).source;
    final options = widget.options;
    final key = '${source.name}:$options';
    final gen = ++_gen;
    final cached = force ? null : _cache[key];
    if (cached != null) {
      setState(() {
        _rows = cached;
        _loading = false;
        _error = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await ref
          .read(cardRepositoryProvider)
          .trendingMovers(source.name, options: options);
      if (!mounted) return;
      _cache[key] = rows;
      if (gen != _gen) return;
      setState(() {
        _rows = rows;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || gen != _gen) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  void _openRow(TrendingMoverRow row) {
    final catalog =
        ref.read(catalogProvider).asData?.value ?? const <CardModel>[];
    CardModel? printing;
    for (final card in catalog) {
      if (card.id == row.cardId) {
        printing = card;
        break;
      }
    }
    if (printing == null) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'Card Detail'),
        builder: (_) => CardDetailScreen(card: printing!, source: 'trends'),
      ),
    );
  }

  void _change(TrendingOptions next) {
    if (next == widget.options) return;
    ref.read(analyticsProvider).capture('trending_options_changed', {
      'days': next.days,
      'sort': next.sort.param,
      'min_price': next.minPrice,
    });
    widget.onOptionsChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AppSettings>(settingsProvider, (prev, next) {
      if (prev?.source != next.source) _load();
    });

    final theme = Theme.of(context);
    final pricing = ref.watch(pricingProvider);
    final source = ref.watch(settingsProvider).source;
    final sourceLabel = pricing.sourceLabel;
    final cardmarket = source == PriceSource.cardmarket;
    final options = widget.options;
    final when = trendingWindowLabel(options.days);

    final rows = _rows.where((r) => r.isGainer == _showRising).toList();
    var total = rows.length;
    for (final r in rows) {
      if (r.directionTotal > total) total = r.directionTotal;
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            key: const Key('trendControls'),
            spacing: 8,
            runSpacing: 8,
            children: [
              _Segments<int>(
                key: const Key('trendDays'),
                values: trendingDayOptions,
                selected: options.days,
                labelFor: (d) => '$d days',
                onChanged: (d) => _change(options.copyWith(days: d)),
              ),
              _Segments<TrendingSort>(
                key: const Key('trendSort'),
                values: TrendingSort.values,
                selected: options.sort,
                labelFor: (s) => s == TrendingSort.percent
                    ? 'By %'
                    : 'By ${pricing.symbol}',
                onChanged: (s) => _change(options.copyWith(sort: s)),
              ),
              _Segments<int>(
                key: const Key('trendFloor'),
                values: trendingFloorOptions,
                selected: options.minPrice,
                labelFor: (f) => f == 0
                    ? 'Any price'
                    : cardmarket
                        ? '$f ${pricing.symbol}+'
                        : '${pricing.symbol}$f+',
                onChanged: (f) => _change(options.copyWith(minPrice: f)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator.adaptive()),
            )
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                children: [
                  Text(
                    'Couldn’t load trending cards from $sourceLabel.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium,
                  ),
                  TextButton(
                    onPressed: () => _load(force: true),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            )
          else ...[
            SegmentedButton<bool>(
              key: const Key('trendDirection'),
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: true, label: Text('Rising')),
                ButtonSegment(value: false, label: Text('Falling')),
              ],
              selected: {_showRising},
              onSelectionChanged: (next) {
                if (next.isEmpty) return;
                setState(() => _showRising = next.first);
              },
            ),
            const SizedBox(height: 4),
            if (rows.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'No cards ${_showRising ? 'rose' : 'fell'} $when on '
                  '$sourceLabel.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              )
            else ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
                child: Text(
                  'Top ${rows.length} of $total '
                  '${_showRising ? 'rising' : 'falling'} $when, by '
                  '${_showRising ? 'Low' : (cardmarket ? 'Trend' : 'Market')}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
              for (final row in rows)
                _TrendRow(
                  key: Key('trendRow-${row.direction}-${row.cardId}'),
                  row: row,
                  pricing: pricing,
                  onSelect: () => _openRow(row),
                ),
            ],
          ],
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            child: Text(
              'Rising uses the $sourceLabel Low, the cheapest listed copy, '
              'which jumps first when the cheap copies sell out. Falling uses '
              'the $sourceLabel ${cardmarket ? 'Trend' : 'Market'} price, so '
              'one cheap listing can’t make a card look like it crashed.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact single-choice segmented control for one Trending option.
class _Segments<T> extends StatelessWidget {
  const _Segments({
    super.key,
    required this.values,
    required this.selected,
    required this.labelFor,
    required this.onChanged,
  });

  final List<T> values;
  final T selected;
  final String Function(T value) labelFor;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<T>(
      showSelectedIcon: false,
      style: const ButtonStyle(
        visualDensity: VisualDensity.compact,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        padding: WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 10),
        ),
      ),
      segments: [
        for (final value in values)
          ButtonSegment(value: value, label: Text(labelFor(value))),
      ],
      selected: {selected},
      onSelectionChanged: (next) {
        if (next.isEmpty) return;
        onChanged(next.first);
      },
    );
  }
}

/// One ranked row: rank, art, name, set and finish, "was → now", and the
/// change as a percent with the amount under it.
class _TrendRow extends StatelessWidget {
  const _TrendRow({
    super.key,
    required this.row,
    required this.pricing,
    required this.onSelect,
  });

  final TrendingMoverRow row;
  final Pricing pricing;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final t = context.tokens;
    final muted = theme.colorScheme.onSurfaceVariant;
    final color = row.percentChange > 0 ? t.gain : t.loss;
    final pct = row.percentChange * 100;
    final pctLabel = '${pct >= 0 ? '+' : '−'}'
        '${pct.abs() >= 10 ? pct.abs().toStringAsFixed(0) : pct.abs().toStringAsFixed(1)}%';
    final amountLabel = '${row.amountChange >= 0 ? '+' : '−'}'
        '${pricing.formatValue(row.amountChange.abs())}';
    final finish = row.finish.trim();
    final meta = [row.setName, if (finish.isNotEmpty) finish].join(' · ');

    return InkWell(
      onTap: onSelect,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
        child: Row(
          children: [
            SizedBox(
              width: 22,
              child: Text(
                '${row.rank}',
                style: theme.textTheme.bodySmall?.copyWith(color: muted),
              ),
            ),
            CardThumbnail(url: row.imageUrl, width: 36, height: 50, radius: 6),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    row.name,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    meta,
                    style: theme.textTheme.bodySmall?.copyWith(color: muted),
                  ),
                  const SizedBox(height: 2),
                  Text.rich(
                    TextSpan(
                      text: 'was ${pricing.formatValue(row.startPrice)} → ',
                      children: [
                        TextSpan(
                          text: pricing.formatValue(row.latestPrice),
                          style: TextStyle(
                            color: theme.colorScheme.onSurface,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: muted,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  pctLabel,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w800,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                Text(
                  amountLabel,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: muted,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
