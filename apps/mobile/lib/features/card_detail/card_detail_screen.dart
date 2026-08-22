import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/fallback_network_image.dart';
import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/analytics/analytics.dart';
import '../../core/data/card_repository.dart';
import '../../core/models/app_settings.dart';
import '../../core/models/binder.dart';
import '../../core/models/card_model.dart';
import '../../core/models/trade.dart';
import '../../core/providers.dart';
import '../paywall/pro_limits.dart';
import 'price_history_section.dart';

class CardDetailScreen extends ConsumerStatefulWidget {
  const CardDetailScreen({super.key, required this.card, this.source = 'unknown'});
  final CardModel card;

  /// Where this screen was opened from (e.g. `search`, `set`, `scan`,
  /// `binder`, `want_list`, `card_detail`), for the `card_detail_viewed` event.
  final String source;

  @override
  ConsumerState<CardDetailScreen> createState() => _CardDetailScreenState();
}

class _CardDetailScreenState extends ConsumerState<CardDetailScreen> {
  late CardModel _selected = widget.card;

  @override
  void initState() {
    super.initState();
    ref.read(analyticsProvider).capture('card_detail_viewed', {
      'card_id': widget.card.id,
      'card_name': widget.card.name,
      'source': widget.source,
    });
  }

  void _select(CardModel c) {
    setState(() => _selected = c);
    ref.read(analyticsProvider).capture(
        'card_printing_switched', {'card_id': c.id});
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final settings = ref.watch(settingsProvider);
    final pricing = ref.watch(pricingProvider);
    final owned = ref.watch(binderProvider.select((entries) => entries
        .where((e) => e.card.id == _selected.id && !e.isWanted)
        .fold<int>(0, (s, e) => s + e.quantity)));
    final wanted = ref.watch(binderProvider.select((entries) => entries.any(
        (e) => e.card.id == _selected.id && e.isWanted && e.quantity > 0)));
    final catalog = ref.watch(catalogProvider).maybeWhen(
          data: (cards) => cards,
          orElse: () => const <CardModel>[],
        );
    final printings = printingsForCard(catalog, widget.card);

    return Scaffold(
      appBar: AppBar(title: Text(_selected.name)),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _CardArtThumb(
                      card: _selected,
                      onTap: () => _openArtViewer(context, _selected),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_selected.name,
                              style: theme.textTheme.titleLarge
                                  ?.copyWith(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          CardMetaLine(
                              card: _selected,
                              style: theme.textTheme.bodyMedium,
                              maxLines: 2),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              FinishBadge(card: _selected),
                              if (owned > 0)
                                GestureDetector(
                                  onTap: () => _editBinderQty(context, owned),
                                  child: PillBadge(
                                      label: 'Own $owned',
                                      color: AppTheme.positive,
                                      icon: Icons.check),
                                ),
                              if (wanted)
                                PillBadge(
                                    label: 'Wanted',
                                    color: AppTheme.wantAccent,
                                    icon: Icons.favorite),
                            ],
                          ),
                          if (printings.length >= 2) ...[
                            const SizedBox(height: 12),
                            _PrintingSelector(
                              printings: printings,
                              selectedId: _selected.id,
                              onSelect: _select,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _PriceCard(
                    card: _selected, settings: settings, pricing: pricing),
                const SizedBox(height: 14),
                PriceHistorySection(cardId: _selected.id),
              ],
            ),
          ),
          // Column footer (not Scaffold.bottomNavigationBar) so it sits above
          // the shell tab bar instead of competing with it.
          _ActionBar(card: _selected),
        ],
      ),
    );
  }

  Future<void> _editBinderQty(BuildContext context, int current) async {
    var qty = current;
    final saved = await showDialog<int>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              title: const Text('Binder quantity'),
              content: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    onPressed: qty > 0
                        ? () => setDialogState(() => qty--)
                        : null,
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                  Text('$qty',
                      style: Theme.of(ctx).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800)),
                  IconButton(
                    onPressed: () => setDialogState(() => qty++),
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ],
              ),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel')),
                FilledButton(
                    onPressed: () => Navigator.pop(ctx, qty),
                    child: const Text('Save')),
              ],
            );
          },
        );
      },
    );
    if (saved == null || !mounted) return;
    ref.read(binderProvider.notifier).setQuantity(
          _selected.id,
          false,
          saved,
          binderId: ref.read(openBinderIdProvider) ?? BinderIds.trade,
        );
  }
}

void _openArtViewer(BuildContext context, CardModel card) {
  final url = card.largeImageUrl ?? card.imageUrl;
  if (url == null || url.isEmpty) return;
  // Root navigator so the immersive viewer covers the tab bar too.
  Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder<void>(
      opaque: false,
      barrierColor: Colors.black87,
      barrierDismissible: true,
      pageBuilder: (context, animation, secondaryAnimation) {
        return FadeTransition(
          opacity: animation,
          child: _CardArtViewer(
            url: url,
            fallbackUrl: card.artViewerFallbackUrl,
            heroTag: 'card_${card.id}',
          ),
        );
      },
    ),
  );
}

class _CardArtThumb extends StatelessWidget {
  const _CardArtThumb({required this.card, required this.onTap});
  final CardModel card;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Hero(
      tag: 'card_${card.id}',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: CachedNetworkImage(
              imageUrl: card.imageUrl ?? '',
              height: 176,
              width: 126,
              fit: BoxFit.cover,
              placeholder: (_, _) => const SizedBox(
                height: 176,
                width: 126,
                child: Center(child: CircularProgressIndicator.adaptive()),
              ),
              errorWidget: (_, _, _) => Container(
                height: 176,
                width: 126,
                color: theme.colorScheme.surfaceContainerHighest,
                child: const Icon(Icons.broken_image_outlined, size: 40),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Full-screen zoomable card art. Tap outside / close button to dismiss.
class _CardArtViewer extends StatelessWidget {
  const _CardArtViewer({
    required this.url,
    this.fallbackUrl,
    required this.heroTag,
  });
  final String url;
  final String? fallbackUrl;
  final String heroTag;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // Tap empty space to dismiss.
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => Navigator.of(context).pop(),
              child: const SizedBox.expand(),
            ),
          ),
          Center(
            child: Hero(
              tag: heroTag,
              child: InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                child: FallbackNetworkImage(
                  imageUrl: url,
                  fallbackUrl: fallbackUrl,
                  fit: BoxFit.contain,
                  placeholder: (_, _) => const SizedBox(
                    width: 200,
                    height: 280,
                    child: Center(child: CircularProgressIndicator.adaptive()),
                  ),
                  errorWidget: (_, _, _) => const Icon(
                    Icons.broken_image_outlined,
                    color: Colors.white70,
                    size: 64,
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                tooltip: 'Close',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One printing paired with the concise finish label shown on its chip.
typedef _LabeledPrinting = ({CardModel card, String label});

class _PrintingSelector extends StatelessWidget {
  const _PrintingSelector({
    required this.printings,
    required this.selectedId,
    required this.onSelect,
  });
  final List<CardModel> printings;
  final String selectedId;
  final ValueChanged<CardModel> onSelect;

  /// Pitch colors ("Red"/"Yellow"/"Blue") are part of a Flesh and Blood card's
  /// identity and are shared by every version in a group (kept by
  /// [baseCardName]), so they must NOT be used to label individual versions.
  static const _pitchWords = {'red', 'yellow', 'blue'};

  /// Abbreviations to keep the verbose edition/qualifier values compact.
  static const _abbreviations = <String, String>{
    '1st Edition': '1st Ed.',
    'Unlimited Edition': 'Unltd.',
    'Alternate Art': 'Alt Art',
    'Overnumbered': 'Overnumber',
  };

  static String _abbrev(String s) {
    var out = s;
    _abbreviations.forEach((k, v) => out = out.replaceAll(k, v));
    return out.trim();
  }

  /// The finish/edition of a printing *within its set*: its subType
  /// ("Rainbow Foil", "Cold Foil", "1st Edition Normal") plus any non-pitch art
  /// qualifier from the name ("Extended Art"). The set is intentionally omitted
  /// here because it is rendered as a section header. Falls back to
  /// "Foil"/"Normal".
  static String _finishLabel(CardModel c) {
    final parts = <String>[];
    final qualifier = nameQualifier(c.name);
    if (qualifier != null && !_pitchWords.contains(qualifier.toLowerCase())) {
      parts.add(_abbrev(qualifier));
    }
    final sub = c.subTypeName?.trim();
    if (sub != null && sub.isNotEmpty) {
      parts.add(_abbrev(sub));
    }
    if (parts.isEmpty) return c.isFoil ? 'Foil' : 'Normal';
    return parts.join(' · ');
  }

  /// Groups printings by set name, preserving the incoming (base-first) order so
  /// the representative printing's set stays first. In Flesh and Blood the same
  /// card is often reprinted across sets/editions, so the set is the primary way
  /// to tell otherwise-identical finishes apart (e.g. a plain "Normal" from
  /// The Hunted vs one from Compendium of Rathe).
  List<({String set, List<_LabeledPrinting> items})> _groupBySet() {
    final bySet = <String, List<CardModel>>{};
    final order = <String>[];
    for (final c in printings) {
      // Prefer set+edition so First Edition / Unlimited group separately when
      // they share a bare set name but differ in subtype.
      final raw = c.setVersionLabel?.trim() ?? c.setName?.trim();
      final set = (raw != null && raw.isNotEmpty) ? raw : 'Other';
      final list = bySet[set];
      if (list == null) {
        bySet[set] = [c];
        order.add(set);
      } else {
        list.add(c);
      }
    }

    return [
      for (final set in order)
        (set: set, items: _labelWithinSet(bySet[set]!)),
    ];
  }

  /// Assigns each printing its finish label, disambiguating any collisions
  /// within a single set by appending the collector number.
  static List<_LabeledPrinting> _labelWithinSet(List<CardModel> cards) {
    final counts = <String, int>{};
    for (final c in cards) {
      final l = _finishLabel(c);
      counts[l] = (counts[l] ?? 0) + 1;
    }
    return [
      for (final c in cards)
        (
          card: c,
          label: (counts[_finishLabel(c)] ?? 0) > 1 &&
                  (c.collectorNumber?.trim().isNotEmpty ?? false)
              ? '${_finishLabel(c)} · #${c.collectorNumber!.trim()}'
              : _finishLabel(c),
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (printings.length < 2) return const SizedBox.shrink();
    final theme = Theme.of(context);
    final groups = _groupBySet();
    final showSetHeaders = groups.length > 1;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Versions',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(width: 6),
            Text('(${printings.length})',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ],
        ),
        const SizedBox(height: 8),
        for (var i = 0; i < groups.length; i++) ...[
          if (i > 0) const SizedBox(height: 12),
          if (showSetHeaders)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                groups[i].set,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                ),
              ),
            ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final p in groups[i].items)
                ChoiceChip(
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  side: BorderSide(color: theme.colorScheme.outline),
                  avatar: p.card.isFoil
                      ? const Icon(Icons.auto_awesome, size: 14)
                      : null,
                  label: Text(p.label),
                  selected: p.card.id == selectedId,
                  onSelected: (_) => onSelect(p.card),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _PriceCard extends StatelessWidget {
  const _PriceCard({
    required this.card,
    required this.settings,
    required this.pricing,
  });
  final CardModel card;
  final AppSettings settings;
  final dynamic pricing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final usd = NumberFormat.currency(locale: 'en_US', symbol: '\$');
    final eur = NumberFormat.currency(locale: 'en_US', symbol: '€');
    String f(NumberFormat nf, double? v) => v == null ? '—' : nf.format(v);

    final tcgRows = <MapEntry<String, String>>[
      MapEntry('Market', f(usd, card.tcgMarket)),
      MapEntry('Low', f(usd, card.tcgLow)),
      MapEntry('Mid', f(usd, card.tcgMid)),
      MapEntry('High', f(usd, card.tcgHigh)),
      MapEntry('Direct low', f(usd, card.tcgDirectLow)),
    ];
    final cmRows = <MapEntry<String, String>>[
      MapEntry('Trend', f(eur, card.isFoil ? card.cmTrendFoil : card.cmTrend)),
      MapEntry('Low', f(eur, card.isFoil ? card.cmLowFoil : card.cmLow)),
      MapEntry('Avg', f(eur, card.isFoil ? card.cmAvgFoil : card.cmAvg)),
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.sell_outlined,
                    size: 18, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text('Prices',
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(width: 8),
                Text(settings.source.label,
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
                const Spacer(),
                PriceSourceBadge(source: settings.source.label),
              ],
            ),
            const SizedBox(height: 10),
            _PriceGroup(title: 'TCGplayer (USD)', rows: tcgRows),
            const SizedBox(height: 10),
            _PriceGroup(title: 'CardMarket (EUR)', rows: cmRows),
            const SizedBox(height: 10),
            _PriceAttribution(updatedAt: card.priceUpdatedAt),
          ],
        ),
      ),
    );
  }
}

/// Credits where the price data comes from and when it was last synced, so the
/// numbers are always traceable to their marketplace source.
class _PriceAttribution extends StatelessWidget {
  const _PriceAttribution({required this.updatedAt});
  final DateTime? updatedAt;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = theme.textTheme.bodySmall
        ?.copyWith(color: theme.colorScheme.onSurfaceVariant);
    final updated = updatedAt == null
        ? null
        : DateFormat('MMM d, yyyy').format(updatedAt!.toLocal());
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.storefront_outlined,
            size: 14, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            'Price data from TCGplayer & CardMarket'
            '${updated == null ? '' : ' · updated $updated'}',
            style: style,
          ),
        ),
      ],
    );
  }
}

class _PriceGroup extends StatelessWidget {
  const _PriceGroup({required this.title, required this.rows});
  final String title;
  final List<MapEntry<String, String>> rows;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 6),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final r in rows)
                Padding(
                  padding: const EdgeInsets.only(right: 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(r.key,
                          style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant)),
                      const SizedBox(height: 2),
                      Text(r.value,
                          style: theme.textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ActionBar extends ConsumerWidget {
  const _ActionBar({required this.card});
  final CardModel card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    void snack(String msg) {
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
            SnackBar(content: Text(msg), duration: const Duration(seconds: 2)));
    }

    return Material(
      elevation: 2,
      color: Theme.of(context).colorScheme.surface,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    backgroundColor: AppTheme.wantAccent.withValues(alpha: 0.15),
                    foregroundColor: AppTheme.wantAccent),
                icon: const Icon(Icons.favorite_border),
                label: const Text('Want List'),
                onPressed: () => addToBinderOrUpsell(
                  context,
                  ref,
                  card,
                  isWanted: true,
                  successMessage: 'Added to Want List',
                  source: 'card_detail',
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.tonalIcon(
                style:
                    FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                icon: const Icon(Icons.swap_horiz),
                label: const Text('Add to trade'),
                onPressed: () {
                  ref
                      .read(tradeDraftProvider.notifier)
                      .addCard(TradeSide.want, card, source: 'card_detail');
                  snack('Added to trade');
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
