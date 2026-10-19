import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'binder_bulk_select_test.dart' show pumpTradeBinder, select;

String previewText(WidgetTester tester, int i) => tester
    .widget<SelectableText>(find.descendant(
      of: find.byKey(Key('salePostPreview-$i')),
      matching: find.byType(SelectableText),
    ))
    .data!;

void main() {
  late List<String> clipboard;

  setUp(() {
    clipboard = [];
    TestWidgetsFlutterBinding.ensureInitialized()
        .defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        clipboard.add((call.arguments as Map)['text'] as String);
      }
      return null;
    });
  });

  testWidgets('Post for sale lists the whole Binder, priced high to low',
      (tester) async {
    await pumpTradeBinder(tester);
    await tester.tap(find.byKey(const Key('binderOverflow')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sellBinder')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('salePostSheet')), findsOneWidget);
    final discord = previewText(tester, 0);
    expect(discord, startsWith('**WTS** · prices are TCGplayer market'));
    expect(
      discord,
      contains('NF Gamma \$5.00\n2x NF Alpha \$3.00 ea\nNF Beta \$1.00'),
    );
    expect(discord, contains('4 cards · \$12 total'));
    // Only the Trade Binder can be linked.
    expect(find.byKey(const Key('salePostLink')), findsOneWidget);

    await tester.tap(find.byKey(const Key('salePostPercent-90')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Facebook'));
    await tester.pumpAndSettle();
    final facebook = previewText(tester, 0);
    expect(facebook, startsWith('WTS - Flesh and Blood singles'));
    expect(facebook, contains('Gamma - \$4.50'));

    await tester.ensureVisible(find.byKey(const Key('salePostCopy-0')));
    await tester.tap(find.byKey(const Key('salePostCopy-0')));
    await tester.pumpAndSettle();
    expect(clipboard, [facebook]);
    expect(find.text('Copied'), findsOneWidget);
  });

  testWidgets('Sell in selection mode lists only the selected cards',
      (tester) async {
    await pumpTradeBinder(tester);
    await select(tester, 'b-Normal');
    await tester.tap(find.byKey(const Key('binderBulkSell')));
    await tester.pumpAndSettle();

    final post = previewText(tester, 0);
    expect(post, contains('NF Beta \$1.00'));
    expect(post, isNot(contains('Alpha')));
    expect(post, contains('1 card · \$1.00 total'));
  });
}
