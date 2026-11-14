import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/sync/sync_host.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/sync_stub.dart';

Future<StubSyncNotifier> _pumpHost(
  WidgetTester tester, {
  SyncStatus status = const SyncStatus(),
}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final sync = StubSyncNotifier(status);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        syncProvider.overrideWith(() => sync),
      ],
      child: const MaterialApp(
        home: SyncHost(child: Scaffold(body: Text('Binder'))),
      ),
    ),
  );
  await tester.pump();
  return sync;
}

/// Clears the current snack bar so the next assertion is about a new one.
Future<void> _dismissSnackBar(WidgetTester tester) async {
  ScaffoldMessenger.of(tester.element(find.text('Binder')))
      .removeCurrentSnackBar();
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows the app regardless of what sync is doing', (tester) async {
    await _pumpHost(tester, status: const SyncStatus(error: 'Offline.'));

    // The point of the local cache: a failed sync never blocks the app.
    expect(find.text('Binder'), findsOneWidget);
  });

  testWidgets('says nothing when there is nothing to report', (tester) async {
    await _pumpHost(tester);

    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('reports a sync failure once', (tester) async {
    final sync = await _pumpHost(
      tester,
      status: const SyncStatus(error: 'Offline right now.'),
    );
    await tester.pump();

    expect(find.text('Offline right now.'), findsOneWidget);

    await _dismissSnackBar(tester);
    expect(find.text('Offline right now.'), findsNothing);

    // An unrelated rebuild must not re-announce the same failure.
    sync.state = const SyncStatus(error: 'Offline right now.', isSyncing: true);
    await tester.pumpAndSettle();

    expect(find.text('Offline right now.'), findsNothing);
  });

  testWidgets('reports a later failure after one that recovered',
      (tester) async {
    final sync = await _pumpHost(
      tester,
      status: const SyncStatus(error: 'Offline right now.'),
    );
    await tester.pump();
    expect(find.text('Offline right now.'), findsOneWidget);

    await _dismissSnackBar(tester);
    sync.state = SyncStatus(lastSyncedAt: DateTime.now());
    await tester.pumpAndSettle();

    sync.state = const SyncStatus(error: 'Offline right now.');
    await tester.pump();
    await tester.pump();

    expect(find.text('Offline right now.'), findsOneWidget);
  });
}
