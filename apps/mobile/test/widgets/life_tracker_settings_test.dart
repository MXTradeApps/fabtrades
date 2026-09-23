import 'package:fabtrades/features/life_tracker/life_tracker_models.dart';
import 'package:fabtrades/features/life_tracker/life_tracker_provider.dart';
import 'package:fabtrades/features/life_tracker/tracker_settings_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/harness.dart';

void main() {
  testWidgets('settings offer format and Start Game without hero search',
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

    expect(find.text('CC'), findsOneWidget);
    expect(find.text('Silver Age/Limited'), findsOneWidget);
    expect(find.text('Start Game'), findsOneWidget);
    expect(find.text('Choose hero…'), findsNothing);
    expect(find.text('Search heroes…'), findsNothing);
    expect(find.text('Opponent'), findsNothing);
    expect(find.text('You'), findsNothing);
    expect(find.textContaining('Starting life 40'), findsOneWidget);
  });

  testWidgets('Start Game begins a CC match at 40 life', (tester) async {
    final container = await pumpApp(
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
    await tester.tap(find.text('Start Game'));
    await tester.pump();
    container.read(lifeTrackerProvider.notifier).toggleTimer();
    await tester.pumpAndSettle();

    final state = container.read(lifeTrackerProvider);
    expect(state.format, LifeFormat.cc);
    expect(state.you.life, 40);
    expect(state.opponent.life, 40);
    expect(find.text('Life tracker settings'), findsNothing);
  });

  testWidgets('Start Game begins Silver Age/Limited at 20 life', (tester) async {
    final container = await pumpApp(
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
    await tester.tap(find.text('Silver Age/Limited'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Starting life 20'), findsOneWidget);

    await tester.tap(find.text('Start Game'));
    await tester.pump();
    container.read(lifeTrackerProvider.notifier).toggleTimer();
    await tester.pumpAndSettle();

    final state = container.read(lifeTrackerProvider);
    expect(state.format, LifeFormat.silverAge);
    expect(state.you.life, 20);
    expect(state.opponent.life, 20);
  });
}
