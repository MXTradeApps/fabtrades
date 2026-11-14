// The scan screen, driven end to end with a fake camera and a fake text
// recognizer (see test/support/scan_fakes.dart).
//
// The matching logic has its own tests in test/core/data/card_scan_test.dart.
// These cover what surrounds it: what the user sees when the camera is missing
// or refused, typing a card instead, the two-frame lock, and where a scanned
// card ends up (card detail, a side of the trade, or the Binder).
import 'dart:async';
import 'dart:convert';

import 'package:camera_platform_interface/camera_platform_interface.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/app/widgets.dart';
import 'package:fabtrades/core/analytics/analytics.dart';
import 'package:fabtrades/core/data/review_prompt_repository.dart';
import 'package:fabtrades/core/models/binder.dart';
import 'package:fabtrades/core/models/card_model.dart';
import 'package:fabtrades/core/models/trade.dart';
import 'package:fabtrades/core/providers.dart';
import 'package:fabtrades/core/scan/card_hash_index.dart';
import 'package:fabtrades/features/card_detail/card_detail_screen.dart';
import 'package:fabtrades/features/onboarding/onboarding_repository.dart';
import 'package:fabtrades/features/scan/scan_screen.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/scan_fakes.dart';

class RecordingAnalytics extends Analytics {
  final events = <(String, Map<String, Object>?)>[];
  final exceptions = <Object>[];

  @override
  void capture(String event, [Map<String, Object>? properties]) =>
      events.add((event, properties));

  @override
  void captureException(
    Object error,
    StackTrace? stackTrace, [
    Map<String, Object>? properties,
  ]) =>
      exceptions.add(error);

  Map<String, Object>? propertiesOf(String event) =>
      events.lastWhere((e) => e.$1 == event).$2;

  int count(String event) => events.where((e) => e.$1 == event).length;
}

final command = buildCard(
  id: 'cnc',
  name: 'Command and Conquer',
  setName: 'Arcane Rising',
  collectorNumber: 'ARC159',
  tcgMarket: 60,
);
final strike = buildCard(
  id: 'es-normal',
  name: 'Enlightened Strike',
  setName: 'Welcome to Rathe',
  collectorNumber: 'WTR159',
  subTypeName: 'Normal',
  tcgMarket: 30,
);
final strikeFoil = buildCard(
  id: 'es-rf',
  name: 'Enlightened Strike',
  setName: 'Welcome to Rathe',
  collectorNumber: 'WTR159',
  subTypeName: 'Rainbow Foil',
  isFoil: true,
  tcgMarket: 90,
);
final snatch = buildCard(
  id: 'snatch',
  name: 'Snatch (Red)',
  setName: 'Welcome to Rathe',
  collectorNumber: 'WTR167',
  tcgMarket: 2,
);
final catalog = [command, strike, strikeFoil, snatch];

void main() {
  late FakeCameraPlatform camera;
  late FakeTextRecognizer ocr;
  late RecordingAnalytics analytics;
  late CameraPlatform originalPlatform;

  setUp(() {
    originalPlatform = CameraPlatform.instance;
  });

  tearDown(() {
    CameraPlatform.instance = originalPlatform;
  });

  /// Pumps the scanner over [camera] (a working back camera by default) and
  /// waits for it to finish starting up.
  Future<ProviderContainer> pumpScan(
    WidgetTester tester, {
    FakeCameraPlatform? platform,
    ScanDestination destination = ScanDestination.detail,
    TradeSide? tradeSide,
    List<CardModel>? cards,
    List<Override> overrides = const [],
  }) async {
    // A phone-shaped surface: the camera viewport is laid out for portrait.
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    camera = platform ?? FakeCameraPlatform();
    CameraPlatform.instance = camera;
    ocr = FakeTextRecognizer(tester);
    analytics = RecordingAnalytics();

    final container = await pumpApp(
      tester,
      ScanScreen(destination: destination, tradeSide: tradeSide),
      catalog: cards ?? catalog,
      // The first-run coach marks would sit on top of the screen under test.
      seed: {
        OnboardingRepository.storageKey: jsonEncode([OnboardingTourId.scan]),
      },
      extraOverrides: [
        analyticsProvider.overrideWithValue(analytics),
        // No bundled hash index: recognition here is by printed text alone.
        cardHashIndexProvider
            .overrideWith((ref) => Completer<CardHashIndex>().future),
        reviewPromptRepositoryProvider.overrideWith(
          (ref) => ReviewPromptRepository(
            ref.watch(sharedPreferencesProvider),
            isAvailable: () async => false,
            requestReview: () async {},
          ),
        ),
        ...overrides,
      ],
    );
    // Catalog load, camera discovery and camera init each take a turn.
    for (var i = 0; i < 6; i++) {
      await tester.pump();
    }
    return container;
  }

  /// One camera frame, then enough real time for the scanner's rate limit to
  /// let the next one through.
  Future<void> frame(WidgetTester tester) async {
    camera.pushFrame();
    for (var i = 0; i < 4; i++) {
      await tester.pump();
    }
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 380)),
    );
    await tester.pump();
  }

  /// Stopping the camera stream completes on the real event loop, which the
  /// test clock does not turn by itself. Give it a turn, then settle.
  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 3; i++) {
      await tester.pump();
      await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    }
    await tester.pumpAndSettle();
  }

  /// As [settle], for moments when a spinner is on screen and the tree never
  /// comes to rest.
  Future<void> settleNoAnimations(WidgetTester tester) async {
    for (var i = 0; i < 3; i++) {
      await tester.pump();
      await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    }
    await tester.pump();
  }

  Future<void> typeLookup(WidgetTester tester, String text) async {
    await tester.tap(find.byTooltip('Enter name or number'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), text);
    await tester.tap(find.widgetWithText(FilledButton, 'Look up'));
    await settle(tester);
  }

  Finder row(String cardName) => find.widgetWithText(CardRow, cardName);

  group('camera unavailable', () {
    testWidgets('no camera on the device: says so and offers typing instead',
        (tester) async {
      await pumpScan(tester, platform: FakeCameraPlatform(cameras: []));

      expect(find.text('Camera unavailable'), findsOneWidget);
      expect(find.text('No cameras reported by the OS.'), findsOneWidget);
      expect(find.text('Enter a name or collector number instead.'),
          findsOneWidget);
      expect(
        find.text('Use the keyboard icon to find a card by name or '
            'collector number.'),
        findsOneWidget,
      );
      expect(find.byTooltip('Toggle flash'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(analytics.propertiesOf('scan_failed'), {
        'destination': 'detail',
        'error_type': 'no_camera',
      });
    });

    testWidgets('permission denied: explained, tracked, and typing still works',
        (tester) async {
      await pumpScan(
        tester,
        platform: FakeCameraPlatform(
          availableCamerasError: CameraException(
            'CameraAccessDenied',
            'User denied the camera access request.',
          ),
        ),
      );

      expect(find.text('Camera unavailable'), findsOneWidget);
      expect(find.textContaining('CameraAccessDenied'), findsOneWidget);
      expect(analytics.propertiesOf('scan_permission_denied'), {
        'destination': 'detail',
        'error_type': 'CameraAccessDenied',
      });
      expect(analytics.count('scan_failed'), 0);

      await tester.tap(find.widgetWithText(FilledButton, 'Find a card'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Command and Conquer');
      await tester.tap(find.widgetWithText(FilledButton, 'Look up'));
      await tester.pumpAndSettle();

      expect(find.text('Found Command and Conquer.'), findsOneWidget);
      expect(row('Command and Conquer'), findsOneWidget);
    });

    testWidgets('camera fails to start: shows the reason and tracks a failure',
        (tester) async {
      await pumpScan(
        tester,
        platform: FakeCameraPlatform(
          initializeError: CameraException('cameraInUse', 'Camera is busy'),
        ),
      );

      expect(find.text('Camera unavailable'), findsOneWidget);
      expect(find.textContaining('cameraInUse'), findsOneWidget);
      expect(analytics.propertiesOf('scan_failed'), {
        'destination': 'detail',
        'error_type': 'cameraInUse',
      });
      expect(analytics.count('scan_permission_denied'), 0);
      // Both presets were tried and neither camera was left open.
      expect(camera.presetsTried,
          [ResolutionPreset.veryHigh, ResolutionPreset.high]);
      expect(camera.openCameras, 0);
    });

    testWidgets('a failure counts against showing the rating prompt',
        (tester) async {
      final c =
          await pumpScan(tester, platform: FakeCameraPlatform(cameras: []));

      expect(
        c
            .read(sharedPreferencesProvider)
            .getString(ReviewPromptRepository.storageKey),
        isNotNull,
      );
    });

    testWidgets('falls back to a lower resolution when the highest fails',
        (tester) async {
      await pumpScan(
        tester,
        platform: FakeCameraPlatform(
          failingPresets: {ResolutionPreset.veryHigh},
        ),
      );

      expect(camera.presetsTried,
          [ResolutionPreset.veryHigh, ResolutionPreset.high]);
      expect(find.text('Camera unavailable'), findsNothing);
      expect(find.text('Point at a card to identify it.'), findsOneWidget);
      expect(camera.isStreaming, isTrue);
      expect(camera.openCameras, 1);
      expect(analytics.count('scan_failed'), 0);
    });
  });

  group('typing a card instead', () {
    testWidgets('finds a card by name', (tester) async {
      await pumpScan(tester, platform: FakeCameraPlatform(cameras: []));
      await typeLookup(tester, 'snatch');

      expect(find.text('Found Snatch (Red).'), findsOneWidget);
      expect(row('Snatch (Red)'), findsOneWidget);
      expect(find.byType(CardRow), findsOneWidget);
    });

    testWidgets('lists every printing of a card with several', (tester) async {
      await pumpScan(tester, platform: FakeCameraPlatform(cameras: []));
      await typeLookup(tester, 'Enlightened Strike');

      expect(
        find.text('Found Enlightened Strike — 2 versions, best matches first.'),
        findsOneWidget,
      );
      expect(row('Enlightened Strike'), findsNWidgets(2));
    });

    testWidgets('says so when nothing matches', (tester) async {
      await pumpScan(tester, platform: FakeCameraPlatform(cameras: []));
      await typeLookup(tester, 'zzzz qqqq');

      expect(find.text('No card found for “zzzz qqqq”.'), findsOneWidget);
      expect(find.byType(CardRow), findsNothing);
    });

    testWidgets('Cancel and an empty entry change nothing', (tester) async {
      await pumpScan(tester, platform: FakeCameraPlatform(cameras: []));

      await tester.tap(find.byTooltip('Enter name or number'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'snatch');
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();
      expect(find.byType(CardRow), findsNothing);

      await typeLookup(tester, '   ');
      expect(find.byType(CardRow), findsNothing);
      expect(find.textContaining('Looking up'), findsNothing);
    });

    testWidgets('submitting from the keyboard looks the card up',
        (tester) async {
      await pumpScan(tester, platform: FakeCameraPlatform(cameras: []));

      await tester.tap(find.byTooltip('Enter name or number'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'snatch');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      expect(row('Snatch (Red)'), findsOneWidget);
    });

    testWidgets('a new lookup replaces the previous result', (tester) async {
      await pumpScan(tester, platform: FakeCameraPlatform(cameras: []));
      await typeLookup(tester, 'snatch');
      await typeLookup(tester, 'Command and Conquer');

      expect(row('Snatch (Red)'), findsNothing);
      expect(row('Command and Conquer'), findsOneWidget);
    });

    testWidgets('pauses live scanning while a typed result is shown',
        (tester) async {
      await pumpScan(tester);
      expect(camera.isStreaming, isTrue);

      await typeLookup(tester, 'snatch');

      expect(camera.isStreaming, isFalse);
      expect(row('Snatch (Red)'), findsOneWidget);
      expect(find.text('Scan again'), findsOneWidget);
    });
  });

  group('live scanning', () {
    testWidgets('starts scanning once the camera is ready', (tester) async {
      await pumpScan(tester);

      expect(find.text('Scan'), findsOneWidget);
      expect(find.text('Point at a card to identify it.'), findsOneWidget);
      expect(find.text('Fit the card exactly in the frame'), findsOneWidget);
      expect(
        find.text('Hold a card steady inside the frame. It identifies '
            'automatically — no button needed.'),
        findsOneWidget,
      );
      expect(find.byTooltip('Toggle flash'), findsOneWidget);
      expect(camera.isStreaming, isTrue);
      expect(analytics.propertiesOf('scan_opened'), {'destination': 'detail'});
    });

    testWidgets('the first sighting asks to hold steady; the second locks on',
        (tester) async {
      await pumpScan(tester);
      ocr.reads = [FakeTextRecognizer.card('Command and Conquer')];

      await frame(tester);
      expect(find.text('Reading Command and Conquer… hold steady.'),
          findsOneWidget);
      expect(find.byType(CardRow), findsNothing);
      expect(camera.isStreaming, isTrue);

      await frame(tester);
      await tester.pumpAndSettle();
      expect(find.text('Found Command and Conquer.'), findsOneWidget);
      expect(row('Command and Conquer'), findsOneWidget);
      expect(find.text('Paused'), findsOneWidget);
      expect(find.text('Scan again'), findsOneWidget);
      expect(find.byTooltip('Toggle flash'), findsNothing);
      expect(camera.isStreaming, isFalse);
      expect(analytics.propertiesOf('card_scanned'), {
        'card_id': 'cnc',
        'card_name': 'Command and Conquer',
        'destination': 'detail',
      });
    });

    testWidgets('a locked card with several printings lists them all',
        (tester) async {
      await pumpScan(tester);
      ocr.reads = [FakeTextRecognizer.card('Enlightened Strike')];

      await frame(tester);
      await frame(tester);
      await tester.pumpAndSettle();

      expect(
        find.text('Found Enlightened Strike — 2 versions, best matches first.'),
        findsOneWidget,
      );
      expect(row('Enlightened Strike'), findsNWidgets(2));
      expect(analytics.count('card_scanned'), 1);
    });

    testWidgets('two different cards in a row do not lock', (tester) async {
      await pumpScan(tester);
      ocr.reads = [
        FakeTextRecognizer.card('Command and Conquer'),
        FakeTextRecognizer.card('Snatch'),
      ];

      await frame(tester);
      await frame(tester);

      expect(find.text('Reading Snatch (Red)… hold steady.'), findsOneWidget);
      expect(find.byType(CardRow), findsNothing);
      expect(camera.isStreaming, isTrue);
      expect(analytics.count('card_scanned'), 0);
    });

    testWidgets('a blank frame between two good ones does not lose the read',
        (tester) async {
      await pumpScan(tester);
      ocr.reads = [
        FakeTextRecognizer.card('Command and Conquer'),
        FakeTextRecognizer.nothing,
        FakeTextRecognizer.card('Command and Conquer'),
      ];

      await frame(tester);
      await frame(tester);
      expect(find.byType(CardRow), findsNothing);
      await frame(tester);
      await tester.pumpAndSettle();

      expect(find.text('Found Command and Conquer.'), findsOneWidget);
    });

    testWidgets('three blank frames start the read over', (tester) async {
      await pumpScan(tester);
      ocr.reads = [
        FakeTextRecognizer.card('Command and Conquer'),
        FakeTextRecognizer.nothing,
        FakeTextRecognizer.nothing,
        FakeTextRecognizer.nothing,
        FakeTextRecognizer.card('Command and Conquer'),
      ];

      for (var i = 0; i < 5; i++) {
        await frame(tester);
      }
      // The card left the frame for long enough that one sighting is not
      // enough again.
      expect(find.byType(CardRow), findsNothing);
      expect(camera.isStreaming, isTrue);

      await frame(tester);
      await tester.pumpAndSettle();
      expect(find.text('Found Command and Conquer.'), findsOneWidget);
    });

    testWidgets('frames that read nothing leave the scanner waiting',
        (tester) async {
      await pumpScan(tester);

      await frame(tester);
      await frame(tester);

      expect(ocr.framesRead, 2);
      expect(find.text('Point at a card to identify it.'), findsOneWidget);
      expect(find.byType(CardRow), findsNothing);
      expect(camera.isStreaming, isTrue);
    });

    testWidgets('text that is no card name is ignored', (tester) async {
      await pumpScan(tester);
      ocr.reads = [FakeTextRecognizer.card('Lorem ipsum dolor')];

      await frame(tester);
      await frame(tester);

      expect(find.byType(CardRow), findsNothing);
      expect(find.textContaining('hold steady'), findsNothing);
    });

    testWidgets('frames arriving faster than the rate limit are skipped',
        (tester) async {
      await pumpScan(tester);
      ocr.reads = [FakeTextRecognizer.card('Command and Conquer')];

      camera.pushFrame();
      camera.pushFrame();
      camera.pushFrame();
      for (var i = 0; i < 4; i++) {
        await tester.pump();
      }

      expect(ocr.framesRead, 1);
      expect(find.byType(CardRow), findsNothing);
    });

    testWidgets('says the catalog is loading when it has no cards yet',
        (tester) async {
      await pumpScan(tester, cards: []);
      ocr.reads = [FakeTextRecognizer.card('Command and Conquer')];

      await frame(tester);

      expect(find.text('Loading card catalog…'), findsOneWidget);
      expect(ocr.framesRead, 0);
    });

    testWidgets('a recognizer failure does not stop the scanner',
        (tester) async {
      await pumpScan(tester);
      ocr.reads = [
        FakeTextRecognizer.failure,
        FakeTextRecognizer.card('Command and Conquer'),
      ];

      await frame(tester);
      expect(tester.takeException(), isNull);
      expect(camera.isStreaming, isTrue);

      await frame(tester);
      await frame(tester);
      await tester.pumpAndSettle();
      expect(find.text('Found Command and Conquer.'), findsOneWidget);
    });

    testWidgets('Scan again clears the result and resumes the camera',
        (tester) async {
      await pumpScan(tester);
      ocr.reads = [FakeTextRecognizer.card('Command and Conquer')];
      await frame(tester);
      await frame(tester);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Scan again'));
      await tester.pumpAndSettle();

      expect(find.byType(CardRow), findsNothing);
      expect(find.text('Point at a card to identify it.'), findsOneWidget);
      expect(find.text('Scan again'), findsNothing);
      expect(camera.isStreaming, isTrue);

      // And it needs two fresh sightings, not one.
      await frame(tester);
      expect(find.byType(CardRow), findsNothing);
      await frame(tester);
      await tester.pumpAndSettle();
      expect(row('Command and Conquer'), findsOneWidget);
    });

    testWidgets('the flash button turns the torch on and off', (tester) async {
      await pumpScan(tester);

      await tester.tap(find.byTooltip('Toggle flash'));
      await tester.pump();
      expect(find.byIcon(Icons.flash_on), findsOneWidget);

      await tester.tap(find.byTooltip('Toggle flash'));
      await tester.pump();
      expect(find.byIcon(Icons.flash_off), findsOneWidget);

      expect(camera.flashModes, [FlashMode.torch, FlashMode.off]);
    });

    testWidgets('diagnostics overlay shows the frame counters', (tester) async {
      await pumpScan(tester);

      await tester.tap(find.byTooltip('Scan diagnostics'));
      await tester.pump();
      expect(find.textContaining('rx=0 proc=0'), findsOneWidget);

      await frame(tester);
      expect(find.textContaining('rx=1 proc=1'), findsOneWidget);

      await tester.tap(find.byTooltip('Scan diagnostics'));
      await tester.pump();
      expect(find.textContaining('rx='), findsNothing);
    });

    testWidgets('releases the camera when the app goes to the background',
        (tester) async {
      await pumpScan(tester);
      expect(camera.openCameras, 1);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await settleNoAnimations(tester);
      expect(camera.openCameras, 0);
      expect(camera.isStreaming, isFalse);

      // No preview is drawn from the released camera in the meantime.
      expect(tester.takeException(), isNull);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      for (var i = 0; i < 6; i++) {
        await tester.pump();
      }
      expect(camera.openCameras, 1);
      expect(camera.isStreaming, isTrue);
      expect(find.text('Fit the card exactly in the frame'), findsOneWidget);

      // And it scans again.
      ocr.reads = [FakeTextRecognizer.card('Command and Conquer')];
      await frame(tester);
      await frame(tester);
      await tester.pumpAndSettle();
      expect(find.text('Found Command and Conquer.'), findsOneWidget);
    });

    testWidgets('inactive then paused then resumed restarts the camera once',
        (tester) async {
      await pumpScan(tester);

      tester.binding
          .handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await settleNoAnimations(tester);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await settleNoAnimations(tester);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      for (var i = 0; i < 6; i++) {
        await tester.pump();
      }

      expect(camera.openCameras, 1);
      expect(camera.presetsTried, hasLength(2));
      expect(camera.isStreaming, isTrue);
    });

    testWidgets('coming back to a locked result keeps it and stays paused',
        (tester) async {
      await pumpScan(tester);
      ocr.reads = [FakeTextRecognizer.card('Command and Conquer')];
      await frame(tester);
      await frame(tester);
      await tester.pumpAndSettle();

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await settleNoAnimations(tester);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      for (var i = 0; i < 6; i++) {
        await tester.pump();
      }
      await tester.pumpAndSettle();

      expect(row('Command and Conquer'), findsOneWidget);
      expect(find.text('Scan again'), findsOneWidget);
      expect(camera.isStreaming, isFalse);
    });

    testWidgets('without a camera, backgrounding and returning changes nothing',
        (tester) async {
      await pumpScan(tester, platform: FakeCameraPlatform(cameras: []));

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();

      expect(camera.availableCamerasCalls, 1);
      expect(find.text('Camera unavailable'), findsOneWidget);
    });

    testWidgets('releases the camera when the screen closes', (tester) async {
      await pumpScan(tester);

      await tester.pumpWidget(const SizedBox());
      await settle(tester);

      expect(camera.openCameras, 0);
      expect(camera.isStreaming, isFalse);
    });
  });

  group('browsing (default)', () {
    testWidgets('tapping a result opens the card', (tester) async {
      await pumpScan(tester, platform: FakeCameraPlatform(cameras: []));
      await typeLookup(tester, 'Command and Conquer');

      await tester.tap(row('Command and Conquer'));
      await tester.pumpAndSettle();

      expect(find.byType(CardDetailScreen), findsOneWidget);
    });

    testWidgets('nothing is added to the trade or Binder by scanning alone',
        (tester) async {
      final c = await pumpScan(tester);
      ocr.reads = [FakeTextRecognizer.card('Command and Conquer')];
      await frame(tester);
      await frame(tester);
      await tester.pumpAndSettle();

      expect(c.read(tradeDraftProvider).haveItems, isEmpty);
      expect(c.read(tradeDraftProvider).wantItems, isEmpty);
      expect(c.read(binderProvider), isEmpty);
      expect(analytics.count('scan_card_added'), 0);
    });
  });

  group('scanning into a trade', () {
    testWidgets('adds the tapped card to that side and keeps scanning',
        (tester) async {
      final c = await pumpScan(
        tester,
        destination: ScanDestination.trade,
        tradeSide: TradeSide.want,
      );
      expect(find.text('Scan a card to add'), findsOneWidget);
      expect(
          analytics.propertiesOf('scan_opened'), {'destination': 'trade_theirs'});

      ocr.reads = [FakeTextRecognizer.card('Command and Conquer')];
      await frame(tester);
      await frame(tester);
      await tester.pumpAndSettle();
      await tester.tap(row('Command and Conquer'));
      await tester.pumpAndSettle();

      final draft = c.read(tradeDraftProvider);
      expect(draft.wantItems.single.card.id, 'cnc');
      expect(draft.wantItems.single.quantity, 1);
      expect(draft.wantItems.single.priceEach, 60);
      expect(draft.haveItems, isEmpty);

      expect(find.text('Added to trade'), findsOneWidget);
      expect(find.byType(CardRow), findsNothing);
      expect(find.text('Point at a card to identify it.'), findsOneWidget);
      expect(camera.isStreaming, isTrue);
      expect(analytics.propertiesOf('scan_card_added'), {
        'card_id': 'cnc',
        'destination': 'trade_theirs',
      });
    });

    testWidgets('"my cards" go to my side', (tester) async {
      final c = await pumpScan(
        tester,
        platform: FakeCameraPlatform(cameras: []),
        destination: ScanDestination.trade,
        tradeSide: TradeSide.have,
      );
      await typeLookup(tester, 'snatch');
      await tester.tap(row('Snatch (Red)'));
      await tester.pumpAndSettle();

      expect(c.read(tradeDraftProvider).haveItems.single.card.id, 'snatch');
      expect(c.read(tradeDraftProvider).wantItems, isEmpty);
      expect(analytics.propertiesOf('scan_card_added')!['destination'],
          'trade_mine');
    });

    testWidgets('adds the exact printing that was tapped', (tester) async {
      final c = await pumpScan(
        tester,
        platform: FakeCameraPlatform(cameras: []),
        destination: ScanDestination.trade,
        tradeSide: TradeSide.want,
      );
      await typeLookup(tester, 'Enlightened Strike');

      // Rows are the two printings; pick the foil by its price.
      await tester.tap(find.ancestor(
        of: find.textContaining('90.00'),
        matching: find.byType(CardRow),
      ));
      await tester.pumpAndSettle();

      final item = c.read(tradeDraftProvider).wantItems.single;
      expect(item.card.id, 'es-rf');
      expect(item.priceEach, 90);
    });

    testWidgets('"1 more" adds another copy without re-scanning',
        (tester) async {
      final c = await pumpScan(
        tester,
        platform: FakeCameraPlatform(cameras: []),
        destination: ScanDestination.trade,
        tradeSide: TradeSide.want,
      );
      await typeLookup(tester, 'snatch');
      await tester.tap(row('Snatch (Red)'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('1 more'));
      await tester.pump();
      await tester.tap(find.text('1 more'));
      await tester.pump();

      expect(find.text('Added 3 to trade'), findsOneWidget);
      expect(c.read(tradeDraftProvider).wantItems.single.quantity, 3);
      expect(analytics.count('scan_card_added'), 3);
    });

    testWidgets('scanning the same card twice merges into one line',
        (tester) async {
      final c = await pumpScan(
        tester,
        platform: FakeCameraPlatform(cameras: []),
        destination: ScanDestination.trade,
        tradeSide: TradeSide.want,
      );
      for (var i = 0; i < 2; i++) {
        await typeLookup(tester, 'snatch');
        await tester.tap(row('Snatch (Red)'));
        await tester.pumpAndSettle();
      }

      expect(c.read(tradeDraftProvider).wantItems.single.quantity, 2);
      expect(find.text('Added 2 to trade'), findsOneWidget);
    });

    testWidgets('a different card restarts the added count', (tester) async {
      final c = await pumpScan(
        tester,
        platform: FakeCameraPlatform(cameras: []),
        destination: ScanDestination.trade,
        tradeSide: TradeSide.want,
      );
      await typeLookup(tester, 'snatch');
      await tester.tap(row('Snatch (Red)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('1 more'));
      await tester.pump();

      await typeLookup(tester, 'Command and Conquer');
      await tester.tap(row('Command and Conquer'));
      await tester.pumpAndSettle();

      expect(find.text('Added to trade'), findsOneWidget);
      expect(find.text('Added 2 to trade'), findsNothing);
      expect(c.read(tradeDraftProvider).wantItems, hasLength(2));
    });

    testWidgets('dismissing the confirmation keeps the card in the trade',
        (tester) async {
      final c = await pumpScan(
        tester,
        platform: FakeCameraPlatform(cameras: []),
        destination: ScanDestination.trade,
        tradeSide: TradeSide.want,
      );
      await typeLookup(tester, 'snatch');
      await tester.tap(row('Snatch (Red)'));
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Dismiss'));
      await tester.pump();

      expect(find.text('Added to trade'), findsNothing);
      expect(find.text('1 more'), findsNothing);
      expect(c.read(tradeDraftProvider).wantItems.single.quantity, 1);
    });
  });

  group('scanning into the Binder', () {
    testWidgets('adds the tapped card to the Trade Binder by default',
        (tester) async {
      final c = await pumpScan(
        tester,
        platform: FakeCameraPlatform(cameras: []),
        destination: ScanDestination.binder,
      );
      expect(find.text('Scan into Binder'), findsOneWidget);

      await typeLookup(tester, 'snatch');
      await tester.tap(row('Snatch (Red)'));
      await tester.pumpAndSettle();

      final entry = c.read(binderProvider).single;
      expect(entry.card.id, 'snatch');
      expect(entry.quantity, 1);
      expect(entry.condition, 'NM');
      expect(entry.isWanted, isFalse);
      expect(entry.resolvedBinderId, BinderIds.trade);
      expect(c.read(tradeDraftProvider).wantItems, isEmpty);
      expect(find.text('Added to Binder'), findsOneWidget);
      expect(analytics.propertiesOf('scan_card_added'), {
        'card_id': 'snatch',
        'destination': 'binder',
      });
    });

    testWidgets('"1 more" raises the quantity of the same entry',
        (tester) async {
      final c = await pumpScan(
        tester,
        platform: FakeCameraPlatform(cameras: []),
        destination: ScanDestination.binder,
      );
      await typeLookup(tester, 'snatch');
      await tester.tap(row('Snatch (Red)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('1 more'));
      await tester.pump();

      expect(c.read(binderProvider).single.quantity, 2);
      expect(find.text('Added 2 to Binder'), findsOneWidget);
    });

    testWidgets('a live scan lands in the Binder and scanning resumes',
        (tester) async {
      final c =
          await pumpScan(tester, destination: ScanDestination.binder);
      ocr.reads = [FakeTextRecognizer.card('Command and Conquer')];
      await frame(tester);
      await frame(tester);
      await tester.pumpAndSettle();

      await tester.tap(row('Command and Conquer'));
      await tester.pumpAndSettle();

      expect(c.read(binderProvider).single.card.id, 'cnc');
      expect(camera.isStreaming, isTrue);
      expect(find.byType(CardRow), findsNothing);
    });
  });
}
