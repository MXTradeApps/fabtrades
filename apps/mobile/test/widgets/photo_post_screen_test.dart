// "Post from photo", from the Binder menu to the sale post, with a fake photo
// picker and canned text in place of ML Kit (see test/support/photo_layout.dart).
//
// The photo holds three cards: Alpha Strike (one card, read confidently), Sink
// Below (three pitch colours, so it needs review) and one whose name could
// not be read.

import 'dart:convert';

import 'package:fabtrades/core/analytics/analytics.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/core/scan/ocr_guide_filter.dart';
import 'package:fabtrades/core/scan/photo_text_reader.dart';
import 'package:fabtrades/features/binder/photo_post_screen.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';
import 'package:fabtrades/features/trade/trade_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/photo_layout.dart';

class RecordingAnalytics extends Analytics {
  final events = <(String, Map<String, Object>?)>[];

  @override
  void capture(String event, [Map<String, Object>? properties]) =>
      events.add((event, properties));

  Map<String, Object>? propertiesOf(String event) =>
      events.lastWhere((e) => e.$1 == event).$2;

  bool saw(String event) => events.any((e) => e.$1 == event);
}

final catalog = [
  buildCard(
    id: 'a-n',
    productId: 1,
    name: 'Alpha Strike',
    subTypeName: 'Normal',
    collectorNumber: 'TST001',
    tcgMarket: 3,
  ),
  buildCard(
    id: 'a-f',
    productId: 1,
    name: 'Alpha Strike',
    subTypeName: 'Rainbow Foil',
    isFoil: true,
    collectorNumber: 'TST001',
    tcgMarket: 9,
  ),
  buildCard(
    id: 'sb-r',
    productId: 2,
    name: 'Sink Below (Red)',
    collectorNumber: 'TST002',
    pitch: '1',
    tcgMarket: 5,
  ),
  buildCard(
    id: 'sb-y',
    productId: 3,
    name: 'Sink Below (Yellow)',
    collectorNumber: 'TST003',
    pitch: '2',
    tcgMarket: 2,
  ),
  buildCard(
    id: 'sb-b',
    productId: 4,
    name: 'Sink Below (Blue)',
    collectorNumber: 'TST004',
    pitch: '3',
    tcgMarket: 1,
  ),
  buildCard(
    id: 'g',
    productId: 5,
    name: 'Gamma Ray',
    collectorNumber: 'TST005',
    tcgMarket: 4,
  ),
];

const rules = ['If this hits, draw a card.', 'Go again', 'Generic Action'];

List<OcrLine> threeCardPhoto() {
  final a = photoGridCell(0, 0);
  final b = photoGridCell(1, 0);
  final c = photoGridCell(2, 0);
  return [
    ...photoCard(x: a.x, y: a.y, title: 'Alpha Strike', rules: rules),
    ...photoCard(x: b.x, y: b.y, title: 'Sink Below', rules: rules),
    ...photoCard(
      x: c.x,
      y: c.y,
      title: 'Xq7 Zzvb',
      rules: const ['lorem ipsum dolor', 'sit amet consectetur', 'adipiscing'],
    ),
  ];
}

String postText(WidgetTester tester) => tester
    .widget<SelectableText>(find.descendant(
      of: find.byKey(const Key('salePostPreview-0')),
      matching: find.byType(SelectableText),
    ))
    .data!;

void main() {
  late RecordingAnalytics analytics;

  // Tall enough that every row is built without scrolling.
  void tallPhone(WidgetTester tester) {
    tester.view.physicalSize = const Size(390, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  Future<void> pumpReview(
    WidgetTester tester, {
    List<OcrLine>? lines,
    Object? readError,
  }) async {
    tallPhone(tester);
    analytics = RecordingAnalytics();
    await pumpApp(
      tester,
      const PhotoPostScreen(imagePath: 'photo.jpg'),
      catalog: catalog,
      extraOverrides: [
        analyticsProvider.overrideWithValue(analytics),
        photoTextReaderProvider.overrideWithValue(
          FakePhotoTextReader(lines ?? threeCardPhoto(), error: readError),
        ),
      ],
    );
    await tester.pumpAndSettle();
  }

  Future<void> tapKey(WidgetTester tester, String key) async {
    await tester.tap(find.byKey(Key(key)));
    await tester.pumpAndSettle();
  }

  Future<void> pickFromSearch(
    WidgetTester tester,
    String name, {
    String? query,
  }) async {
    await tester.enterText(find.byType(TextField), query ?? name);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    await tester.tap(find.text(name).last);
    await tester.pumpAndSettle();
  }

  testWidgets('sums up the photo and puts the card to review above the list',
      (tester) async {
    await pumpReview(tester);

    expect(find.text('Cards found: 3'), findsOneWidget);
    expect(find.text('Matched automatically: 1'), findsOneWidget);
    expect(find.text('Needs review: 1'), findsOneWidget);
    expect(find.text("Couldn't match: 1"), findsOneWidget);

    // Needs review: what was read, why, and the printings to choose from.
    expect(find.text('0 of 1 reviewed'), findsOneWidget);
    expect(find.byKey(const Key('candidateReviewRow')), findsOneWidget);
    expect(
      find.text(
          'This card comes in more than one colour. Pick the one you have.'),
      findsOneWidget,
    );
    for (final id in ['sb-r', 'sb-y', 'sb-b']) {
      expect(find.byKey(Key('candidateOption-$id')), findsOneWidget);
    }

    // Only the confident card is in the post so far.
    expect(find.byKey(const Key('photoRow-0')), findsOneWidget);
    expect(find.byKey(const Key('photoRow-1')), findsNothing);
    expect(
      tester.getTopLeft(find.byKey(const Key('candidateReview'))).dy,
      lessThan(tester.getTopLeft(find.byKey(const Key('photoRow-0'))).dy),
    );
    expect(find.text('Unrecognized, tap to pick'), findsOneWidget);
    expect(
      find.text('1 unreviewed row and 1 skipped or unmatched row will be '
          'left out'),
      findsOneWidget,
    );
    expect(find.text('Create post (1 card)'), findsOneWidget);

    expect(analytics.propertiesOf('photo_post_recognized'), {
      'source': 'gallery',
      'lines': threeCardPhoto().length,
      'cards': 3,
      'confident': 1,
      'unsure': 1,
      'unrecognized': 1,
    });
  });

  testWidgets('picking in review adds the card, and Create post hands the '
      'list to the sale post sheet', (tester) async {
    await pumpReview(tester);

    await tapKey(tester, 'candidateOption-sb-y');
    expect(find.text('1 of 1 reviewed'), findsOneWidget);
    expect(find.byKey(const Key('photoRow-1')), findsOneWidget);
    expect(find.text('Create post (2 cards)'), findsOneWidget);

    await tapKey(tester, 'photoCreatePost');

    expect(find.byKey(const Key('salePostSheet')), findsOneWidget);
    final post = postText(tester);
    expect(
        post,
        contains(
            'NF Alpha Strike \$3.00\nNF Sink Below (Yellow) \$2.00'));
    expect(post, contains('2 cards · \$5.00 total'));
    // These cards are not in a Binder, so there is no Binder page to link.
    expect(find.byKey(const Key('salePostLink')), findsNothing);

    expect(analytics.propertiesOf('sale_post_opened'),
        {'source': 'photo', 'cards': 2});
    final created = analytics.propertiesOf('photo_post_created')!;
    expect(created['cards'], 2);
    expect(created['review_picked'], 1);
    expect(created['review_unreviewed'], 0);
    expect(created['left_unrecognized'], 1);
  });

  testWidgets('a skipped or unreviewed card stays out of the post',
      (tester) async {
    await pumpReview(tester);

    await tapKey(tester, 'candidateReviewSkip');
    expect(find.text('Skipped'), findsOneWidget);
    expect(find.text('1 of 1 reviewed'), findsOneWidget);
    expect(find.text('2 skipped or unmatched rows will be left out'),
        findsOneWidget);

    await tapKey(tester, 'photoCreatePost');
    final post = postText(tester);
    expect(post, contains('Alpha Strike'));
    expect(post, isNot(contains('Sink Below')));
    expect(post, contains('1 card · \$3.00 total'));
  });

  testWidgets('every row can be edited: quantity, condition and finish',
      (tester) async {
    await pumpReview(tester);

    await tapKey(tester, 'photoRowQtyPlus-0');
    expect(
      tester.widget<Text>(find.byKey(const Key('photoRowQty-0'))).data,
      '2',
    );
    await tapKey(tester, 'photoRowCondition-0');
    await tester.tap(find.text('LP').last);
    await tester.pumpAndSettle();
    await tapKey(tester, 'photoRowFinish-0');
    await tester.tap(find.text('Rainbow Foil').last);
    await tester.pumpAndSettle();
    expect(
      tester.widget<Text>(find.byKey(const Key('photoRowPrice-0'))).data,
      'Rainbow Foil · \$9.00',
    );

    await tapKey(tester, 'photoCreatePost');
    expect(postText(tester), contains('2x RF Alpha Strike (LP) \$9.00 ea'));
  });

  testWidgets('the printing picker lists every printing of the card',
      (tester) async {
    await pumpReview(tester);
    await tapKey(tester, 'candidateOption-sb-r');

    await tapKey(tester, 'photoRowPrinting-1');
    expect(find.byKey(const Key('photoCandidate-sb-r')), findsOneWidget);
    await tapKey(tester, 'photoCandidate-sb-b');

    expect(
      tester.widget<Text>(find.byKey(const Key('photoRowName-1'))).data,
      'Sink Below (Blue)',
    );
  });

  testWidgets('a row can be replaced by search or removed', (tester) async {
    await pumpReview(tester);

    await tapKey(tester, 'photoRowReplace-0');
    await pickFromSearch(tester, 'Gamma Ray');
    expect(
      tester.widget<Text>(find.byKey(const Key('photoRowName-0'))).data,
      'Gamma Ray',
    );

    await tapKey(tester, 'photoRowRemove-0');
    expect(find.byKey(const Key('photoRow-0')), findsNothing);
    // Nothing left that can be posted.
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('photoCreatePost')))
          .onPressed,
      isNull,
    );
  });

  testWidgets('an unrecognized row is picked by search, and a missed card '
      'can be added', (tester) async {
    await pumpReview(tester);

    expect(find.textContaining('Read: lorem ipsum dolor'), findsOneWidget);
    await tester.tap(find.text('Unrecognized, tap to pick'));
    await tester.pumpAndSettle();
    await pickFromSearch(tester, 'Gamma Ray');
    expect(find.text('Unrecognized, tap to pick'), findsNothing);
    expect(
      tester.widget<Text>(find.byKey(const Key('photoRowName-2'))).data,
      'Gamma Ray',
    );

    await tapKey(tester, 'photoAddCard');
    await pickFromSearch(tester, 'Sink Below (Blue)', query: 'Sink');
    expect(
      tester.widget<Text>(find.byKey(const Key('photoRowName-3'))).data,
      'Sink Below (Blue)',
    );

    await tapKey(tester, 'photoCreatePost');
    final post = postText(tester);
    expect(post, contains('NF Gamma Ray \$4.00'));
    expect(post, contains('NF Sink Below (Blue) \$1.00'));
    final created = analytics.propertiesOf('photo_post_created')!;
    expect(created['replaced'], 1);
    expect(created['added'], 1);
  });

  testWidgets('"None of these" in review searches for another card',
      (tester) async {
    await pumpReview(tester);

    await tapKey(tester, 'candidateReviewSearch');
    await pickFromSearch(tester, 'Gamma Ray');

    expect(find.text('1 of 1 reviewed'), findsOneWidget);
    expect(
      tester.widget<Text>(find.byKey(const Key('photoRowName-1'))).data,
      'Gamma Ray',
    );
  });

  testWidgets('two copies of one printing become a single 2x line',
      (tester) async {
    final a = photoGridCell(0, 0);
    final b = photoGridCell(1, 0);
    await pumpReview(tester, lines: [
      ...photoCard(x: a.x, y: a.y, title: 'Alpha Strike', rules: rules),
      ...photoCard(x: b.x, y: b.y, title: 'Alpha Strike', rules: rules),
    ]);

    await tapKey(tester, 'photoCreatePost');
    expect(postText(tester), contains('2x NF Alpha Strike \$3.00 ea'));
  });

  testWidgets('a photo with no readable cards says so and still allows adding',
      (tester) async {
    await pumpReview(tester, lines: const []);

    expect(find.textContaining('No cards were found'), findsOneWidget);
    expect(find.byKey(const Key('photoAddCard')), findsOneWidget);
  });

  testWidgets('a failed read offers a retry', (tester) async {
    await pumpReview(tester, readError: StateError('ocr'));

    expect(find.text('Could not read that photo.'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('Trade menu: Post from photo asks for a photo and opens the '
      'review', (tester) async {
    tallPhone(tester);
    analytics = RecordingAnalytics();
    final asked = <PhotoSource>[];
    await pumpApp(
      tester,
      const TradeScreen(),
      catalog: catalog,
      seed: {
        OnboardingRepository.storageKey:
            jsonEncode(OnboardingTourId.all.toList()),
      },
      extraOverrides: [
        analyticsProvider.overrideWithValue(analytics),
        photoTextReaderProvider
            .overrideWithValue(FakePhotoTextReader(threeCardPhoto())),
        photoPickerProvider.overrideWithValue((source) async {
          asked.add(source);
          return 'photo.jpg';
        }),
      ],
    );
    await tester.pumpAndSettle();

    // Offered even on an empty trade: the cards come from the photo.
    await tapKey(tester, 'tradeOverflow');
    await tapKey(tester, 'sellFromPhoto');
    await tapKey(tester, 'photoPostGallery');

    expect(asked, [PhotoSource.gallery]);
    expect(find.text('Cards found: 3'), findsOneWidget);
    expect(analytics.propertiesOf('photo_post_started'), {'source': 'gallery'});
  });
}
