import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/features/search/card_picker.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';

void main() {
  final catalog = [
    buildCard(id: 'a1', name: 'Alpha One', tcgMarket: 1.0),
    buildCard(id: 'a2', name: 'Alpha Two', tcgMarket: 2.0),
  ];

  Future<void> openMulti(
    WidgetTester tester, {
    required Future<bool> Function(CardModel card) onPick,
  }) async {
    await pumpApp(
      tester,
      Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () => CardPickerScreen.showMulti(
              context,
              title: 'Add a card',
              onPick: onPick,
            ),
            child: const Text('Open picker'),
          ),
        ),
      ),
      catalog: catalog,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Open picker'));
    await tester.pumpAndSettle();
  }

  testWidgets('multi-add keeps the picker open so another card can be tapped', (
    tester,
  ) async {
    final picked = <String>[];

    await openMulti(
      tester,
      onPick: (card) async {
        picked.add(card.id);
        return true;
      },
    );

    expect(find.text('Add a card'), findsOneWidget);
    expect(find.text('Done'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Alpha');
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pumpAndSettle();

    expect(find.text('Alpha One'), findsOneWidget);
    expect(find.text('Alpha Two'), findsOneWidget);

    await tester.tap(find.text('Alpha One'));
    await tester.pumpAndSettle();

    expect(picked, ['a1']);
    expect(find.text('Add a card'), findsOneWidget);
    expect(find.text('1 added'), findsOneWidget);
    expect(
      (tester.widget<TextField>(find.byType(TextField))).controller?.text,
      'Alpha',
    );

    await tester.tap(find.text('Alpha Two'));
    await tester.pumpAndSettle();

    expect(picked, ['a1', 'a2']);
    expect(find.text('Add a card'), findsOneWidget);
    expect(find.text('2 added'), findsOneWidget);
    expect(
      (tester.widget<TextField>(find.byType(TextField))).controller?.text,
      'Alpha',
    );
  });

  testWidgets('multi-add pops when onPick returns false', (tester) async {
    await openMulti(tester, onPick: (_) async => false);
    await tester.pumpAndSettle();

    expect(find.text('Alpha One'), findsOneWidget);

    await tester.tap(find.text('Alpha One'));
    await tester.pumpAndSettle();

    expect(find.text('Add a card'), findsNothing);
    expect(find.text('Open picker'), findsOneWidget);
  });
}
