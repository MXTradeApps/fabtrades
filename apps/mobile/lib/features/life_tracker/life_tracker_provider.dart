import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stop_watch_timer/stop_watch_timer.dart';

import '../../core/providers.dart';
import 'life_tracker_models.dart';
import 'life_tracker_repository.dart';

final lifeTrackerRepositoryProvider = Provider<LifeTrackerRepository>(
  (ref) => LifeTrackerRepository(ref.watch(sharedPreferencesProvider)),
);

class LifeTrackerNotifier extends Notifier<LifeTrackerState> {
  static const settleDelay = Duration(milliseconds: 2500);

  Timer? _youSettle;
  Timer? _opponentSettle;
  StopWatchTimer? _clock;

  LifeTrackerRepository get _repo => ref.read(lifeTrackerRepositoryProvider);

  @override
  LifeTrackerState build() {
    ref.onDispose(() {
      _youSettle?.cancel();
      _opponentSettle?.cancel();
      _disposeClock();
    });

    final loaded = ref.watch(lifeTrackerRepositoryProvider).load();
    final restored = _restoreTimer(loaded ?? LifeTrackerState.fresh());
    _bindClock(
      remainingSeconds: restored.timerRemainingSeconds,
      running: restored.timerRunning,
    );
    return restored;
  }

  /// Seed the library after a process kill: subtract time the app was dead.
  static LifeTrackerState _restoreTimer(LifeTrackerState s) {
    if (!s.timerRunning || s.timerRunningSince == null) {
      return s.copyWith(timerRunning: false, timerRunningSince: null);
    }
    final elapsed =
        DateTime.now().difference(s.timerRunningSince!).inSeconds;
    final remaining = (s.timerRemainingSeconds - elapsed).clamp(0, 1 << 30);
    if (remaining == 0) {
      return s.copyWith(
        timerRemainingSeconds: 0,
        timerRunning: false,
        timerRunningSince: null,
      );
    }
    return s.copyWith(
      timerRemainingSeconds: remaining,
      timerRunning: true,
      timerRunningSince: DateTime.now(),
    );
  }

  void _disposeClock() {
    final clock = _clock;
    _clock = null;
    if (clock == null) return;
    clock.onStopTimer();
    unawaited(clock.dispose());
  }

  /// Recreate the countdown at [remainingSeconds] and optionally start it.
  void _bindClock({required int remainingSeconds, required bool running}) {
    _disposeClock();
    final clock = StopWatchTimer(
      mode: StopWatchMode.countDown,
      presetMillisecond: StopWatchTimer.getMilliSecFromSecond(remainingSeconds),
      refreshTime: 200,
      onChangeRawSecond: _onClockSecond,
      onEnded: _onClockEnded,
    );
    _clock = clock;
    if (running && remainingSeconds > 0) {
      clock.onStartTimer();
    }
  }

  void _onClockSecond(int seconds) {
    if (_clock == null) return;
    if (seconds == state.timerRemainingSeconds) return;
    state = state.copyWith(timerRemainingSeconds: seconds);
  }

  void _onClockEnded() {
    if (_clock == null) return;
    state = state.copyWith(
      timerRemainingSeconds: 0,
      timerRunning: false,
      timerRunningSince: null,
    );
    _persist();
  }

  int _clockRemainingSeconds() {
    final ms = _clock?.rawTime.value;
    if (ms == null) return state.timerRemainingSeconds;
    return StopWatchTimer.getRawSecond(ms);
  }

  Future<void> _persist() => _repo.save(state);

  void adjustLife({required bool opponent, required int delta}) {
    final player = opponent ? state.opponent : state.you;
    final newLife = (player.life + delta).clamp(0, 1 << 30);
    final applied = newLife - player.life;
    if (applied == 0 && delta < 0 && player.life == 0) {
      // Still restart settle so a pending positive can settle, but no change.
      if (player.pendingDelta == 0) return;
    }

    final nextPending = player.pendingDelta + applied;
    final next = player.copyWith(
      life: newLife,
      pendingDelta: nextPending,
      // lifeBeforePending stays until settle when this is the first change.
      lifeBeforePending: player.pendingDelta == 0
          ? player.life
          : player.lifeBeforePending,
    );

    state = opponent
        ? state.copyWith(opponent: next)
        : state.copyWith(you: next);

    _restartSettle(opponent);
  }

  void _restartSettle(bool opponent) {
    final timer = Timer(settleDelay, () => commitPending(opponent));
    if (opponent) {
      _opponentSettle?.cancel();
      _opponentSettle = timer;
    } else {
      _youSettle?.cancel();
      _youSettle = timer;
    }
  }

  void commitPending(bool opponent) {
    final player = opponent ? state.opponent : state.you;
    if (player.pendingDelta == 0) {
      final cleared = player.copyWith(
        pendingDelta: 0,
        lifeBeforePending: player.life,
      );
      state = opponent
          ? state.copyWith(opponent: cleared)
          : state.copyWith(you: cleared);
      return;
    }

    final delta = player.pendingDelta;
    final from = player.lifeBeforePending;
    final to = player.life;
    final settled = player.copyWith(
      pendingDelta: 0,
      lifeBeforePending: to,
    );

    var history = state.history;
    if (delta != 0) {
      history = [
        ...history,
        LifeChangeEntry(
          isOpponent: opponent,
          from: from,
          to: to,
          delta: delta,
          at: DateTime.now(),
        ),
      ];
    }

    state = opponent
        ? state.copyWith(opponent: settled, history: history)
        : state.copyWith(you: settled, history: history);
    _persist();
  }

  void toggleTimer() {
    if (state.timerRemainingSeconds <= 0 && !state.timerRunning) {
      return;
    }
    if (state.timerRunning) {
      _clock?.onStopTimer();
      state = state.copyWith(
        timerRemainingSeconds: _clockRemainingSeconds(),
        timerRunning: false,
        timerRunningSince: null,
      );
    } else {
      state = state.copyWith(
        timerRunning: true,
        timerRunningSince: DateTime.now(),
      );
      _clock?.onStartTimer();
    }
    _persist();
  }

  void setFormat(LifeFormat format) {
    if (format == state.format) return;
    var you = state.you;
    var opponent = state.opponent;

    // Update default starting life only for players without a hero.
    if (you.config.heroName == null) {
      final cfg =
          you.config.copyWith(startingLife: format.defaultStartingLife);
      you = you.copyWith(config: cfg);
      if (state.isPristine) {
        you = PlayerState.fresh(cfg);
      }
    }
    if (opponent.config.heroName == null) {
      final cfg =
          opponent.config.copyWith(startingLife: format.defaultStartingLife);
      opponent = opponent.copyWith(config: cfg);
      if (state.isPristine) {
        opponent = PlayerState.fresh(cfg);
      }
    }

    state = state.copyWith(
      format: format,
      you: you,
      opponent: opponent,
      timerRemainingSeconds: format.roundSeconds,
      timerRunning: false,
      timerRunningSince: null,
    );
    _bindClock(remainingSeconds: format.roundSeconds, running: false);
    _persist();
  }

  void setHero({
    required bool opponent,
    String? heroName,
    int? life,
  }) {
    final player = opponent ? state.opponent : state.you;
    final starting = life ?? player.config.startingLife;
    final cfg = player.config.copyWith(
      heroName: heroName,
      startingLife: starting,
    );

    PlayerState next;
    if (state.isPristine) {
      next = PlayerState.fresh(cfg);
    } else {
      next = player.copyWith(config: cfg);
    }

    state = opponent
        ? state.copyWith(opponent: next)
        : state.copyWith(you: next);
    _persist();
  }

  void setStartingLife({required bool opponent, required int life}) {
    final clamped = life.clamp(0, 1 << 30);
    final player = opponent ? state.opponent : state.you;
    final cfg = player.config.copyWith(startingLife: clamped);

    PlayerState next;
    if (state.isPristine) {
      next = PlayerState.fresh(cfg);
    } else {
      next = player.copyWith(config: cfg);
    }

    state = opponent
        ? state.copyWith(opponent: next)
        : state.copyWith(you: next);
    _persist();
  }

  void resetGame() {
    _youSettle?.cancel();
    _opponentSettle?.cancel();

    final remaining = state.format.roundSeconds;
    state = LifeTrackerState(
      format: state.format,
      you: PlayerState.fresh(state.you.config),
      opponent: PlayerState.fresh(state.opponent.config),
      history: const [],
      timerRemainingSeconds: remaining,
      timerRunning: true,
      timerRunningSince: DateTime.now(),
    );
    _bindClock(remainingSeconds: remaining, running: true);
    _persist();
  }
}

final lifeTrackerProvider =
    NotifierProvider<LifeTrackerNotifier, LifeTrackerState>(
  LifeTrackerNotifier.new,
);
