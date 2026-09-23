import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../app/theme.dart';
import 'audit_history_sheet.dart';
import 'life_tracker_models.dart';
import 'life_tracker_provider.dart';
import 'tracker_settings_sheet.dart';

class LifeTrackerScreen extends ConsumerStatefulWidget {
  const LifeTrackerScreen({super.key});

  @override
  ConsumerState<LifeTrackerScreen> createState() => _LifeTrackerScreenState();
}

class _LifeTrackerScreenState extends ConsumerState<LifeTrackerScreen> {
  @override
  void initState() {
    super.initState();
    WakelockPlus.enable();
  }

  @override
  void dispose() {
    WakelockPlus.disable();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(lifeTrackerProvider);
    final notifier = ref.read(lifeTrackerProvider.notifier);
    final scheme = Theme.of(context).colorScheme;
    final landscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;

    final opponentPanel = _PlayerLifePanel(
      player: state.opponent,
      onAdjust: (delta) => notifier.adjustLife(opponent: true, delta: delta),
      landscape: landscape,
    );
    final youPanel = _PlayerLifePanel(
      player: state.you,
      onAdjust: (delta) => notifier.adjustLife(opponent: false, delta: delta),
      landscape: landscape,
    );
    final centerBar = _CenterBar(
      remainingSeconds: state.timerRemainingSeconds,
      running: state.timerRunning,
      axis: landscape ? Axis.vertical : Axis.horizontal,
      onToggleTimer: notifier.toggleTimer,
      onHistory: () => showAuditHistorySheet(context),
      onSettings: () => showTrackerSettingsSheet(context),
      onClose: () => Navigator.of(context).pop(),
    );

    return Scaffold(
      backgroundColor: scheme.surface,
      body: SafeArea(
        child: landscape
            // Landscape: both totals upright, opponent left → you right.
            ? Row(
                children: [
                  Expanded(child: opponentPanel),
                  centerBar,
                  Expanded(child: youPanel),
                ],
              )
            // Portrait: opponent on top facing them, you on the bottom.
            : Column(
                children: [
                  Expanded(
                    child: RotatedBox(
                      quarterTurns: 2,
                      child: opponentPanel,
                    ),
                  ),
                  centerBar,
                  Expanded(child: youPanel),
                ],
              ),
      ),
    );
  }
}

class _CenterBar extends StatelessWidget {
  const _CenterBar({
    required this.remainingSeconds,
    required this.running,
    required this.axis,
    required this.onToggleTimer,
    required this.onHistory,
    required this.onSettings,
    required this.onClose,
  });

  final int remainingSeconds;
  final bool running;
  final Axis axis;
  final VoidCallback onToggleTimer;
  final VoidCallback onHistory;
  final VoidCallback onSettings;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final expired = remainingSeconds <= 0;
    final mm = (remainingSeconds ~/ 60).toString().padLeft(2, '0');
    final ss = (remainingSeconds % 60).toString().padLeft(2, '0');

    final timerColor = expired
        ? scheme.error
        : running
            ? scheme.onSurface
            : scheme.onSurfaceVariant;

    final historyBtn = IconButton(
      tooltip: 'History',
      icon: const Icon(Icons.history),
      onPressed: onHistory,
    );
    final settingsBtn = IconButton(
      tooltip: 'Settings',
      icon: const Icon(Icons.settings_outlined),
      onPressed: onSettings,
    );
    final closeBtn = IconButton(
      tooltip: 'Close',
      icon: const Icon(Icons.close),
      onPressed: onClose,
    );
    final timerChip = InkWell(
      onTap: onToggleTimer,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: axis == Axis.vertical
            ? Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    running ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    size: 20,
                    color: timerColor,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$mm\n$ss',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                      fontWeight: FontWeight.w700,
                      color: timerColor,
                      height: 1.15,
                    ),
                  ),
                ],
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    running ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    size: 20,
                    color: timerColor,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '$mm:$ss',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                      fontWeight: FontWeight.w700,
                      color: timerColor,
                    ),
                  ),
                ],
              ),
      ),
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        border: axis == Axis.vertical
            ? Border.symmetric(
                vertical: BorderSide(color: scheme.outline, width: 3),
              )
            : Border.symmetric(
                horizontal: BorderSide(color: scheme.outline, width: 3),
              ),
      ),
      child: axis == Axis.vertical
          ? SizedBox(
              width: 68,
              child: Column(
                children: [
                  historyBtn,
                  Expanded(child: Center(child: timerChip)),
                  settingsBtn,
                  closeBtn,
                ],
              ),
            )
          : SizedBox(
              height: 60,
              child: Row(
                children: [
                  historyBtn,
                  Expanded(child: Center(child: timerChip)),
                  settingsBtn,
                  closeBtn,
                ],
              ),
            ),
    );
  }
}

class _PlayerLifePanel extends StatefulWidget {
  const _PlayerLifePanel({
    required this.player,
    required this.onAdjust,
    this.landscape = false,
  });

  final PlayerState player;
  final ValueChanged<int> onAdjust;
  final bool landscape;

  @override
  State<_PlayerLifePanel> createState() => _PlayerLifePanelState();
}

class _PlayerLifePanelState extends State<_PlayerLifePanel> {
  static const _holdInterval = Duration(milliseconds: 450);
  Timer? _holdTimer;

  void _startHold(int delta) {
    HapticFeedback.selectionClick();
    widget.onAdjust(delta);
    _holdTimer?.cancel();
    _holdTimer = Timer.periodic(_holdInterval, (_) {
      HapticFeedback.selectionClick();
      widget.onAdjust(delta);
    });
  }

  void _endHold() {
    _holdTimer?.cancel();
    _holdTimer = null;
  }

  @override
  void dispose() {
    _holdTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final player = widget.player;
    final pending = player.pendingDelta;
    final lifeSize = widget.landscape ? 96.0 : 120.0;

    final deltaColor =
        pending >= 0 ? AppTheme.positive : AppTheme.negative;
    final deltaText = pending > 0 ? '+$pending' : '$pending';

    return ColoredBox(
      color: scheme.surface,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    widget.onAdjust(-1);
                  },
                  onLongPressStart: (_) => _startHold(-5),
                  onLongPressEnd: (_) => _endHold(),
                  onLongPressCancel: _endHold,
                  child: const Align(
                    alignment: Alignment.centerLeft,
                    child: Padding(
                      padding: EdgeInsets.only(left: 16),
                      child: Opacity(
                        opacity: 0.35,
                        child: Text(
                          '−',
                          style: TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.w300,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    widget.onAdjust(1);
                  },
                  onLongPressStart: (_) => _startHold(5),
                  onLongPressEnd: (_) => _endHold(),
                  onLongPressCancel: _endHold,
                  child: const Align(
                    alignment: Alignment.centerRight,
                    child: Padding(
                      padding: EdgeInsets.only(right: 16),
                      child: Opacity(
                        opacity: 0.35,
                        child: Text(
                          '+',
                          style: TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.w300,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          // Center divider marking − (left) vs + (right) tap zones.
          IgnorePointer(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Row(
                children: [
                  const Spacer(),
                  Container(
                    width: 3,
                    color: scheme.outline.withValues(alpha: 0.85),
                  ),
                  const Spacer(),
                ],
              ),
            ),
          ),
          IgnorePointer(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedOpacity(
                    opacity: pending != 0 ? 1 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: AnimatedSlide(
                      offset: pending != 0
                          ? Offset.zero
                          : const Offset(0, 0.25),
                      duration: const Duration(milliseconds: 200),
                      child: Text(
                        pending == 0 ? ' ' : deltaText,
                        style: theme.textTheme.headlineMedium?.copyWith(
                          color: deltaColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  Text(
                    '${player.life}',
                    style: theme.textTheme.displayLarge?.copyWith(
                      fontSize: lifeSize,
                      fontWeight: FontWeight.w900,
                      height: 1.0,
                      letterSpacing: -1.5,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
