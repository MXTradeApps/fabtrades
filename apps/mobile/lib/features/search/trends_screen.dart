import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/analytics/analytics.dart';
import '../../core/providers.dart';
import 'recent_movers_section.dart';

/// Compact Home row that opens catalog-wide gainers and losers.
class SeeTrendingTile extends ConsumerWidget {
  const SeeTrendingTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ListTile(
          key: const Key('seeTrending'),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          leading: Icon(Icons.trending_up, color: scheme.primary),
          title: const Text('See Trending'),
          trailing: Icon(Icons.chevron_right, color: scheme.onSurfaceVariant),
          onTap: () {
            ref.read(analyticsProvider).capture('trending_opened');
            Navigator.of(context).push(
              MaterialPageRoute(
                settings: const RouteSettings(name: 'Trending'),
                builder: (_) => const TrendsScreen(),
              ),
            );
          },
        ),
        const Divider(height: 1, indent: 16),
      ],
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
