import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../app/ui.dart';
import '../../core/analytics/analytics.dart';
import '../../core/providers.dart';
import 'recent_movers_section.dart';

/// Compact Home row that opens catalog-wide gainers and losers.
class SeeTrendingTile extends ConsumerWidget {
  const SeeTrendingTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final t = context.tokens;
    return Panel(
      key: const Key('seeTrending'),
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      onTap: () {
        ref.read(analyticsProvider).capture('trending_opened');
        Navigator.of(context).push(
          MaterialPageRoute(
            settings: const RouteSettings(name: 'Trending'),
            builder: (_) => const TrendsScreen(),
          ),
        );
      },
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: t.accentSoft,
              borderRadius: AppRadii.mdAll,
            ),
            child: Icon(Icons.trending_up_rounded, color: t.accentText),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('See Trending', style: theme.textTheme.titleSmall),
                Text(
                  'Biggest price movers this week',
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

/// Dedicated list of top catalog-wide gainers and losers.
class TrendsScreen extends ConsumerStatefulWidget {
  const TrendsScreen({super.key});

  @override
  ConsumerState<TrendsScreen> createState() => _TrendsScreenState();
}

class _TrendsScreenState extends ConsumerState<TrendsScreen> {
  var _refreshGen = 0;

  Future<void> _refresh() async {
    try {
      await ref.read(catalogProvider.notifier).refresh();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(const SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text('Could not refresh prices. Check your connection.'),
        ));
      return;
    }
    if (!mounted) return;
    setState(() => _refreshGen++);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Trending'),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          key: ValueKey<int>(_refreshGen),
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            RecentMoversSection(),
          ],
        ),
      ),
    );
  }
}
