import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/life_tracker/hero_picker.dart';
import 'package:fabtrades/features/life_tracker/life_tracker_models.dart';
import 'package:fabtrades/features/life_tracker/life_tracker_provider.dart';
import 'package:fabtrades/features/life_tracker/life_tracker_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<ProviderContainer> container({
    Map<String, Object> seed = const {},
  }) async {
    SharedPreferences.setMockInitialValues(seed);
    final prefs = await SharedPreferences.getInstance();
    final c = ProviderContainer(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    );
    addTearDown(c.dispose);
    return c;
  }

  group('LifeTrackerState JSON', () {
    test('round-trips and clears pendingDelta on deserialize', () {
      final original = LifeTrackerState.fresh().copyWith(
        you: PlayerState(
          config: const PlayerConfig(heroName: 'Bravo', startingLife: 40),
          life: 37,
          pendingDelta: -3,
          lifeBeforePending: 40,
        ),
        history: [
          LifeChangeEntry(
            isOpponent: false,
            from: 40,
            to: 37,
            delta: -3,
            at: DateTime.utc(2026, 1, 1, 12),
          ),
        ],
      );
      final restored = LifeTrackerState.fromJson(original.toJson());
      expect(restored.you.life, 37);
      expect(restored.you.pendingDelta, 0);
      expect(restored.you.config.heroName, 'Bravo');
      expect(restored.history, hasLength(1));
      expect(restored.history.first.delta, -3);
    });
  });

  group('LifeTrackerRepository', () {
    test('caps history at 200', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final repo = LifeTrackerRepository(prefs);

      final history = List.generate(
        250,
        (i) => LifeChangeEntry(
          isOpponent: false,
          from: 40 - i,
          to: 39 - i,
          delta: -1,
          at: DateTime.utc(2026, 1, 1).add(Duration(seconds: i)),
        ),
      );
      await repo.save(LifeTrackerState.fresh().copyWith(history: history));
      final loaded = repo.load()!;
      expect(loaded.history, hasLength(200));
      expect(loaded.history.first.from, 40 - 50);
      expect(loaded.history.last.delta, -1);
    });
  });

  group('LifeTrackerNotifier', () {
    test('defaults to CC at 40 / 55:00', () async {
      final c = await container();
      final state = c.read(lifeTrackerProvider);
      expect(state.format, LifeFormat.cc);
      expect(state.you.life, 40);
      expect(state.opponent.life, 40);
      expect(state.timerRemainingSeconds, 55 * 60);
      expect(state.timerRunning, isFalse);
    });

    test('adjustLife clamps at 0 and accumulates pendingDelta', () async {
      final c = await container();
      final n = c.read(lifeTrackerProvider.notifier);

      n.adjustLife(opponent: false, delta: -1);
      n.adjustLife(opponent: false, delta: -1);
      expect(c.read(lifeTrackerProvider).you.life, 38);
      expect(c.read(lifeTrackerProvider).you.pendingDelta, -2);
      expect(c.read(lifeTrackerProvider).history, isEmpty);

      // Drive to 0.
      for (var i = 0; i < 100; i++) {
        n.adjustLife(opponent: false, delta: -5);
      }
      expect(c.read(lifeTrackerProvider).you.life, 0);
    });

    test('commitPending records one entry; net-zero is skipped', () async {
      final c = await container();
      final n = c.read(lifeTrackerProvider.notifier);

      n.adjustLife(opponent: false, delta: -1);
      n.adjustLife(opponent: false, delta: -2);
      n.commitPending(false);

      var state = c.read(lifeTrackerProvider);
      expect(state.you.pendingDelta, 0);
      expect(state.history, hasLength(1));
      expect(state.history.first.from, 40);
      expect(state.history.first.to, 37);
      expect(state.history.first.delta, -3);

      n.adjustLife(opponent: true, delta: 1);
      n.adjustLife(opponent: true, delta: -1);
      n.commitPending(true);
      state = c.read(lifeTrackerProvider);
      expect(state.history, hasLength(1)); // net-zero not recorded
      expect(state.opponent.life, 40);
    });

    test('setFormat resets timer and switches to Silver Age duration', () async {
      final c = await container();
      final n = c.read(lifeTrackerProvider.notifier);
      n.setFormat(LifeFormat.silverAge);
      final state = c.read(lifeTrackerProvider);
      expect(state.format, LifeFormat.silverAge);
      expect(state.timerRemainingSeconds, 35 * 60);
      expect(state.timerRunning, isFalse);
    });

    test('toggleTimer starts and pause keeps remaining from the clock', () async {
      final c = await container();
      final n = c.read(lifeTrackerProvider.notifier);
      n.toggleTimer();
      expect(c.read(lifeTrackerProvider).timerRunning, isTrue);
      expect(c.read(lifeTrackerProvider).timerRunningSince, isNotNull);

      n.toggleTimer();
      expect(c.read(lifeTrackerProvider).timerRunning, isFalse);
      expect(c.read(lifeTrackerProvider).timerRemainingSeconds, 55 * 60);
    });

    test('resetGame restores starting lives, clears history, and starts timer',
        () async {
      final c = await container();
      final n = c.read(lifeTrackerProvider.notifier);
      n.setHero(opponent: false, heroName: 'Bravo', life: 40);
      n.adjustLife(opponent: false, delta: -5);
      n.commitPending(false);
      n.resetGame();

      final state = c.read(lifeTrackerProvider);
      expect(state.you.life, 40);
      expect(state.you.config.heroName, 'Bravo');
      expect(state.history, isEmpty);
      expect(state.timerRemainingSeconds, 55 * 60);
      expect(state.timerRunning, isTrue);
      expect(state.timerRunningSince, isNotNull);
    });

    test('restores running timer by subtracting wall-clock elapsed', () async {
      final started = DateTime.now().subtract(const Duration(seconds: 90));
      final persisted = LifeTrackerState.fresh().copyWith(
        timerRemainingSeconds: 55 * 60,
        timerRunning: true,
        timerRunningSince: started,
      );
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      await LifeTrackerRepository(prefs).save(persisted);

      final c = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(c.dispose);

      final state = c.read(lifeTrackerProvider);
      expect(state.timerRunning, isTrue);
      // ~90s elapsed; allow a little slack for test runtime.
      expect(state.timerRemainingSeconds, lessThanOrEqualTo(55 * 60 - 89));
      expect(state.timerRemainingSeconds, greaterThan(55 * 60 - 95));
    });
  });

  group('hero picker filtering', () {
    const youngBravo = CardModel(
      id: '1',
      name: 'Bravo',
      cardType: 'Hero',
      cardSubType: 'Young',
      life: '20',
    );
    const adultBravo = CardModel(
      id: '2',
      name: 'Bravo, Showstopper',
      cardType: 'Hero',
      life: '40',
    );
    const weaponHero = CardModel(
      id: '3',
      name: 'Anothos // Bravo',
      cardType: 'Hero;Weapon',
      cardSubType: 'Hammer (2H);Young',
      life: '20',
      rarity: 'Token',
    );
    const slashName = CardModel(
      id: '4',
      name: 'Something // Else',
      cardType: 'Hero',
      life: '40',
    );

    test('excludes Hero;Weapon and // combo names', () {
      expect(isPlayableHeroCard(youngBravo), isTrue);
      expect(isPlayableHeroCard(adultBravo), isTrue);
      expect(isPlayableHeroCard(weaponHero), isFalse);
      expect(isPlayableHeroCard(slashName), isFalse);
    });

    test('CC lists adult heroes only; Silver Age lists young only', () {
      final catalog = [youngBravo, adultBravo, weaponHero, slashName];
      final cc = buildHeroOptions(catalog, LifeFormat.cc);
      final sa = buildHeroOptions(catalog, LifeFormat.silverAge);

      expect(cc.map((h) => h.name), ['Bravo, Showstopper']);
      expect(sa.map((h) => h.name), ['Bravo']);
      expect(cc.single.life, 40);
      expect(sa.single.life, 20);
    });

    test('corrects swapped life/intellect (Aurora-style TCGplayer data)', () {
      const aurora = CardModel(
        id: 'aurora',
        name: 'Aurora, Legacy of Tempest',
        cardType: 'Hero',
        life: '4',
        intellect: '40',
      );
      const youngSwapped = CardModel(
        id: 'young-swap',
        name: 'Aurora',
        cardType: 'Hero',
        cardSubType: 'Young',
        life: '4',
        intellect: '20',
      );

      expect(resolvedHeroLife(aurora), 40);
      expect(resolvedHeroLife(youngSwapped), 20);
      expect(resolvedHeroLife(adultBravo), 40);

      final cc = buildHeroOptions([aurora, youngSwapped], LifeFormat.cc);
      expect(cc.single.name, 'Aurora, Legacy of Tempest');
      expect(cc.single.life, 40);
    });
  });
}
