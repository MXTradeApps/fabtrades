import 'package:fabtrades/core/data/review_prompt_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late SharedPreferences prefs;
  late DateTime now;
  late int requests;
  late bool available;
  late bool requestThrows;

  ReviewPromptRepository repo() => ReviewPromptRepository(
        prefs,
        isAvailable: () async => available,
        requestReview: () async {
          requests++;
          if (requestThrows) throw StateError('no plugin');
        },
        clock: () => now,
      );

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    now = DateTime.utc(2026, 1, 1);
    requests = 0;
    available = true;
    requestThrows = false;
  });

  test('counters persist across instances and the 3rd trade prompts', () async {
    await repo().recordTradeConfirmed();
    now = now.add(const Duration(days: 2));
    await repo().recordTradeConfirmed();
    expect(requests, 0);

    expect(await repo().recordTradeConfirmed(), isTrue);
    expect(requests, 1);

    final state = repo().load();
    expect(state.lastPromptAt, now);
    expect(state.confirmedTrades, 0);
  });

  test('scan inside a trade never prompts, but still counts', () async {
    await repo().recordScanMatch(tradeInProgress: false);
    now = now.add(const Duration(days: 2));
    expect(await repo().recordScanMatch(tradeInProgress: true), isFalse);
    expect(requests, 0);
    expect(repo().load().scanMatches, 2);

    expect(await repo().recordScanMatch(tradeInProgress: false), isTrue);
    expect(requests, 1);
  });

  test('a recent error blocks the prompt', () async {
    await repo().recordScanMatch(tradeInProgress: false);
    now = now.add(const Duration(days: 2));
    await repo().recordError();
    expect(await repo().recordScanMatch(tradeInProgress: false), isFalse);
    expect(requests, 0);
  });

  test('unavailable store keeps counting without stamping a prompt', () async {
    available = false;
    await repo().recordScanMatch(tradeInProgress: false);
    now = now.add(const Duration(days: 2));
    expect(await repo().recordScanMatch(tradeInProgress: false), isFalse);
    expect(requests, 0);
    expect(repo().load().lastPromptAt, isNull);
    expect(repo().load().scanMatches, 2);
  });

  test('a throwing plugin is swallowed and still starts the cooldown',
      () async {
    requestThrows = true;
    await repo().recordScanMatch(tradeInProgress: false);
    now = now.add(const Duration(days: 2));
    expect(await repo().recordScanMatch(tradeInProgress: false), isTrue);
    expect(repo().load().lastPromptAt, now);
  });

  test('corrupt storage reads as fresh', () async {
    await prefs.setString(ReviewPromptRepository.storageKey, '{not json');
    expect(repo().load().confirmedTrades, 0);
  });
}
