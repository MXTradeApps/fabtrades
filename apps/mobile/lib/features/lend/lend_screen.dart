import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/app.dart';
import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/logic/pricing.dart';
import '../../core/models/lend_group.dart';
import '../../core/providers.dart';
import '../onboarding/onboarding_keys.dart';
import '../onboarding/showcase_theme.dart';
import '../onboarding/tour_copy.dart';
import 'lend_group_screen.dart';
import 'person_name_dialog.dart';

class LendScreen extends ConsumerStatefulWidget {
  const LendScreen({super.key});

  @override
  ConsumerState<LendScreen> createState() => _LendScreenState();
}

class _LendScreenState extends ConsumerState<LendScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 2, vsync: this)
    ..addListener(() => setState(() {}));

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final groups = ref.watch(lendProvider);
    final pricing = ref.watch(pricingProvider);
    final lentOut = groups.where((g) => !g.isBorrowing).toList();
    final borrowing = groups.where((g) => g.isBorrowing).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lend'),
        actions: const [AppMenuAction()],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(46),
          child: ShowcaseTheme.mark(
            key: OnboardingKeys.lendTabs,
            title: TourCopy.lendTabsTitle,
            description: TourCopy.lendTabsBody,
            child: TabBar(
              controller: _tab,
              tabs: [
                Tab(text: 'Lent out (${lentOut.length})'),
                Tab(text: 'Borrowing (${borrowing.length})'),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          _GroupList(
            groups: lentOut,
            pricing: pricing,
            isBorrowing: false,
            emptyText: "You haven't lent out any cards yet.",
            onAdd: () => _newGroup(context, isBorrowing: false),
            showcaseNewBatch: true,
          ),
          _GroupList(
            groups: borrowing,
            pricing: pricing,
            isBorrowing: true,
            emptyText: "You aren't borrowing any cards yet.",
            onAdd: () => _newGroup(context, isBorrowing: true),
          ),
        ],
      ),
    );
  }

  Future<void> _newGroup(BuildContext context,
      {required bool isBorrowing}) async {
    final personName = await askPersonName(context, isBorrowing: isBorrowing);
    if (personName == null || !context.mounted) return;
    // lend_group_created fires from LendNotifier.createGroup so every call
    // site is covered without duplicating the event here.
    final id = ref.read(lendProvider.notifier).createGroup(
          personName: personName.isEmpty ? null : personName,
          isBorrowing: isBorrowing,
        );
    if (!context.mounted) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'Lend Group'),
        builder: (_) => LendGroupScreen(groupId: id),
      ),
    );
  }
}

class _GroupList extends ConsumerWidget {
  const _GroupList({
    required this.groups,
    required this.pricing,
    required this.isBorrowing,
    required this.emptyText,
    required this.onAdd,
    this.showcaseNewBatch = false,
  });

  final List<LendGroup> groups;
  final Pricing pricing;
  final bool isBorrowing;
  final String emptyText;
  final VoidCallback onAdd;

  /// Only the Lent-out tab hosts the coach-mark target so IndexedStack does
  /// not register the same key twice.
  final bool showcaseNewBatch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addRow = AddListRow(
      label: isBorrowing ? 'New borrow batch' : 'New loan batch',
      onTap: onAdd,
    );
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      children: [
        if (groups.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
            child: Text(
              emptyText,
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
        for (final g in groups)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _GroupCard(group: g, pricing: pricing),
          ),
        if (showcaseNewBatch)
          ShowcaseTheme.mark(
            key: OnboardingKeys.lendNewBatch,
            title: TourCopy.lendNewBatchTitle,
            description: TourCopy.lendNewBatchBody,
            child: addRow,
          )
        else
          addRow,
      ],
    );
  }
}

class _GroupCard extends ConsumerWidget {
  const _GroupCard({required this.group, required this.pricing});
  final LendGroup group;
  final Pricing pricing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final color = group.isBorrowing ? context.tokens.accent : context.tokens.gain;
    final total = group.items
        .fold<double>(0, (s, i) => s + (pricing.value(i.card) ?? 0) * i.quantity);
    final name =
        group.personName?.isNotEmpty == true ? group.personName! : 'Someone';

    return Dismissible(
      key: ValueKey(group.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: context.tokens.loss,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      confirmDismiss: (_) => _confirmDelete(context),
      // lend_group_deleted fires from LendNotifier.removeGroup.
      onDismissed: (_) => ref.read(lendProvider.notifier).removeGroup(group.id),
      child: Material(
        color: theme.cardTheme.color ?? scheme.surface,
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
              settings: const RouteSettings(name: 'Lend Group'),
              builder: (_) => LendGroupScreen(groupId: group.id))),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: color.withValues(alpha: 0.15),
                      child: Icon(
                          group.isBorrowing
                              ? Icons.call_received
                              : Icons.call_made,
                          size: 18,
                          color: color),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.w700)),
                          Text(
                              '${group.cardCount} '
                              '${group.cardCount == 1 ? 'card' : 'cards'}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                  color: scheme.onSurfaceVariant)),
                        ],
                      ),
                    ),
                    Text(pricing.formatValue(total),
                        style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800, color: color)),
                    const SizedBox(width: 4),
                    Icon(Icons.chevron_right, color: scheme.outline),
                  ],
                ),
                if (group.items.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _ThumbStrip(group: group),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<bool> _confirmDelete(BuildContext context) async {
    final ok = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => AlertDialog.adaptive(
        title: const Text('Delete this batch?'),
        content: const Text('This removes the whole loan and its cards.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Delete')),
        ],
      ),
    );
    return ok ?? false;
  }
}

/// A horizontal strip of small card thumbnails previewing a group.
class _ThumbStrip extends StatelessWidget {
  const _ThumbStrip({required this.group});
  final LendGroup group;

  @override
  Widget build(BuildContext context) {
    const maxThumbs = 6;
    final items = group.items.take(maxThumbs).toList();
    final overflow = group.items.length - items.length;
    return SizedBox(
      height: 56,
      child: Row(
        children: [
          for (final i in items)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: CardThumbnail(
                  url: i.card.imageUrl,
                  width: 40,
                  height: 56,
                  foil: i.card.isFoil),
            ),
          if (overflow > 0)
            Container(
              width: 40,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text('+$overflow',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 13)),
            ),
        ],
      ),
    );
  }
}
