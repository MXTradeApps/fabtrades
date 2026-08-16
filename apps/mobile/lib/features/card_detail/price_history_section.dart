import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../core/analytics/analytics.dart';
import '../../core/logic/price_history_series.dart';
import '../../core/logic/pricing.dart';
import '../../core/models/app_settings.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import '../paywall/pro_paywall.dart';

/// Low-only history for one Printing, shown under the Prices box.
class PriceHistorySection extends ConsumerStatefulWidget {
  const PriceHistorySection({super.key, required this.cardId});

  final String cardId;

  static const sectionKey = Key('price-history-section');
  static const proCtaKey = Key('price-history-pro-cta');
  static const spanToggleKey = Key('price-history-span-toggle');
  static const retryKey = Key('price-history-retry');
  static const loadingKey = Key('price-history-loading');

  @override
  ConsumerState<PriceHistorySection> createState() =>
      _PriceHistorySectionState();
}

class _PriceHistorySectionState extends ConsumerState<PriceHistorySection> {
  PriceHistoryWindow _window = PriceHistoryWindow.last30;

  @override
  void didUpdateWidget(PriceHistorySection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.cardId != widget.cardId) {
      _window = PriceHistoryWindow.last30;
    }
  }

  @override
  Widget build(BuildContext context) {
    final history = ref.watch(priceHistoryProvider(widget.cardId));
    final settings = ref.watch(settingsProvider);
    final pricing = ref.watch(pricingProvider);
    final isPro = ref.watch(isProProvider);

    Widget body;
    if (history.hasError) {
      body = _ErrorBody(
        onRetry: () => ref.invalidate(priceHistoryProvider(widget.cardId)),
      );
    } else if (!history.hasValue) {
      body = const _HistoryMessage(
        child: SizedBox(
          key: PriceHistorySection.loadingKey,
          height: 36,
          child: Center(child: CircularProgressIndicator.adaptive()),
        ),
      );
    } else {
      body = _HistoryBody(
        cardId: widget.cardId,
        snapshots: history.requireValue,
        source: settings.source,
        pricing: pricing,
        isPro: isPro,
        window: _window,
        onWindowChanged: (next) {
          setState(() => _window = next);
          ref.read(analyticsProvider).capture(
            'price_history_span_changed',
            {
              'span': next == PriceHistoryWindow.full ? 'full' : '30d',
              'card_id': widget.cardId,
            },
          );
        },
      );
    }

    return Card(
      key: PriceHistorySection.sectionKey,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: body,
      ),
    );
  }
}

class _HistoryBody extends ConsumerWidget {
  const _HistoryBody({
    required this.cardId,
    required this.snapshots,
    required this.source,
    required this.pricing,
    required this.isPro,
    required this.window,
    required this.onWindowChanged,
  });

  final String cardId;
  final List<PricePoint> snapshots;
  final PriceSource source;
  final Pricing pricing;
  final bool isPro;
  final PriceHistoryWindow window;
  final ValueChanged<PriceHistoryWindow> onWindowChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final series = PriceHistorySeries.fromSnapshots(
      snapshots: snapshots,
      source: source,
      isPro: isPro,
      window: window,
    );
    if (!series.chartable) {
      return _HistoryMessage(child: Text(_emptyCopy(snapshots, source)));
    }

    final theme = Theme.of(context);
    final delta = series.delta!;
    final changeColor = delta > 0
        ? AppTheme.positive
        : delta < 0
            ? AppTheme.negative
            : theme.colorScheme.onSurfaceVariant;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.show_chart,
                size: 18, color: theme.colorScheme.primary),
            const SizedBox(width: 8),
            Text(
              'Price history',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          series.changeLabel(pricing)!,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
            color: changeColor,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 160,
          child: _LowChart(series: series, pricing: pricing),
        ),
        const SizedBox(height: 8),
        Text(
          'Observed catalog Low — the same source as today’s prices, not an appraisal.',
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        if (series.showProCta) ...[
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              key: PriceHistorySection.proCtaKey,
              onPressed: () => presentProPaywall(
                context,
                ref,
                trigger: 'price_history',
              ),
              child: const Text('See full history with Pro'),
            ),
          ),
        ],
        if (series.showSpanControl) ...[
          const SizedBox(height: 8),
          SegmentedButton<PriceHistoryWindow>(
            key: PriceHistorySection.spanToggleKey,
            segments: const [
              ButtonSegment(
                value: PriceHistoryWindow.last30,
                label: Text('30 days'),
              ),
              ButtonSegment(
                value: PriceHistoryWindow.full,
                label: Text('All recorded'),
              ),
            ],
            selected: {window},
            onSelectionChanged: (next) {
              if (next.isEmpty) return;
              onWindowChanged(next.first);
            },
          ),
        ],
      ],
    );
  }

  String _emptyCopy(List<PricePoint> snapshots, PriceSource source) {
    final other = source == PriceSource.tcgplayer
        ? PriceSource.cardmarket
        : PriceSource.tcgplayer;
    final otherChartable = PriceHistorySeries.fromSnapshots(
      snapshots: snapshots,
      source: other,
      isPro: true,
      window: PriceHistoryWindow.full,
    ).chartable;
    if (otherChartable) {
      return "History isn't available for ${source.label} yet";
    }
    return 'History not available yet';
  }
}

class _LowChart extends StatelessWidget {
  const _LowChart({required this.series, required this.pricing});

  final PriceHistorySeries series;
  final Pricing pricing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final points = series.points;
    final spots = [
      for (var i = 0; i < points.length; i++)
        FlSpot(i.toDouble(), points[i].low),
    ];
    final lows = points.map((p) => p.low);
    final minLow = lows.reduce((a, b) => a < b ? a : b);
    final maxLow = lows.reduce((a, b) => a > b ? a : b);
    final span = maxLow - minLow;
    final pad = span == 0
        ? (minLow.abs() * 0.05).clamp(0.05, 1.0)
        : span * 0.15;
    final dateFmt = DateFormat.MMMd();
    final labelStyle = theme.textTheme.bodySmall
            ?.copyWith(color: theme.colorScheme.onSurfaceVariant) ??
        const TextStyle(fontSize: 11);

    return LineChart(
      LineChartData(
        minX: 0,
        maxX: (points.length - 1).toDouble(),
        minY: minLow - pad,
        maxY: maxLow + pad,
        clipData: const FlClipData.none(),
        gridData: const FlGridData(show: false),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          leftTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 22,
              interval: (points.length - 1).toDouble().clamp(1, double.infinity),
              getTitlesWidget: (value, meta) {
                final i = value.round();
                if (i != 0 && i != points.length - 1) {
                  return const SizedBox.shrink();
                }
                if (i < 0 || i >= points.length) {
                  return const SizedBox.shrink();
                }
                return Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(dateFmt.format(points[i].date), style: labelStyle),
                );
              },
            ),
          ),
        ),
        lineTouchData: LineTouchData(
          enabled: true,
          handleBuiltInTouches: true,
          touchTooltipData: LineTouchTooltipData(
            getTooltipItems: (touched) {
              return [
                for (final s in touched)
                  LineTooltipItem(
                    '${dateFmt.format(points[s.spotIndex].date)}\n'
                    '${pricing.format(points[s.spotIndex].low)}',
                    labelStyle.copyWith(
                      color: theme.colorScheme.onPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ];
            },
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: false,
            color: theme.colorScheme.primary,
            barWidth: 2,
            dotData: const FlDotData(show: true),
          ),
        ],
      ),
      duration: Duration.zero,
    );
  }
}

class _HistoryMessage extends StatelessWidget {
  const _HistoryMessage({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.show_chart,
                size: 18, color: theme.colorScheme.primary),
            const SizedBox(width: 8),
            Text(
              'Price history',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
        const SizedBox(height: 10),
        child,
      ],
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return _HistoryMessage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("Couldn't load history"),
          TextButton(
            key: PriceHistorySection.retryKey,
            onPressed: onRetry,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
