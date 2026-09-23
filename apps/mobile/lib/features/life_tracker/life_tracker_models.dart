/// Formats, player state, and match state for the life tracker.
library;

enum LifeFormat {
  cc,
  silverAge;

  String get label => switch (this) {
        LifeFormat.cc => 'Classic Constructed',
        LifeFormat.silverAge => 'Silver Age / Limited',
      };

  /// Short label for segmented controls.
  String get shortLabel => switch (this) {
        LifeFormat.cc => 'CC',
        LifeFormat.silverAge => 'Silver Age/Limited',
      };

  Duration get roundDuration => switch (this) {
        LifeFormat.cc => const Duration(minutes: 55),
        LifeFormat.silverAge => const Duration(minutes: 35),
      };

  int get defaultStartingLife => switch (this) {
        LifeFormat.cc => 40,
        LifeFormat.silverAge => 20,
      };

  int get roundSeconds => roundDuration.inSeconds;

  static LifeFormat fromName(String? name) {
    for (final f in LifeFormat.values) {
      if (f.name == name) return f;
    }
    return LifeFormat.cc;
  }
}

class PlayerConfig {
  const PlayerConfig({
    this.heroName,
    this.startingLife = 40,
  });

  final String? heroName;
  final int startingLife;

  PlayerConfig copyWith({
    Object? heroName = _sentinel,
    int? startingLife,
  }) =>
      PlayerConfig(
        heroName: heroName == _sentinel ? this.heroName : heroName as String?,
        startingLife: startingLife ?? this.startingLife,
      );

  Map<String, dynamic> toJson() => {
        'heroName': heroName,
        'startingLife': startingLife,
      };

  factory PlayerConfig.fromJson(Map<String, dynamic> json) => PlayerConfig(
        heroName: json['heroName'] as String?,
        startingLife: (json['startingLife'] as num?)?.toInt() ?? 40,
      );

  static const _sentinel = Object();
}

class PlayerState {
  const PlayerState({
    required this.config,
    required this.life,
    this.pendingDelta = 0,
    required this.lifeBeforePending,
  });

  final PlayerConfig config;
  final int life;

  /// Accumulated change since the last settle; not persisted across restarts.
  final int pendingDelta;
  final int lifeBeforePending;

  PlayerState copyWith({
    PlayerConfig? config,
    int? life,
    int? pendingDelta,
    int? lifeBeforePending,
  }) =>
      PlayerState(
        config: config ?? this.config,
        life: life ?? this.life,
        pendingDelta: pendingDelta ?? this.pendingDelta,
        lifeBeforePending: lifeBeforePending ?? this.lifeBeforePending,
      );

  /// Fresh player at [config.startingLife] with no pending delta.
  factory PlayerState.fresh(PlayerConfig config) => PlayerState(
        config: config,
        life: config.startingLife,
        pendingDelta: 0,
        lifeBeforePending: config.startingLife,
      );

  Map<String, dynamic> toJson() => {
        'config': config.toJson(),
        'life': life,
        // pendingDelta is transient — always restore as 0.
        'pendingDelta': 0,
        'lifeBeforePending': life,
      };

  factory PlayerState.fromJson(Map<String, dynamic> json) {
    final config = PlayerConfig.fromJson(
      (json['config'] as Map?)?.cast<String, dynamic>() ?? const {},
    );
    final life = (json['life'] as num?)?.toInt() ?? config.startingLife;
    return PlayerState(
      config: config,
      life: life,
      pendingDelta: 0,
      lifeBeforePending:
          (json['lifeBeforePending'] as num?)?.toInt() ?? life,
    );
  }
}

class LifeChangeEntry {
  const LifeChangeEntry({
    required this.isOpponent,
    required this.from,
    required this.to,
    required this.delta,
    required this.at,
  });

  final bool isOpponent;
  final int from;
  final int to;
  final int delta;
  final DateTime at;

  Map<String, dynamic> toJson() => {
        'isOpponent': isOpponent,
        'from': from,
        'to': to,
        'delta': delta,
        'at': at.toIso8601String(),
      };

  factory LifeChangeEntry.fromJson(Map<String, dynamic> json) =>
      LifeChangeEntry(
        isOpponent: json['isOpponent'] as bool? ?? false,
        from: (json['from'] as num?)?.toInt() ?? 0,
        to: (json['to'] as num?)?.toInt() ?? 0,
        delta: (json['delta'] as num?)?.toInt() ?? 0,
        at: DateTime.tryParse(json['at'] as String? ?? '') ?? DateTime.now(),
      );
}

class LifeTrackerState {
  const LifeTrackerState({
    required this.format,
    required this.you,
    required this.opponent,
    this.history = const [],
    required this.timerRemainingSeconds,
    this.timerRunning = false,
    this.timerRunningSince,
  });

  final LifeFormat format;
  final PlayerState you;
  final PlayerState opponent;
  final List<LifeChangeEntry> history;
  final int timerRemainingSeconds;
  final bool timerRunning;
  final DateTime? timerRunningSince;

  /// True when nothing has been played yet this match.
  bool get isPristine =>
      history.isEmpty &&
      you.life == you.config.startingLife &&
      opponent.life == opponent.config.startingLife &&
      you.pendingDelta == 0 &&
      opponent.pendingDelta == 0;

  LifeTrackerState copyWith({
    LifeFormat? format,
    PlayerState? you,
    PlayerState? opponent,
    List<LifeChangeEntry>? history,
    int? timerRemainingSeconds,
    bool? timerRunning,
    Object? timerRunningSince = _sentinel,
  }) =>
      LifeTrackerState(
        format: format ?? this.format,
        you: you ?? this.you,
        opponent: opponent ?? this.opponent,
        history: history ?? this.history,
        timerRemainingSeconds:
            timerRemainingSeconds ?? this.timerRemainingSeconds,
        timerRunning: timerRunning ?? this.timerRunning,
        timerRunningSince: timerRunningSince == _sentinel
            ? this.timerRunningSince
            : timerRunningSince as DateTime?,
      );

  /// Brand-new Classic Constructed match.
  factory LifeTrackerState.fresh({LifeFormat format = LifeFormat.cc}) {
    final you = PlayerState.fresh(
      PlayerConfig(startingLife: format.defaultStartingLife),
    );
    final opponent = PlayerState.fresh(
      PlayerConfig(startingLife: format.defaultStartingLife),
    );
    return LifeTrackerState(
      format: format,
      you: you,
      opponent: opponent,
      timerRemainingSeconds: format.roundSeconds,
    );
  }

  Map<String, dynamic> toJson() => {
        'format': format.name,
        'you': you.toJson(),
        'opponent': opponent.toJson(),
        'history': history.map((e) => e.toJson()).toList(),
        'timerRemainingSeconds': timerRemainingSeconds,
        'timerRunning': timerRunning,
        'timerRunningSince': timerRunningSince?.toIso8601String(),
      };

  factory LifeTrackerState.fromJson(Map<String, dynamic> json) {
    final format = LifeFormat.fromName(json['format'] as String?);
    return LifeTrackerState(
      format: format,
      you: PlayerState.fromJson(
        (json['you'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      opponent: PlayerState.fromJson(
        (json['opponent'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      history: (json['history'] as List?)
              ?.whereType<Map>()
              .map((e) => LifeChangeEntry.fromJson(e.cast<String, dynamic>()))
              .toList() ??
          const [],
      timerRemainingSeconds:
          (json['timerRemainingSeconds'] as num?)?.toInt() ??
              format.roundSeconds,
      timerRunning: json['timerRunning'] as bool? ?? false,
      timerRunningSince: json['timerRunningSince'] != null
          ? DateTime.tryParse(json['timerRunningSince'] as String)
          : null,
    );
  }

  static const _sentinel = Object();
}
