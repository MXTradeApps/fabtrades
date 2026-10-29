import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../app/ui.dart';
import '../../core/logic/binder_value_snapshot.dart';
import '../../core/logic/recent_movers.dart';
import '../../core/models/binder.dart';
import '../../core/models/binder_entry.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import '../card_detail/card_detail_screen.dart';
import 'mover_box.dart';

/// Movers below this start Low are penny noise, so Home leaves them out.
const _moverFloor = 1.0;

/// Copies per printing across every owned Binder (Want List excluded).
Map<String, int> ownedCopiesByPrinting(Iterable<BinderEntry> entries) {
  final copies = <String, int>{};
  for (final e in entries) {
    if (e.isWanted || e.quantity < 1) continue;
    copies[e.card.id] = (copies[e.card.id] ?? 0) + e.quantity;
  }
  return copies;
}

/// Quantity-weighted recent Low change across the collection. Null when no
/// owned printing has a recent change to report.
({double amount, double percent})? collectionRecentChange(
  Iterable<RecentLowChange> changes,
  Map<String, int> copies,
) {
  var amount = 0.0;
  var start = 0.0;
  var any = false;
  for (final c in changes) {
    final qty = copies[c.cardId];
    if (qty == null || qty < 1) continue;
    any = true;
    amount += c.amountChange * qty;
    start += c.startLow * qty;
  }
  if (!any || start <= 0) return null;
  return (amount: amount, percent: amount / start);
}

/// Owned printings that moved most, by total change across their copies.
List<RecentLowChange> collectionMovers(
  Iterable<RecentLowChange> changes,
  Map<String, int> copies, {
  int limit = 3,
}) {
  final rows =
      changes
          .where(
            (c) =>
                (copies[c.cardId] ?? 0) > 0 &&
                c.startLow >= _moverFloor &&
                c.amountChange != 0,
          )
          .toList()
        ..sort(
          (a, b) => (b.amountChange * copies[b.cardId]!).abs().compareTo(
            (a.amountChange * copies[a.cardId]!).abs(),
          ),
        );
  return rows.take(limit).toList(growable: false);
}

/// Personal top of Home: collection value and recent change, the biggest
/// movers among owned cards.
class HomeDashboard extends ConsumerStatefulWidget {
  const HomeDashboard({super.key});

  @override
  ConsumerState<HomeDashboard> createState() => _HomeDashboardState();
}

class _HomeDashboardState extends ConsumerState<HomeDashboard> {
  int _gen = 0;
  String? _fetchedKey;
  List<RecentLowChange> _changes = const [];

  Future<void> _load(String source, List<String> ids, String key) async {
    final gen = ++_gen;
    _fetchedKey = key;
    if (ids.isEmpty) {
      setState(() => _changes = const []);
      return;
    }
    try {
      final rows = await ref
          .read(cardRepositoryProvider)
          .printingRecentChanges(source, ids);
      if (!mounted || gen != _gen) return;
      setState(() => _changes = rows);
    } catch (_) {
      // The change line and movers are extras; the value still shows.
      if (!mounted || gen != _gen) return;
      setState(() => _changes = const []);
    }
  }

  void _openCard(CardModel card) {
    final catalog =
        ref.read(catalogProvider).asData?.value ?? const <CardModel>[];
    final full = catalog.where((c) => c.id == card.id).firstOrNull ?? card;
    Navigator.of(context).push(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'Card Detail'),
        builder: (_) => CardDetailScreen(card: full, source: 'home'),
      ),
    );
  }

  void _openBinders() {
    ref.read(openBinderIdProvider.notifier).close();
    ref.read(shellTabProvider.notifier).go(binderTabIndex);
  }

  @override
  Widget build(BuildContext context) {
    final entries = ref.watch(binderProvider);
    final binders = ref.watch(bindersProvider);
    final settings = ref.watch(settingsProvider);
    final pricing = ref.watch(pricingProvider);
    final copies = ownedCopiesByPrinting(entries);

    final ids = copies.keys.toList()..sort();
    final key = '${settings.source.name}:${ids.join(',')}';
    if (_fetchedKey != key) {
      _fetchedKey = key;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load(settings.source.name, ids, key);
      });
    }

    if (copies.isEmpty) {
      return _StartCollection(onTap: _openBinders);
    }

    final cardCount = copies.values.fold<int>(0, (s, q) => s + q);
    final binderCount = Binder.gridOrder(
      binders,
    ).where((b) => !b.isWant).length;
    final total = chosenSourceHeadlineAmount(entries, source: settings.source);
    final change = collectionRecentChange(_changes, copies);
    final movers = collectionMovers(_changes, copies);
    final cardsById = {for (final e in entries) e.card.id: e.card};

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _CollectionSummary(
          total: pricing.format(total),
          detail:
              '$cardCount ${cardCount == 1 ? 'card' : 'cards'} · '
              '$binderCount ${binderCount == 1 ? 'binder' : 'binders'}',
          change: change,
          formatAmount: pricing.formatValue,
          onTap: _openBinders,
        ),
        if (movers.isNotEmpty) ...[
          const SectionTitle(
            'Moving in your binders',
            key: Key('homeOwnedMoversTitle'),
            padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Column(
              key: const Key('homeOwnedMovers'),
              children: [
                for (final m in movers)
                  MoverBox(
                    key: Key('homeOwnedMover-${m.cardId}'),
                    name: cardsById[m.cardId]?.name ?? m.cardId,
                    setName: cardsById[m.cardId]?.setName ?? '',
                    finish: cardsById[m.cardId]?.subTypeName ?? '',
                    currentLow: m.latestLow,
                    percentChange: m.percentChange,
                    amountChange: m.amountChange,
                    // MoverBox says "N copies", so a single copy shows none.
                    copies: (copies[m.cardId] ?? 0) > 1
                        ? copies[m.cardId]
                        : null,
                    pricing: pricing,
                    onSelect: () {
                      final card = cardsById[m.cardId];
                      if (card != null) _openCard(card);
                    },
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 8),
      ],
    );
  }
}

class _CollectionSummary extends StatelessWidget {
  const _CollectionSummary({
    required this.total,
    required this.detail,
    required this.change,
    required this.formatAmount,
    required this.onTap,
  });

  final String total;
  final String detail;
  final ({double amount, double percent})? change;
  final String Function(double) formatAmount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final t = context.tokens;
    final c = change;
    final up = c != null && c.amount >= 0;
    final pct = c == null ? 0 : c.percent * 100;
    final pctLabel = pct.abs() >= 10
        ? pct.abs().toStringAsFixed(0)
        : pct.abs().toStringAsFixed(1);

    return Panel(
      key: const Key('homeCollectionSummary'),
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
      onTap: onTap,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'YOUR COLLECTION',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.9,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  total,
                  key: const Key('homeCollectionValue'),
                  style: AppType.tabular(
                    theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 2),
                Text(detail, style: theme.textTheme.bodySmall),
                if (c != null && c.amount != 0) ...[
                  const SizedBox(height: 6),
                  Row(
                    key: const Key('homeCollectionChange'),
                    children: [
                      Icon(
                        up
                            ? Icons.trending_up_rounded
                            : Icons.trending_down_rounded,
                        size: 16,
                        color: up ? t.gain : t.loss,
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          '${up ? '+' : '−'}${formatAmount(c.amount.abs())} '
                          '(${up ? '+' : '−'}$pctLabel%) this week',
                          style: AppType.tabular(
                            theme.textTheme.bodySmall?.copyWith(
                              color: up ? t.gain : t.loss,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: t.textFaint),
        ],
      ),
    );
  }
}

class _StartCollection extends StatelessWidget {
  const _StartCollection({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final t = context.tokens;
    return Panel(
      key: const Key('homeStartCollection'),
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: t.accentSoft,
              borderRadius: AppRadii.mdAll,
            ),
            child: Icon(
              Icons.collections_bookmark_outlined,
              color: t.accentText,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Start your collection',
                  style: theme.textTheme.titleSmall,
                ),
                Text(
                  'Scan or search cards to track their value here',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: t.textFaint),
        ],
      ),
    );
  }
}
