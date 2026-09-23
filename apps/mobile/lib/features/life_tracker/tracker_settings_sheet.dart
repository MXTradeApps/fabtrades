import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'life_tracker_models.dart';
import 'life_tracker_provider.dart';

Future<void> showTrackerSettingsSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _TrackerSettingsSheet(),
  );
}

class _TrackerSettingsSheet extends ConsumerWidget {
  const _TrackerSettingsSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(lifeTrackerProvider);
    final notifier = ref.read(lifeTrackerProvider.notifier);
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Life tracker settings',
                  style: theme.textTheme.titleLarge,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text('Format', style: theme.textTheme.titleSmall),
          const SizedBox(height: 8),
          SegmentedButton<LifeFormat>(
            showSelectedIcon: false,
            segments: [
              for (final f in LifeFormat.values)
                ButtonSegment(
                  value: f,
                  label: Text(f.shortLabel, textAlign: TextAlign.center),
                ),
            ],
            selected: {state.format},
            onSelectionChanged: (sel) {
              if (sel.isNotEmpty) notifier.setFormat(sel.first);
            },
          ),
          const SizedBox(height: 8),
          Text(
            'Starting life ${state.format.defaultStartingLife}  ·  '
            'Round timer ${_formatDuration(state.format.roundDuration)}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: () => _startGame(context, ref),
            icon: const Icon(Icons.play_arrow_rounded),
            label: const Text('Start Game'),
          ),
        ],
      ),
    );
  }

  Future<void> _startGame(BuildContext context, WidgetRef ref) async {
    final state = ref.read(lifeTrackerProvider);
    if (!state.isPristine) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Start a new game?'),
          content: Text(
            'Both players start at ${state.format.defaultStartingLife} life, '
            'history is cleared, and the round timer starts.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Start Game'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }
    ref.read(lifeTrackerProvider.notifier).startGame();
    if (context.mounted) Navigator.of(context).pop();
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes;
    return '$m min';
  }
}
