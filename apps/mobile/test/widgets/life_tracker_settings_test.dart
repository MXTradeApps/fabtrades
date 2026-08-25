import 'dart:convert';

import 'package:fabtrades/app/theme.dart';
import 'package:fabtrades/features/life_tracker/life_tracker_models.dart';
import 'package:fabtrades/features/life_tracker/tracker_settings_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/harness.dart';

void main() {
  testWidgets('settings put Opponent above You with matching colors',
      (tester) async {
    await pumpApp(
      tester,
      Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () => showTrackerSettingsSheet(context),
            child: const Text('Open settings'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open settings'));
    await tester.pumpAndSettle();

    final opponent = tester.getTopLeft(find.text('Opponent'));
    final you = tester.getTopLeft(find.text('You'));
    expect(opponent.dy, lessThan(you.dy));

    expect(
      tester.widget<Text>(find.text('You')).style?.color,
      AppTheme.positive,
    );
    expect(
      tester.widget<Text>(find.text('Opponent')).style?.color,
      AppTheme.negative,
    );
    expect(find.text('Starting life from hero'), findsNothing);
  });

  testWidgets('hero pick does not show Starting life from hero', (tester) async {
    final persisted = LifeTrackerState.fresh().copyWith(
      you: const PlayerState(
        config: PlayerConfig(heroName: 'Bravo', startingLife: 40),
        life: 40,
        lifeBeforePending: 40,
      ),
    );
    await pumpApp(
      tester,
      Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () => showTrackerSettingsSheet(context),
            child: const Text('Open settings'),
          ),
        ),
      ),
      seed: {
        'life_tracker_state': jsonEncode(persisted.toJson()),
      },
    );

    await tester.tap(find.text('Open settings'));
    await tester.pumpAndSettle();

    expect(find.text('Bravo'), findsOneWidget);
    expect(find.text('Starting life from hero'), findsNothing);
    expect(find.text('Optional'), findsOneWidget);
  });
}
