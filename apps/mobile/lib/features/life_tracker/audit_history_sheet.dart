import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import 'life_tracker_models.dart';
import 'life_tracker_provider.dart';


Future<void> showAuditHistorySheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _AuditHistorySheet(),
  );
}

class _AuditHistorySheet extends ConsumerWidget {
  const _AuditHistorySheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(lifeTrackerProvider);
    final theme = Theme.of(context);
    final entries = state.history.reversed.toList();
    final timeFmt = DateFormat.jm();

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.9,
      builder: (context, scrollController) {
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Match history',
                      style: theme.textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            Expanded(
              child: entries.isEmpty
                  ? Center(
                      child: Text(
                        'No life changes yet.\nChanges appear after you stop tapping.',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    )
                  : ListView.separated(
                      controller: scrollController,
                      itemCount: entries.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final e = entries[index];
                        return _HistoryRow(
                          entry: e,
                          label: e.isOpponent ? 'Opponent' : 'You',
                          timeLabel: timeFmt.format(e.at.toLocal()),
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }
}

/// Your changes align left; opponent changes align right.
class _HistoryRow extends StatelessWidget {
  const _HistoryRow({
    required this.entry,
    required this.label,
    required this.timeLabel,
  });

  final LifeChangeEntry entry;
  final String label;
  final String timeLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final deltaColor =
        entry.delta >= 0 ? AppTheme.positive : AppTheme.negative;
    final deltaText =
        entry.delta > 0 ? '+${entry.delta}' : '${entry.delta}';
    final align =
        entry.isOpponent ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final textAlign = entry.isOpponent ? TextAlign.right : TextAlign.left;

    final deltaChip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: deltaColor.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        deltaText,
        style: theme.textTheme.labelLarge?.copyWith(
          color: deltaColor,
          fontWeight: FontWeight.bold,
        ),
      ),
    );

    final time = Text(
      timeLabel,
      style: theme.textTheme.bodySmall?.copyWith(
        color: theme.colorScheme.onSurfaceVariant,
      ),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: align,
        children: [
          Text(
            label,
            textAlign: textAlign,
            style: theme.textTheme.titleSmall,
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: entry.isOpponent
                ? MainAxisAlignment.end
                : MainAxisAlignment.start,
            children: entry.isOpponent
                ? [
                    time,
                    const SizedBox(width: 12),
                    deltaChip,
                    const SizedBox(width: 12),
                    Text(
                      '${entry.from} → ${entry.to}',
                      style: theme.textTheme.bodyMedium,
                    ),
                  ]
                : [
                    Text(
                      '${entry.from} → ${entry.to}',
                      style: theme.textTheme.bodyMedium,
                    ),
                    const SizedBox(width: 12),
                    deltaChip,
                    const SizedBox(width: 12),
                    time,
                  ],
          ),
        ],
      ),
    );
  }
}
