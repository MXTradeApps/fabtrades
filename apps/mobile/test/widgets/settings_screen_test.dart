import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/models/app_settings.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/features/settings/settings_screen.dart';

import '../support/harness.dart';

void main() {
  testWidgets('renders pricing and appearance sections', (tester) async {
    await pumpApp(tester, const SettingsScreen());
    expect(find.text('Settings'), findsOneWidget);
    expect(find.text('PRICE SOURCE'), findsOneWidget);
    expect(find.text('PRICE TYPE'), findsNothing);
    expect(find.text('APPEARANCE'), findsOneWidget);
    expect(find.text('Dark mode'), findsOneWidget);
  });

  testWidgets('selecting CardMarket updates settings state', (tester) async {
    final container = await pumpApp(tester, const SettingsScreen());
    expect(container.read(settingsProvider).source, PriceSource.tcgplayer);

    await tester.tap(find.text('CardMarket'));
    await tester.pumpAndSettle();

    expect(container.read(settingsProvider).source, PriceSource.cardmarket);
  });

  testWidgets('toggling dark mode updates settings state', (tester) async {
    final container = await pumpApp(tester, const SettingsScreen());
    expect(container.read(settingsProvider).themeMode, AppThemeMode.dark);

    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();

    expect(container.read(settingsProvider).themeMode, AppThemeMode.light);
  });
}
