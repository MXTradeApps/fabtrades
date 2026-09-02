import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/logic/pricing.dart';
import '../../core/logic/recent_movers.dart';
import '../../core/models/app_settings.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import '../card_detail/card_detail_screen.dart';
import 'mover_box.dart';

/// Catalog-wide recent movers. Search and the set list must paint without
/// waiting on this fetch.
class RecentMoversSection extends ConsumerStatefulWidget {
  const RecentMoversSection({super.key});

  @override
  ConsumerState<RecentMoversSection> createState() =>
      _RecentMoversSectionState();
}

class _RecentMoversSectionState extends ConsumerState<RecentMoversSection> {
  int _catalogGen = 0;
  var _catalogLoading = true;
  Object? _catalogError;
  List<RecentMoverRow> _catalogRows = const [];
  PriceSource? _source;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _reloadCatalog();
    });
  }

  Future<void> _reloadCatalog() async {
    final source = ref.read(settingsProvider).source;
    if (_source != source) {
      _catalogRows = const [];
      _source = source;
    }
    final gen = ++_catalogGen;
    final sourceName = source.name;
    setState(() {
      _catalogLoading = true;
      _catalogError = null;
    });
    try {
      final rows =
          await ref.read(cardRepositoryProvider).recentMovers(sourceName);
      if (!mounted || gen != _catalogGen) return;
      setState(() {
        _catalogRows = rows;
        _catalogLoading = false;
      });
    } catch (error) {
      if (!mounted || gen != _catalogGen) return;
      setState(() {
        _catalogError = error;
        _catalogLoading = false;
      });
    }
  }

  void _openRow(RecentMoverRow row) {
    final catalog = ref.read(catalogProvider).asData?.value ?? const <CardModel>[];
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

  @override
  Widget build(BuildContext context) {
    ref.listen<AppSettings>(settingsProvider, (prev, next) {
      if (prev?.source != next.source) _reloadCatalog();
    });

    final pricing = ref.watch(pricingProvider);
    final sourceLabel = pricing.sourceLabel;
    final gainers = _catalogRows.where((r) => r.isGainer).toList();
    final losers = _catalogRows.where((r) => !r.isGainer).toList();

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Catalog-wide recent movers',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 8),
          if (_catalogLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator.adaptive()),
            )
          else if (_catalogError != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                children: [
                  Text(
                    'Couldn’t load recent movers from $sourceLabel.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  TextButton(onPressed: _reloadCatalog, child: const Text('Retry')),
                ],
              ),
            )
          else ...[
            _DirectionList(
              title: 'Gainers',
              rows: gainers,
              pricing: pricing,
              up: true,
              emptyCopy: 'No recent gainers on $sourceLabel.',
              onSelect: _openRow,
            ),
            const SizedBox(height: 8),
            _DirectionList(
              title: 'Losers',
              rows: losers,
              pricing: pricing,
              up: false,
              emptyCopy: 'No recent losers on $sourceLabel.',
              onSelect: _openRow,
            ),
          ],
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Text(
              'Observed catalog Lows, not a sale. Values follow $sourceLabel.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DirectionList extends StatelessWidget {
  const _DirectionList({
    required this.title,
    required this.rows,
    required this.pricing,
    required this.up,
    required this.emptyCopy,
    required this.onSelect,
  });

  final String title;
  final List<RecentMoverRow> rows;
  final Pricing pricing;
  final bool up;
  final String emptyCopy;
  final void Function(RecentMoverRow row) onSelect;

  @override
  Widget build(BuildContext context) {
    final color = up ? AppTheme.positive : AppTheme.negative;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w700,
              ),
        ),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              emptyCopy,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          )
        else
          for (final row in rows)
            MoverBox(
              name: row.name,
              setName: row.setName,
              finish: row.finish,
              currentLow: row.latestLow,
              percentChange: row.percentChange,
              amountChange: row.amountChange,
              pricing: pricing,
              onSelect: () => onSelect(row),
            ),
      ],
    );
  }
}
