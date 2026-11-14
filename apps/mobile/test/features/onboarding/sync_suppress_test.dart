import 'package:fabtrades/core/models/binder_entry.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/onboarding/onboarding_provider.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';
import 'package:fabtrades/features/sync/sync_host.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fixtures.dart';
import '../../support/sync_stub.dart';

void main() {
  testWidgets('marks all tours seen after sync returns a non-empty binder',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final sync = StubSyncNotifier(const SyncStatus());

    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        syncProvider.overrideWith(() => sync),
      ],
    );
    addTearDown(container.dispose);

    await container.read(binderRepositoryProvider).save([
      BinderEntry(
        card: buildCard(id: 'owned'),
        quantity: 1,
        condition: 'NM',
        isWanted: false,
        addedAt: DateTime.utc(2026, 1, 1),
      ),
    ]);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: SyncHost(child: Scaffold(body: Text('ok'))),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(container.read(onboardingProvider), isEmpty);

    sync.state = SyncStatus(lastSyncedAt: DateTime.utc(2026, 7, 1));
    await tester.pumpAndSettle();

    expect(
      container.read(onboardingProvider),
      containsAll(OnboardingTourId.all),
    );
  });

  testWidgets('does not suppress tours when binder is still empty after sync',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final sync = StubSyncNotifier(const SyncStatus());

    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        syncProvider.overrideWith(() => sync),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: SyncHost(child: Scaffold(body: Text('ok'))),
        ),
      ),
    );
    await tester.pumpAndSettle();

    sync.state = SyncStatus(lastSyncedAt: DateTime.utc(2026, 7, 1));
    await tester.pumpAndSettle();

    expect(container.read(onboardingProvider), isEmpty);
  });
}
