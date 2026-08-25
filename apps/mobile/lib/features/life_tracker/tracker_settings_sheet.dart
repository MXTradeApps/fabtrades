import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import 'hero_picker.dart';
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
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        child: Column(
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
              segments: [
                for (final f in LifeFormat.values)
                  ButtonSegment(
                    value: f,
                    label: Text(f.shortLabel),
                  ),
              ],
              selected: {state.format},
              onSelectionChanged: (sel) {
                if (sel.isNotEmpty) notifier.setFormat(sel.first);
              },
            ),
            const SizedBox(height: 4),
            Text(
              'Round timer: ${_formatDuration(state.format.roundDuration)}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            _PlayerSettingsBlock(
              title: 'Opponent',
              titleColor: AppTheme.negative,
              player: state.opponent,
              onPickHero: () => _pickHero(context, ref, opponent: true),
              onStartingLife: (life) =>
                  notifier.setStartingLife(opponent: true, life: life),
            ),
            const SizedBox(height: 16),
            _PlayerSettingsBlock(
              title: 'You',
              titleColor: AppTheme.positive,
              player: state.you,
              onPickHero: () => _pickHero(context, ref, opponent: false),
              onStartingLife: (life) =>
                  notifier.setStartingLife(opponent: false, life: life),
            ),
            const SizedBox(height: 8),
            Text(
              'Starting life applies on Reset.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton.tonalIcon(
              style: FilledButton.styleFrom(
                foregroundColor: theme.colorScheme.error,
              ),
              onPressed: () => _confirmReset(context, ref),
              icon: const Icon(Icons.restart_alt),
              label: const Text('Reset game'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickHero(
    BuildContext context,
    WidgetRef ref, {
    required bool opponent,
  }) async {
    final format = ref.read(lifeTrackerProvider).format;
    final result = await showHeroPicker(context, format: format);
    if (result == null) return;
    final notifier = ref.read(lifeTrackerProvider.notifier);
    if (result.isClear) {
      final player = opponent
          ? ref.read(lifeTrackerProvider).opponent
          : ref.read(lifeTrackerProvider).you;
      notifier.setHero(
        opponent: opponent,
        heroName: null,
        life: player.config.startingLife,
      );
    } else {
      notifier.setHero(
        opponent: opponent,
        heroName: result.name,
        life: result.life,
      );
    }
  }

  Future<void> _confirmReset(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset game?'),
        content: const Text(
          'Both life totals return to their starting values, '
          'history is cleared, and the round timer restarts.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Reset'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      ref.read(lifeTrackerProvider.notifier).resetGame();
      if (context.mounted) Navigator.of(context).pop();
    }
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes;
    return '$m min';
  }
}

class _PlayerSettingsBlock extends StatefulWidget {
  const _PlayerSettingsBlock({
    required this.title,
    required this.titleColor,
    required this.player,
    required this.onPickHero,
    required this.onStartingLife,
  });

  final String title;
  final Color titleColor;
  final PlayerState player;
  final VoidCallback onPickHero;
  final ValueChanged<int> onStartingLife;

  @override
  State<_PlayerSettingsBlock> createState() => _PlayerSettingsBlockState();
}

class _PlayerSettingsBlockState extends State<_PlayerSettingsBlock> {
  late final TextEditingController _lifeController;

  @override
  void initState() {
    super.initState();
    _lifeController = TextEditingController(
      text: '${widget.player.config.startingLife}',
    );
  }

  @override
  void didUpdateWidget(covariant _PlayerSettingsBlock oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = '${widget.player.config.startingLife}';
    if (_lifeController.text != next &&
        !FocusScope.of(context).hasFocus) {
      _lifeController.text = next;
    } else if (oldWidget.player.config.startingLife !=
        widget.player.config.startingLife) {
      _lifeController.text = next;
    }
  }

  @override
  void dispose() {
    _lifeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hero = widget.player.config.heroName;

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.title,
              style: theme.textTheme.titleSmall?.copyWith(
                color: widget.titleColor,
                fontWeight: FontWeight.w700,
              ),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(hero ?? 'Choose hero…'),
              subtitle: hero == null ? const Text('Optional') : null,
              trailing: const Icon(Icons.chevron_right),
              onTap: widget.onPickHero,
            ),
            Row(
              children: [
                Text('Starting life', style: theme.textTheme.bodyMedium),
                const Spacer(),
                IconButton(
                  tooltip: 'Decrease',
                  onPressed: () {
                    final v = (widget.player.config.startingLife - 1)
                        .clamp(0, 1 << 30);
                    widget.onStartingLife(v);
                  },
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                SizedBox(
                  width: 56,
                  child: TextField(
                    controller: _lifeController,
                    textAlign: TextAlign.center,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(
                      isDense: true,
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 8,
                      ),
                    ),
                    onSubmitted: (raw) {
                      final v = int.tryParse(raw);
                      if (v != null) widget.onStartingLife(v.clamp(0, 1 << 30));
                    },
                    onEditingComplete: () {
                      final v = int.tryParse(_lifeController.text);
                      if (v != null) widget.onStartingLife(v.clamp(0, 1 << 30));
                      FocusScope.of(context).unfocus();
                    },
                  ),
                ),
                IconButton(
                  tooltip: 'Increase',
                  onPressed: () {
                    final v = widget.player.config.startingLife + 1;
                    widget.onStartingLife(v);
                  },
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
