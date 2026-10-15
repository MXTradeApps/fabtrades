import 'dart:convert';

import 'package:in_app_review/in_app_review.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../logic/review_prompt.dart';

/// Records positive moments and errors, and requests the system rating sheet
/// when [ReviewPromptPolicy] allows it.
///
/// Stored under its own SharedPreferences key (not [AppSettings]) so it stays
/// per device and a remote settings row can never reset the cooldown.
class ReviewPromptRepository {
  ReviewPromptRepository(
    this._prefs, {
    Future<bool> Function()? isAvailable,
    Future<void> Function()? requestReview,
    DateTime Function()? clock,
  })  : _isAvailable = isAvailable ?? InAppReview.instance.isAvailable,
        _requestReview = requestReview ?? InAppReview.instance.requestReview,
        _clock = clock ?? DateTime.now;

  final SharedPreferences _prefs;
  final Future<bool> Function() _isAvailable;
  final Future<void> Function() _requestReview;
  final DateTime Function() _clock;

  static const storageKey = 'review_prompt_v1';

  ReviewPromptState load() {
    final raw = _prefs.getString(storageKey);
    if (raw == null) return const ReviewPromptState();
    try {
      return ReviewPromptState.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const ReviewPromptState();
    }
  }

  Future<void> _save(ReviewPromptState state) =>
      _prefs.setString(storageKey, jsonEncode(state.toJson()));

  /// Call after Confirm Trade has saved the trade and cleared the draft.
  /// Returns whether the rating sheet was requested.
  Future<bool> recordTradeConfirmed() {
    final now = _clock();
    return _recordPositive(load().withTradeConfirmed(now), now,
        tradeInProgress: false);
  }

  /// Call when the scanner locks onto a card. Pass [tradeInProgress] true when
  /// the scan feeds the trade draft or the draft already holds cards.
  Future<bool> recordScanMatch({required bool tradeInProgress}) {
    final now = _clock();
    return _recordPositive(load().withScanMatch(now), now,
        tradeInProgress: tradeInProgress);
  }

  /// Call when a user-visible failure happens (e.g. the camera failed to open).
  Future<void> recordError() => _save(load().withError(_clock()));

  Future<bool> _recordPositive(
    ReviewPromptState state,
    DateTime now, {
    required bool tradeInProgress,
  }) async {
    if (!ReviewPromptPolicy.shouldPrompt(state,
        now: now, tradeInProgress: tradeInProgress)) {
      await _save(state);
      return false;
    }
    // Plugin failures (tests, unsupported platform) are never surfaced.
    var available = false;
    try {
      available = await _isAvailable();
    } catch (_) {}
    if (!available) {
      await _save(state);
      return false;
    }
    // Stamp before asking: the OS decides whether anything shows, and a
    // failed or suppressed request still counts against the cooldown.
    await _save(state.withPrompted(now));
    try {
      await _requestReview();
    } catch (_) {}
    return true;
  }
}
