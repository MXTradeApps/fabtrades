/// When to ask for an App Store / Play Store rating — pure, unit-testable
/// without SharedPreferences or the platform plugin.
///
/// The system sheet is only requested right after a positive moment (a
/// confirmed trade, a scan that locked onto a card), never while a trade is
/// being built: the table is the deadline, and a modal over a half-built trade
/// costs the user more than a rating is worth. Apple additionally caps the
/// sheet at 3 displays a year and may silently show nothing; [cooldown] keeps
/// us well inside that so the requests we do make are likely to be shown.
class ReviewPromptPolicy {
  const ReviewPromptPolicy._();

  /// Confirmed trades since the last prompt before a trade can trigger it.
  static const tradesBeforePrompt = 3;

  /// Locked scan matches since the last prompt before a scan can trigger it.
  static const scanMatchesBeforePrompt = 2;

  /// Minimum gap between two requests.
  static const cooldown = Duration(days: 60);

  /// Minimum time since the first positive moment was recorded, so the
  /// session in which someone starts using the app never prompts.
  static const minAgeSinceFirstSeen = Duration(days: 1);

  /// No prompt this soon after something went wrong (e.g. the camera failed).
  static const quietAfterError = Duration(days: 1);

  /// Whether a positive moment that just produced [state] should request the
  /// rating sheet. [tradeInProgress] is true while the trade draft holds cards
  /// (or the moment happened inside a trade flow).
  static bool shouldPrompt(
    ReviewPromptState state, {
    required DateTime now,
    required bool tradeInProgress,
  }) {
    if (tradeInProgress) return false;

    final firstSeen = state.firstSeenAt;
    if (firstSeen == null) return false;
    if (now.difference(firstSeen) < minAgeSinceFirstSeen) return false;

    final lastError = state.lastErrorAt;
    if (lastError != null && now.difference(lastError) < quietAfterError) {
      return false;
    }

    final lastPrompt = state.lastPromptAt;
    if (lastPrompt != null && now.difference(lastPrompt) < cooldown) {
      return false;
    }

    return state.confirmedTrades >= tradesBeforePrompt ||
        state.scanMatches >= scanMatchesBeforePrompt;
  }
}

/// Local-only counters behind [ReviewPromptPolicy]. Not part of cloud sync:
/// rating eligibility is per device, like the onboarding tours.
class ReviewPromptState {
  const ReviewPromptState({
    this.firstSeenAt,
    this.confirmedTrades = 0,
    this.scanMatches = 0,
    this.lastPromptAt,
    this.lastErrorAt,
  });

  /// First positive moment (or error) recorded on this device.
  final DateTime? firstSeenAt;

  /// Confirmed trades since the last prompt.
  final int confirmedTrades;

  /// Locked scan matches since the last prompt.
  final int scanMatches;

  final DateTime? lastPromptAt;
  final DateTime? lastErrorAt;

  ReviewPromptState _seen(DateTime now) =>
      firstSeenAt == null ? _copy(firstSeenAt: now) : this;

  ReviewPromptState withTradeConfirmed(DateTime now) =>
      _seen(now)._copy(confirmedTrades: confirmedTrades + 1);

  ReviewPromptState withScanMatch(DateTime now) =>
      _seen(now)._copy(scanMatches: scanMatches + 1);

  ReviewPromptState withError(DateTime now) =>
      _seen(now)._copy(lastErrorAt: now);

  /// After a request, counting starts over so the next prompt needs fresh
  /// positive moments, not just the cooldown elapsing.
  ReviewPromptState withPrompted(DateTime now) => ReviewPromptState(
        firstSeenAt: firstSeenAt ?? now,
        lastPromptAt: now,
        lastErrorAt: lastErrorAt,
      );

  ReviewPromptState _copy({
    DateTime? firstSeenAt,
    int? confirmedTrades,
    int? scanMatches,
    DateTime? lastErrorAt,
  }) =>
      ReviewPromptState(
        firstSeenAt: firstSeenAt ?? this.firstSeenAt,
        confirmedTrades: confirmedTrades ?? this.confirmedTrades,
        scanMatches: scanMatches ?? this.scanMatches,
        lastPromptAt: lastPromptAt,
        lastErrorAt: lastErrorAt ?? this.lastErrorAt,
      );

  Map<String, dynamic> toJson() => {
        if (firstSeenAt != null) 'firstSeenAt': firstSeenAt!.toIso8601String(),
        'confirmedTrades': confirmedTrades,
        'scanMatches': scanMatches,
        if (lastPromptAt != null)
          'lastPromptAt': lastPromptAt!.toIso8601String(),
        if (lastErrorAt != null) 'lastErrorAt': lastErrorAt!.toIso8601String(),
      };

  /// Tolerates missing or malformed fields; a corrupt blob reads as fresh.
  factory ReviewPromptState.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) {
      final v = json[key];
      return v is String ? DateTime.tryParse(v) : null;
    }

    int count(String key) {
      final v = json[key];
      return v is int && v > 0 ? v : 0;
    }

    return ReviewPromptState(
      firstSeenAt: date('firstSeenAt'),
      confirmedTrades: count('confirmedTrades'),
      scanMatches: count('scanMatches'),
      lastPromptAt: date('lastPromptAt'),
      lastErrorAt: date('lastErrorAt'),
    );
  }
}
