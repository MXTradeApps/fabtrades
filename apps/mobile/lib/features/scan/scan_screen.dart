import 'dart:async';
import 'dart:io' show Platform;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:showcaseview/showcaseview.dart';

import '../../app/app.dart';
import '../../app/card_actions.dart';
import '../../app/widgets.dart';
import '../../core/analytics/analytics.dart';
import '../../core/data/card_repository.dart';
import '../../core/models/binder.dart';
import '../../core/models/card_model.dart';
import '../../core/models/trade.dart';
import '../../core/providers.dart';
import '../../core/scan/frame_hasher.dart';
import '../../core/scan/ocr_guide_filter.dart';
import '../card_detail/card_detail_screen.dart';
import '../onboarding/onboarding_keys.dart';
import '../onboarding/onboarding_provider.dart';
import '../onboarding/onboarding_repository.dart';
import '../onboarding/showcase_theme.dart';
import '../onboarding/tour_controller.dart';
import '../onboarding/tour_copy.dart';
import '../paywall/pro_limits.dart';

/// Where a locked scan match goes when the user taps it.
enum ScanDestination {
  /// Open card detail (default browse mode).
  detail,

  /// Add to a side of the live trade draft and keep scanning.
  trade,

  /// Add to the Binder (qty+1, NM) and keep scanning.
  binder,
}

/// Live card scanner. Streams camera frames through two offline recognizers —
/// a perceptual-hash match of the card image inside the guide rectangle
/// against precomputed hashes of every catalog scan, and ML Kit OCR of the
/// printed name + collector number — then fuses both candidate lists. Locks
/// onto a card once the same top match is seen on two consecutive frames, so
/// a steady aim identifies it hands-free. A locked result lists every catalog
/// printing of the identified card, best matches first.
class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({
    super.key,
    this.destination = ScanDestination.detail,
    this.tradeSide,
  }) : assert(
          destination != ScanDestination.trade || tradeSide != null,
          'tradeSide is required when destination is trade',
        );

  final ScanDestination destination;

  /// Required when [destination] is [ScanDestination.trade].
  final TradeSide? tradeSide;

  /// Opens the scanner wired to add scanned cards to [side] of the trade draft.
  static Future<void> forTrade(BuildContext context, TradeSide side) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'Scan'),
        builder: (_) => ScanScreen(
          destination: ScanDestination.trade,
          tradeSide: side,
        ),
      ),
    );
  }

  /// Opens the scanner wired to add scanned cards to the Binder.
  static Future<void> forBinder(BuildContext context) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'Scan'),
        builder: (_) =>
            const ScanScreen(destination: ScanDestination.binder),
      ),
    );
  }

  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen>
    with WidgetsBindingObserver {
  /// Device-orientation → degrees, used to compute ML Kit's rotation on Android.
  static const _orientationDegrees = {
    DeviceOrientation.portraitUp: 0,
    DeviceOrientation.landscapeLeft: 90,
    DeviceOrientation.portraitDown: 180,
    DeviceOrientation.landscapeRight: 270,
  };

  /// Cap OCR to a sustainable rate; running it on every frame floods the
  /// pipeline and drops UI frames. Also the mitigation for trying
  /// [ResolutionPreset.veryHigh] first (higher res costs OCR CPU per frame).
  static const _throttle = Duration(milliseconds: 350);

  /// Try higher resolution first so the ~6pt bottom-left set code has more
  /// pixels; fall back if `initialize()` throws. Order is trivially
  /// revertible — a camera init failure kills scanning entirely.
  static const _resolutionPresets = [
    ResolutionPreset.veryHigh,
    ResolutionPreset.high,
  ];

  CameraController? _controller;
  final _recognizer = TextRecognizer(script: TextRecognitionScript.latin);

  bool _initializing = true;
  bool _cameraAvailable = false;
  bool _streaming = false;
  bool _processing = false;
  bool _torchOn = false;
  DateTime? _lastProcessedAt;

  /// True once we've locked onto a result and paused the live scan.
  bool _locked = false;

  // Two-frame confirmation to reject transient false positives.
  String? _pendingKey;
  int _pendingHits = 0;
  /// Consecutive empty frames while a pending read is in flight. OCR on a
  /// real Pixel flickers empty between good frames; one miss must not wipe
  /// progress or the gate never reaches 2.
  int _pendingMisses = 0;

  String? _statusMessage;
  List<CardModel> _matches = const [];
  /// How many leading entries of [_matches] the recognizer actually matched
  /// (the "Best matches" section); the rest are other printings of the same
  /// card filled in by [expandScanMatchesToPrintings].
  int _rankedCount = 0;
  /// OCR text from the most recent successfully processed frame (the wider
  /// number/code guide pass — see [kNumberGuideInflateFraction]). Used at lock
  /// time to promote a printing whose printed set code was read, and fed into
  /// [parseSetCodes] / [parseScanNumbers] during live fusion.
  String _lastOcrText = '';
  String? _lastNumber;

  /// On-device diagnostics (bug icon in the app bar) so scan failures can be
  /// inspected on a phone without a tethered console — the per-frame pipeline
  /// stats and any camera error are drawn over the viewport when enabled.
  bool _showDiag = false;
  String? _lastDiag;
  DateTime? _lastDiagAt;
  String? _cameraError;

  /// Frames delivered by the camera stream vs frames the pipeline actually
  /// processed. If rx stops climbing the camera stream died; if rx climbs but
  /// proc doesn't, something inside `_processImage` is stuck (e.g. ML Kit
  /// never completing and leaving `_processing` latched).
  int _framesReceived = 0;
  int _framesProcessed = 0;

  /// Repaints the overlay once a second while diagnostics are shown, so the
  /// counters / "last frame X s ago" stay live even when no frames arrive.
  Timer? _diagTicker;

  /// The luma grid the hasher actually sampled, rendered as a tiny image —
  /// shows exactly what the visual matcher "sees" inside the guide.
  ui.Image? _diagGrid;

  /// Mirrors every `[DEBUG-scan]` console line into the on-screen overlay.
  void _recordDiag(String line) {
    debugPrint('[DEBUG-scan] $line');
    _lastDiag = line;
    _lastDiagAt = DateTime.now();
    if (_showDiag && mounted) setState(() {});
  }

  void _toggleDiag() {
    setState(() => _showDiag = !_showDiag);
    _diagTicker?.cancel();
    _diagTicker = _showDiag
        ? Timer.periodic(const Duration(seconds: 1), (_) {
            if (mounted) setState(() {});
          })
        : null;
  }

  /// Renders the sampled 64×64 luma grid into [_diagGrid] for the overlay.
  void _updateDiagGrid(Float64List grid) {
    final px = Uint8List(grid.length * 4);
    for (var i = 0; i < grid.length; i++) {
      final v = grid[i].clamp(0.0, 255.0).round();
      px[i * 4] = v;
      px[i * 4 + 1] = v;
      px[i * 4 + 2] = v;
      px[i * 4 + 3] = 255;
    }
    ui.decodeImageFromPixels(px, kGraySide, kGraySide, ui.PixelFormat.rgba8888,
        (img) {
      if (!mounted || !_showDiag) {
        img.dispose();
        return;
      }
      _diagGrid = img;
      setState(() {});
    });
  }

  bool _scanTourStarted = false;

  /// Analytics label for where a locked/added scan result goes: `detail`,
  /// `trade_mine`/`trade_theirs` (see [TradeSideAnalytics]), or `binder`.
  String get _destinationLabel => switch (widget.destination) {
        ScanDestination.detail => 'detail',
        ScanDestination.binder => 'binder',
        ScanDestination.trade =>
          'trade_${widget.tradeSide?.analyticsLabel ?? 'unknown'}',
      };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ref
        .read(analyticsProvider)
        .capture('scan_opened', {'destination': _destinationLabel});
    ShowcaseView.register(
      scope: OnboardingKeys.scanScope,
      disableMovingAnimation: true,
      skipIfTargetNotPresent: true,
      globalTooltipActionConfig: ShowcaseTheme.actionConfig,
      globalTooltipActions: ShowcaseTheme.homeActions,
      onFinish: _finishScanTour,
      onDismiss: (_) => _finishScanTour(),
    );
    _initCamera();
  }

  void _finishScanTour() {
    ref.read(onboardingProvider.notifier).markSeen(OnboardingTourId.scan);
  }

  void _maybeStartScanTour() {
    if (_scanTourStarted) return;
    if (ref.read(onboardingProvider).contains(OnboardingTourId.scan)) return;
    _scanTourStarted = true;
    TourController(ref).startScanTour();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    ShowcaseView.getNamed(OnboardingKeys.scanScope).unregister();
    _diagTicker?.cancel();
    _disposeCamera();
    _recognizer.close();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      _disposeCamera();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
    }
  }

  Future<void> _disposeCamera() async {
    final controller = _controller;
    _controller = null;
    _streaming = false;
    if (controller == null) return;
    try {
      if (controller.value.isStreamingImages) {
        await controller.stopImageStream();
      }
    } catch (_) {}
    await controller.dispose();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (!mounted) return;
        ref.read(analyticsProvider).capture('scan_failed', {
          'destination': _destinationLabel,
          'error_type': 'no_camera',
        });
        setState(() {
          _cameraError = 'No cameras reported by the OS.';
          _initializing = false;
          _cameraAvailable = false;
        });
        // Permission / device prompt is done; safe to teach framing.
        WidgetsBinding.instance
            .addPostFrameCallback((_) => _maybeStartScanTour());
        return;
      }
      final back = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      final formatGroup = Platform.isAndroid
          ? ImageFormatGroup.nv21
          : ImageFormatGroup.bgra8888;

      // Attempt veryHigh first (set code is only a few pixels at 720p); dispose
      // and fall back to high if initialize throws so a single bad preset
      // cannot kill scanning entirely.
      CameraController? controller;
      Object? lastError;
      for (final preset in _resolutionPresets) {
        final candidate = CameraController(
          back,
          preset,
          enableAudio: false,
          imageFormatGroup: formatGroup,
        );
        try {
          await candidate.initialize();
          controller = candidate;
          if (preset != _resolutionPresets.first) {
            _recordDiag('camera resolution fallback to $preset');
          } else {
            _recordDiag('camera resolution=$preset');
          }
          break;
        } catch (e) {
          lastError = e;
          _recordDiag('camera preset $preset failed: $e');
          await candidate.dispose();
        }
      }
      if (controller == null) {
        throw lastError ?? Exception('No resolution preset initialized');
      }
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _controller = controller;
        _cameraAvailable = true;
        _cameraError = null;
        _initializing = false;
        _torchOn = false;
      });
      // Camera permission has resolved by now — coach marks must not sit
      // under the OS permission dialog.
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _maybeStartScanTour());
      if (!_locked) await _startStream();
    } catch (e) {
      _recordDiag('camera init failed: $e');
      if (!mounted) return;
      final code = e is CameraException ? e.code.toLowerCase() : '';
      final isPermission =
          code.contains('denied') || code.contains('permission');
      ref.read(analyticsProvider).capture(
        isPermission ? 'scan_permission_denied' : 'scan_failed',
        {
          'destination': _destinationLabel,
          'error_type': e is CameraException ? e.code : 'unknown',
        },
      );
      setState(() {
        _cameraError = 'Camera init failed: $e';
        _initializing = false;
        _cameraAvailable = false;
      });
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _maybeStartScanTour());
    }
  }

  Future<void> _startStream() async {
    final controller = _controller;
    if (controller == null || _streaming) return;
    try {
      await controller.startImageStream(_processImage);
      _streaming = true;
      if (mounted && _statusMessage == null) {
        setState(() => _statusMessage = 'Point at a card to identify it.');
      }
    } catch (e) {
      _recordDiag('stream start failed: $e');
      if (mounted) {
        setState(() => _cameraError = 'Stream start failed: $e');
      }
    }
  }

  Future<void> _stopStream() async {
    final controller = _controller;
    if (controller == null || !_streaming) return;
    _streaming = false;
    try {
      if (controller.value.isStreamingImages) {
        await controller.stopImageStream();
      }
    } catch (_) {}
  }

  Future<void> _processImage(CameraImage image) async {
    _framesReceived++;
    if (_processing || _locked) return;
    final now = DateTime.now();
    if (_lastProcessedAt != null &&
        now.difference(_lastProcessedAt!) < _throttle) {
      return;
    }
    _processing = true;
    _lastProcessedAt = now;
    _framesProcessed++;
    try {
      final rotation = _rotationDegrees();
      if (rotation == null) {
        _recordDiag(
            'rot=null orient=${_controller?.value.deviceOrientation} '
            'sensor=${_controller?.description.sensorOrientation}');
        return;
      }

      final catalog = ref.read(catalogProvider).asData?.value ?? const [];
      if (catalog.isEmpty) {
        if (mounted) setState(() => _statusMessage = 'Loading card catalog…');
        return;
      }

      final frameSw = Stopwatch()..start();

      // Signal 1: perceptual hash of the card inside the guide rectangle,
      // matched against the precomputed catalog hashes.
      var visual = const <CardModel>[];
      var bestDist = -1;
      var zScore = -1.0;
      var hashOk = false;
      final hashSw = Stopwatch()..start();
      // iOS: camera_avfoundation sets videoOrientation on the stream
      // connection to the device orientation, so streamed buffers arrive
      // already rotated upright — rotating again by sensorOrientation samples
      // a sideways region and the hash can never match. Android (Camera2)
      // streams raw sensor-orientation frames and needs the full rotation.
      // ML Kit's InputImage still gets [rotation]: its iOS converter ignores
      // the field, and Android needs it.
      final hashRotation = Platform.isIOS ? 0 : rotation;
      final hashIndex = ref.read(cardHashIndexProvider).asData?.value;
      if (hashIndex != null) {
        final hash = hashCameraFrame(image, hashRotation,
            onGrid: _showDiag ? _updateDiagGrid : null);
        hashOk = hash != null;
        if (hash != null) {
          final byId = ref.read(catalogByIdProvider);
          final matches = hashIndex.match(
            hash,
            onStats: (best, mean, z) {
              bestDist = best;
              zScore = z;
            },
          );
          visual = [
            for (final m in matches)
              for (final id in m.entry.cardIds)
                if (byId[id] != null) byId[id]!,
          ];
        }
      }
      final hashMs = hashSw.elapsedMilliseconds;

      // Signal 2: OCR of the printed name + collector number / set code.
      // Isolated from visual so an ML Kit / format failure on Android cannot
      // discard a successful hash match (that used to silently kill scanning).
      // Name matching is restricted to the tight guide (title band preferred)
      // so a neighbouring card's title under the guide does not win the fuse.
      // Numbers/codes use a second, wider guide pass — see below.
      var ocr = const <CardModel>[];
      var ocrNumbers = const <ScanNumber>[];
      var ocrCodes = const <String>[];
      var codeCards = const <CardModel>[];
      var ocrNote = 'skip';
      var ocrLinesNote = '';
      final ocrSw = Stopwatch()..start();
      final input = _toInputImage(image, rotation);
      if (input == null) {
        final bytes0 =
            image.planes.isEmpty ? 0 : image.planes.first.bytes.length;
        final expectedNv21 = image.width * image.height * 3 ~/ 2;
        ocrNote = 'input=null fmt=${image.format.group}/'
            '${image.format.raw} planes=${image.planes.length} '
            '${image.width}x${image.height} bytes0=$bytes0 '
            'nv21Expect=$expectedNv21';
      } else {
        try {
          // A hung native call would otherwise leave `_processing` latched
          // and silently kill the whole pipeline after one frame.
          final result = await _recognizer
              .processImage(input)
              .timeout(const Duration(seconds: 3));
          if (!mounted || _locked) return;

          // Same upright space as the hasher — use hashRotation, not ML Kit's
          // metadata rotation (iOS buffers are already upright).
          final swap = hashRotation == 90 || hashRotation == 270;
          final rotatedW = (swap ? image.height : image.width).toDouble();
          final rotatedH = (swap ? image.width : image.height).toDouble();
          final guide = guideRectInRotatedFrame(
            rotatedWidth: rotatedW,
            rotatedHeight: rotatedH,
          );

          final lines = <OcrLine>[
            for (final block in result.blocks)
              for (final line in block.lines)
                (
                  left: line.boundingBox.left,
                  top: line.boundingBox.top,
                  right: line.boundingBox.right,
                  bottom: line.boundingBox.bottom,
                  text: line.text,
                ),
          ];

          // Max box extents vs rotated frame size — mismatch means ML Kit's
          // coordinate space has drifted from the hasher's assumption.
          var maxR = 0.0, maxB = 0.0;
          for (final line in lines) {
            if (line.right > maxR) maxR = line.right;
            if (line.bottom > maxB) maxB = line.bottom;
          }

          // Tight pass: names only. A neighbour title bleeding in would win
          // the fuse — keep inflateFraction at the default 0.02.
          final filtered = textInsideGuide(
            lines: lines,
            guideLeft: guide.left,
            guideTop: guide.top,
            guideWidth: guide.width,
            guideHeight: guide.height,
          );

          // Wide pass: numbers/set codes only. The bottom-left code is the
          // first line lost to imperfect framing; codes are exact-match so a
          // wider net is cheap. Pure-Dart loop over ~10 boxes — negligible.
          final wideFiltered = textInsideGuide(
            lines: lines,
            guideLeft: guide.left,
            guideTop: guide.top,
            guideWidth: guide.width,
            guideHeight: guide.height,
            inflateFraction: kNumberGuideInflateFraction,
          );
          final numberText = wideFiltered.linesInGuide > 0
              ? wideFiltered.guideText
              : result.text;

          // Token name-key set is memoized — identifyCards walks the catalog
          // for it when omitted, and this path can call identify twice/frame.
          final tokenNames = ref.read(tokenNameKeysProvider);
          var tokensSuppressed = 0;
          void onTokSup(int n) => tokensSuppressed += n;

          // Prefer title-band text; fall back to all in-guide lines; if
          // nothing lands in the guide, derive a pseudo title band from the
          // union of detected OCR boxes so token mentions in rules text still
          // have a positional gate. Name identification always uses the tight
          // pass (or full-frame fallback) — never the wide number text.
          final String tier;
          if (filtered.linesInGuide == 0) {
            tier = 'full';
            final detected = textInsideDetectedBounds(lines);
            ocr = identifyCards(
              catalog,
              result.text,
              titleText: detected.titleBandText,
              tokenNames: tokenNames,
              onTokensSuppressed: onTokSup,
            );
          } else {
            final titleCandidates = filtered.titleBandText.trim().isEmpty
                ? const <CardModel>[]
                : identifyCards(
                    catalog,
                    filtered.titleBandText,
                    titleText: filtered.titleBandText,
                    tokenNames: tokenNames,
                    onTokensSuppressed: onTokSup,
                  );
            if (titleCandidates.isNotEmpty) {
              tier = 'title';
              ocr = titleCandidates;
            } else {
              tier = 'guide';
              ocr = identifyCards(
                catalog,
                filtered.guideText,
                titleText: filtered.titleBandText,
                tokenNames: tokenNames,
                onTokensSuppressed: onTokSup,
              );
            }
          }

          ocrNumbers = parseScanNumbers(numberText);
          ocrCodes = parseSetCodes(numberText);
          codeCards = findBySetCodes(ref.read(setCodeIndexProvider), ocrCodes);

          // Wider number/code text for lock-time set-code promotion. Assign
          // only on the success path so an OCR exception leaves the previous
          // frame's value alone.
          _lastOcrText = numberText;
          final snippet = numberText.replaceAll('\n', ' ').trim();
          ocrNote = snippet.isEmpty
              ? 'empty'
              : '"${snippet.length > 40 ? '${snippet.substring(0, 40)}…' : snippet}"';
          final codesJoined = ocrCodes.isEmpty ? '-' : ocrCodes.join(',');
          ocrLinesNote =
              'ocrLines=${lines.length}/${filtered.linesInGuide}/'
              '${filtered.linesInTitleBand} tier=$tier '
              'tokSup=$tokensSuppressed '
              'codes=${ocrCodes.length}/$codesJoined '
              'wideLines=${wideFiltered.linesInGuide} '
              'boxMax=${maxR.toStringAsFixed(0)}x${maxB.toStringAsFixed(0)} '
              'rotFrame=${rotatedW.toStringAsFixed(0)}x${rotatedH.toStringAsFixed(0)}';
        } catch (e) {
          // Full exception — PlatformException.message is the useful part.
          ocrNote = 'err=$e fmt=${image.format.group}/${image.format.raw} '
              'planes=${image.planes.length} '
              '${image.width}x${image.height}';
        }
      }
      final ocrMs = ocrSw.elapsedMilliseconds;

      final matches = fuseScanCandidates(
        visual: visual,
        ocr: ocr,
        code: codeCards,
        ocrNumbers: ocrNumbers,
        ocrCodes: ocrCodes,
      );
      _recordDiag(
        'f=$_framesProcessed rot=$rotation hashRot=$hashRotation '
        'hash=${hashOk ? 'ok' : 'null'} '
        'best=$bestDist z=${zScore.toStringAsFixed(1)} '
        'vis=${visual.length} ocr=${ocr.length} code=${codeCards.length} '
        '($ocrNote) '
        '${ocrLinesNote.isEmpty ? '' : '$ocrLinesNote '}'
        '${image.width}x${image.height} '
        'bpr=${image.planes.isEmpty ? 0 : image.planes.first.bytesPerRow} '
        'hashMs=$hashMs ocrMs=$ocrMs totalMs=${frameSw.elapsedMilliseconds}',
      );
      if (matches.isEmpty) {
        if (_pendingKey != null) {
          _pendingMisses++;
          debugPrint(
            '[DEBUG-scan] pending="$_pendingKey" hits=$_pendingHits '
            'misses=$_pendingMisses (empty fuse)',
          );
          if (_pendingMisses < 3) return; // tolerate brief OCR flicker
        }
        _pendingKey = null;
        _pendingHits = 0;
        _pendingMisses = 0;
        return;
      }
      _pendingMisses = 0;

      // Confirm by card identity, not printing id. OCR often returns every
      // foil/set/pitch variant of the same name; keying on printing id made
      // the two-frame gate flip forever and never lock on a Pixel.
      final key = _scanConfirmKey(matches.first);
      if (key == _pendingKey) {
        _pendingHits++;
      } else {
        _pendingKey = key;
        _pendingHits = 1;
      }
      debugPrint('[DEBUG-scan] pending="$key" hits=$_pendingHits');
      if (_pendingHits >= 2) {
        final locked = [
          for (final c in matches)
            if (_scanConfirmKey(c) == key) c
        ];
        debugPrint(
          '[DEBUG-scan] LOCK key="$key" n=${locked.length} '
          'totalMs=${frameSw.elapsedMilliseconds}',
        );
        await _lockOn(locked.isNotEmpty ? locked : matches);
      } else if (mounted) {
        setState(() => _statusMessage =
            'Reading ${matches.first.name}… hold steady.');
      }
    } catch (e, s) {
      _recordDiag('frame err=$e');
      ref.read(analyticsProvider).captureException(
            e,
            s,
            {'source': 'scan_frame'},
          );
    } finally {
      _processing = false;
    }
  }

  /// Stable identity for the two-frame confirmation gate. Strips every
  /// parenthetical (including FAB pitch colors) and any trailing
  /// ` - <SETCODE>` promo suffix so OCR returning Red/Yellow/Blue, foil, or
  /// set-promoted promo variants of the same card still counts as consecutive
  /// hits. Printing id is too unstable: the fused list's top entry flips
  /// between variants every frame and the gate never reaches 2.
  ///
  /// The set-code strip is critical once [fuseScanCandidates] can promote a
  /// promo printing to rank 1 via an exact code hit: without it the key would
  /// flip between `"leaven sheath fab428"` and `"leaven sheath"` across frames
  /// and the gate would never reach 2 — the same class of bug printing-id
  /// keys had for pitch/foil.
  String _scanConfirmKey(CardModel card) {
    final stripped = stripNameSetCode(card.name)
        .replaceAll(RegExp(r'\s*\([^)]*\)'), ' ')
        .trim();
    return stripped.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();
  }

  /// Clockwise rotation (0/90/180/270) that turns a raw sensor frame into the
  /// upright displayed image, per platform (see the ML Kit Flutter example).
  /// Shared by OCR, the frame hasher, and the preview layout.
  int? _rotationDegrees() {
    final controller = _controller;
    if (controller == null) return null;
    final camera = controller.description;
    final sensorOrientation = camera.sensorOrientation;
    if (Platform.isIOS) return sensorOrientation;
    final deviceRotation =
        _orientationDegrees[controller.value.deviceOrientation];
    if (deviceRotation == null) return null;
    return camera.lensDirection == CameraLensDirection.front
        ? (sensorOrientation + deviceRotation) % 360
        : (sensorOrientation - deviceRotation + 360) % 360;
  }

  /// Builds an ML Kit [InputImage] from a streamed camera frame.
  ///
  /// Matches the google_mlkit_commons contract: Android must be a single-plane
  /// NV21 buffer, iOS a single-plane BGRA8888 buffer. Anything else returns
  /// null so OCR is skipped rather than throwing and poisoning the frame.
  ///
  /// On Android we depend on `camera_android` (Camera2) rather than CameraX so
  /// the stream is real NV21 — CameraX often mis-labels / mis-sizes buffers and
  /// ML Kit then throws InputImageConverterError on every frame.
  InputImage? _toInputImage(CameraImage image, int rotationDegrees) {
    final rotation = InputImageRotationValue.fromRawValue(rotationDegrees);
    if (rotation == null) return null;

    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null) return null;
    if (Platform.isAndroid && format != InputImageFormat.nv21) return null;
    if (Platform.isIOS && format != InputImageFormat.bgra8888) return null;
    if (image.planes.length != 1) return null;
    final plane = image.planes.first;

    // NV21 = Y (w*h) + interleaved VU (w*h/2). Reject undersized buffers that
    // make ML Kit's native converter NPE instead of a clear format error.
    if (Platform.isAndroid) {
      final expected = image.width * image.height * 3 ~/ 2;
      if (plane.bytes.length < expected) return null;
    }

    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  /// Locks the scanner on [matches], then expands that short recognizer list
  /// into every catalog printing of the identified card via
  /// [expandScanMatchesToPrintings]. Ranking cutoffs in [identifyCards] /
  /// [fuseScanCandidates] routinely drop promo and alternate-art printings of
  /// a correctly identified card; expanding after lock is how the user can
  /// still pick the printing they're holding.
  Future<void> _lockOn(List<CardModel> matches) async {
    _locked = true;
    await _stopStream();
    if (!mounted) return;
    final catalog = ref.read(catalogProvider).asData?.value ?? const [];
    final expanded = expandScanMatchesToPrintings(
      catalog,
      matches,
      ocrText: _lastOcrText,
    );
    setState(() {
      _matches = expanded.cards;
      _rankedCount = expanded.rankedCount;
      _lastNumber = expanded.cards.first.collectorNumber;
      _statusMessage = expanded.cards.length == 1
          ? 'Found ${expanded.cards.first.name}.'
          : 'Found ${baseCardName(expanded.cards.first.name)} — '
              '${expanded.cards.length} versions, best matches first.';
    });
    final top = expanded.cards.first;
    ref.read(analyticsProvider).capture('card_scanned', {
      'card_id': top.id,
      'card_name': top.name,
      'destination': _destinationLabel,
    });
  }

  /// Adds a scanned card to the trade draft or Binder, confirms with a
  /// snackbar (with an "add another" action for multiples), and immediately
  /// resumes scanning so more cards can be added.
  Future<void> _addLockedCard(CardModel card) async {
    switch (widget.destination) {
      case ScanDestination.trade:
        final side = widget.tradeSide;
        if (side == null) return;
        ref
            .read(tradeDraftProvider.notifier)
            .addCard(side, card, source: 'scan');
        _captureCardAdded(card);
        _showAddedSnackBar(card, destinationLabel: 'trade');
      case ScanDestination.binder:
        // Stop scanning if the free binder is full — continuing to rack up
        // rejected scans would be worse than surfacing the limit once.
        if (!await addToBinderOrUpsell(
          context,
          ref,
          card,
          source: 'scan',
          binderId: ref.read(openBinderIdProvider) ?? BinderIds.trade,
        )) {
          return;
        }
        if (!mounted) return;
        _captureCardAdded(card);
        _showAddedSnackBar(card, destinationLabel: 'Binder');
      case ScanDestination.detail:
        return;
    }
    await _scanAgain();
  }

  void _captureCardAdded(CardModel card) {
    ref.read(analyticsProvider).capture('scan_card_added', {
      'card_id': card.id,
      'destination': _destinationLabel,
    });
  }

  /// Confirms a successful add and offers a one-tap path to bump quantity
  /// again — re-scanning the same card is the hard part of multiples.
  void _showAddedSnackBar(
    CardModel card, {
    required String destinationLabel,
  }) {
    final messenger = ScaffoldMessenger.of(context);
    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        content: Text('Added ${card.name} to $destinationLabel'),
        duration: const Duration(seconds: 5),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Add another ${card.name}',
          onPressed: () {
            unawaited(_addAnotherCopy(card));
          },
        ),
      ),
    );
  }

  /// Increments quantity for a card that was just scanned, without locking
  /// the camera again. Re-shows the snackbar so more copies can be stacked.
  Future<void> _addAnotherCopy(CardModel card) async {
    if (!mounted) return;
    switch (widget.destination) {
      case ScanDestination.trade:
        final side = widget.tradeSide;
        if (side == null) return;
        ref
            .read(tradeDraftProvider.notifier)
            .addCard(side, card, source: 'scan');
        _captureCardAdded(card);
        _showAddedSnackBar(card, destinationLabel: 'trade');
      case ScanDestination.binder:
        if (!await addToBinderOrUpsell(
          context,
          ref,
          card,
          source: 'scan',
          binderId: ref.read(openBinderIdProvider) ?? BinderIds.trade,
        )) {
          return;
        }
        if (!mounted) return;
        _captureCardAdded(card);
        _showAddedSnackBar(card, destinationLabel: 'Binder');
      case ScanDestination.detail:
        return;
    }
  }

  Future<void> _scanAgain() async {
    setState(() {
      _locked = false;
      _matches = const [];
      _rankedCount = 0;
      _pendingKey = null;
      _pendingHits = 0;
      _pendingMisses = 0;
      _statusMessage = 'Point at a card to identify it.';
    });
    if (_controller == null) {
      await _initCamera();
    } else {
      await _startStream();
    }
  }

  Future<void> _toggleTorch() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    try {
      final next = !_torchOn;
      await controller.setFlashMode(next ? FlashMode.torch : FlashMode.off);
      if (mounted) setState(() => _torchOn = next);
    } catch (_) {}
  }

  Future<void> _manualEntry() async {
    final controller = TextEditingController(text: _lastNumber ?? '');
    final result = await showAdaptiveDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog.adaptive(
        title: const Text('Find a card'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Name or number, e.g. 147/219',
          ),
          onSubmitted: (v) => Navigator.pop(ctx, v.trim()),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Look up'),
          ),
        ],
      ),
    );
    if (result != null && result.isNotEmpty) {
      await _lookup(result);
    }
  }

  /// Resolves free text (a name or a collector number) against the catalog,
  /// falling back to a network lookup by number if the catalog isn't loaded.
  /// Applies the same printing expansion as [_lockOn] so a typed set code
  /// (e.g. `FAB428`) also promotes that printing into the best-matches prefix.
  Future<void> _lookup(String text) async {
    _locked = true;
    await _stopStream();
    final parsed = parseScanNumber(text);
    setState(() {
      _lastNumber = parsed?.total != null
          ? '${parsed!.number.toString().padLeft(3, '0')}/${parsed.total}'
          : _lastNumber;
      _statusMessage = 'Looking up “$text”…';
      _matches = const [];
      _rankedCount = 0;
    });
    try {
      final catalog = ref.read(catalogProvider).asData?.value ?? const [];
      var matches = identifyCards(catalog, text, limit: 30);
      if (matches.isEmpty && catalog.isEmpty && _lastNumber != null) {
        matches = await ref
            .read(cardRepositoryProvider)
            .findByCollectorNumber(_lastNumber!);
      }
      // Empty catalog leaves matches unchanged (network fallback still works).
      final expanded = expandScanMatchesToPrintings(
        catalog,
        matches,
        ocrText: text,
      );
      if (!mounted) return;
      setState(() {
        _matches = expanded.cards;
        _rankedCount = expanded.rankedCount;
        _statusMessage = expanded.cards.isEmpty
            ? 'No card found for “$text”.'
            : expanded.cards.length == 1
                ? 'Found ${expanded.cards.first.name}.'
                : 'Found ${baseCardName(expanded.cards.first.name)} — '
                    '${expanded.cards.length} versions, best matches first.';
      });
    } catch (e) {
      if (mounted) setState(() => _statusMessage = 'Lookup failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    // Keep the widget rebuilding as the catalog finishes loading, and warm the
    // hash index so it's ready by the first frame.
    ref.watch(catalogProvider);
    ref.watch(cardHashIndexProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(switch (widget.destination) {
          ScanDestination.trade => 'Scan a card to add',
          ScanDestination.binder => 'Scan into Binder',
          ScanDestination.detail => 'Scan',
        }),
        actions: [
          if (_cameraAvailable && !_locked)
            IconButton(
              icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
              tooltip: 'Toggle flash',
              onPressed: _toggleTorch,
            ),
          IconButton(
            icon: const Icon(Icons.keyboard),
            tooltip: 'Enter name or number',
            onPressed: _manualEntry,
          ),
          IconButton(
            icon: Icon(
                _showDiag ? Icons.bug_report : Icons.bug_report_outlined),
            tooltip: 'Scan diagnostics',
            onPressed: _toggleDiag,
          ),
          const AppMenuAction(),
        ],
      ),
      body: _buildBody(),
      floatingActionButton: (_cameraAvailable && _locked)
          ? FloatingActionButton.extended(
              heroTag: 'scanAgainFab',
              onPressed: _scanAgain,
              icon: const Icon(Icons.camera_alt),
              label: const Text('Scan again'),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  /// Camera available: Stack so the match list can cover the preview.
  /// Camera unavailable: plain Column — nothing useful to overlay.
  Widget _buildBody() {
    final showSheet = _cameraAvailable && _matches.isNotEmpty;
    final column = Column(
      children: [
        // Whole viewport is the framing target so the tip still has a home
        // when the camera is unavailable (tests / denied permission).
        ShowcaseTheme.mark(
          key: OnboardingKeys.scanOverlay,
          scope: OnboardingKeys.scanScope,
          title: TourCopy.scanFrameTitle,
          description: TourCopy.scanFrameBody,
          child: _buildViewport(),
        ),
        if (_statusMessage != null && !showSheet)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: Text(
              _statusMessage!,
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
        Expanded(child: showSheet ? const SizedBox.shrink() : _buildMatches()),
      ],
    );
    if (!_cameraAvailable) return column;
    return Stack(children: [column, if (showSheet) _buildMatchSheet()]);
  }

  Widget _buildMatchSheet() {
    final multi = _matches.length > 1;
    return DraggableScrollableSheet(
      initialChildSize: multi ? 0.6 : 0.35,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      builder: (context, scrollController) {
        final scheme = Theme.of(context).colorScheme;
        return Material(
          color: scheme.surface,
          elevation: 8,
          shadowColor: Colors.black54,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: scheme.onSurfaceVariant.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              if (_statusMessage != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: Text(
                    _statusMessage!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: scheme.onSurfaceVariant),
                  ),
                ),
              Expanded(
                child: _buildMatches(scrollController: scrollController),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildViewport() {
    if (_initializing) {
      return const AspectRatio(
        aspectRatio: 3 / 4,
        child: Center(child: CircularProgressIndicator.adaptive()),
      );
    }
    if (!_cameraAvailable || _controller == null) {
      return Container(
        height: 220,
        margin: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.no_photography_outlined,
                size: 40, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
            const Text('Camera unavailable'),
            if (_cameraError != null) ...[
              const SizedBox(height: 4),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  _cameraError!,
                  textAlign: TextAlign.center,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 4),
            Text(
              'Enter a name or collector number instead.',
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            FilledButton.tonalIcon(
              icon: const Icon(Icons.keyboard),
              label: const Text('Find a card'),
              onPressed: _manualEntry,
            ),
          ],
        ),
      );
    }
    // Render the preview with BoxFit.cover so the visible region (and thus the
    // guide rectangle) maps deterministically onto the camera frame — the
    // frame hasher in frame_hasher.dart mirrors this exact geometry.
    final controller = _controller!;
    Widget camera = CameraPreview(controller);
    final previewSize = controller.value.previewSize;
    if (previewSize != null) {
      final rotation = _rotationDegrees() ?? 0;
      final swap = rotation == 90 || rotation == 270;
      camera = FittedBox(
        fit: BoxFit.cover,
        clipBehavior: Clip.hardEdge,
        child: SizedBox(
          width: swap ? previewSize.height : previewSize.width,
          height: swap ? previewSize.width : previewSize.height,
          child: camera,
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.all(12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: AspectRatio(
          aspectRatio: kViewportAspect,
          child: Stack(
            fit: StackFit.expand,
            children: [
              camera,
              _ScanOverlay(scanning: _streaming && !_locked),
              if (_showDiag)
                Positioned(
                  left: 8,
                  right: 8,
                  bottom: 8,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.65),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_diagGrid != null) ...[
                          // The sampled grid is square; stretch it back to
                          // card aspect so it reads like the crop it is.
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: RawImage(
                              image: _diagGrid,
                              width: 63,
                              height: 88,
                              fit: BoxFit.fill,
                              filterQuality: FilterQuality.none,
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Expanded(
                          child: Text(
                            [
                              ?_cameraError,
                              _lastDiag ?? 'waiting for first frame…',
                              'rx=$_framesReceived proc=$_framesProcessed'
                                  '${_lastDiagAt == null ? '' : ' last=${DateTime.now().difference(_lastDiagAt!).inSeconds}s ago'}',
                            ].join('\n'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMatches({ScrollController? scrollController}) {
    if (_matches.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ShowcaseTheme.mark(
            key: OnboardingKeys.scanAutoHint,
            scope: OnboardingKeys.scanScope,
            title: TourCopy.scanAutoTitle,
            description: TourCopy.scanAutoBody,
            child: Text(
              _cameraAvailable
                  ? 'Hold a card steady inside the frame. It identifies automatically — no button needed.'
                  : 'Use the keyboard icon to find a card by name or collector number.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
        ),
      );
    }
    final pricing = ref.watch(pricingProvider);
    // String = section header; CardModel = card row. Headers only when the
    // expansion actually appended other printings beyond the ranked prefix.
    final items = <Object>[];
    final showHeaders = _rankedCount > 0 && _rankedCount < _matches.length;
    if (showHeaders) {
      items.add('Best matches');
      items.addAll(_matches.take(_rankedCount));
      items.add('Other versions of this card');
      items.addAll(_matches.skip(_rankedCount));
    } else {
      items.addAll(_matches);
    }
    return ListView.separated(
      controller: scrollController,
      padding: const EdgeInsets.only(bottom: 96),
      itemCount: items.length,
      separatorBuilder: (_, i) {
        if (items[i] is String || items[i + 1] is String) {
          return const SizedBox.shrink();
        }
        return const Divider(height: 1, indent: 72);
      },
      itemBuilder: (context, i) {
        final item = items[i];
        if (item is String) {
          final theme = Theme.of(context);
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
            child: Text(
              item.toUpperCase(),
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
              ),
            ),
          );
        }
        final card = item as CardModel;
        final quickAdd = widget.destination == ScanDestination.trade ||
            widget.destination == ScanDestination.binder;
        if (quickAdd) {
          return CardRow(
            card: card,
            priceLabel: pricing.priceLabel(card),
            secondaryLabel: pricing.lowPriceLabel(card),
            trailing: const Icon(Icons.add_circle),
            onTap: () => _addLockedCard(card),
          );
        }
        return CardRow(
          card: card,
          priceLabel: pricing.priceLabel(card),
          secondaryLabel: pricing.lowPriceLabel(card),
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
              settings: const RouteSettings(name: 'Card Detail'),
              builder: (_) => CardDetailScreen(card: card, source: 'scan'))),
          onAdd: () => showCardActions(context, ref, card),
        );
      },
    );
  }
}

/// Card-shaped guide rectangle. Its geometry (centered, [kGuideWidthFraction]
/// of the viewport width, physical card aspect) is shared with the frame
/// hasher, so a card that fills the guide is exactly the region being matched.
class _ScanOverlay extends StatelessWidget {
  const _ScanOverlay({required this.scanning});

  final bool scanning;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: FractionallySizedBox(
          widthFactor: kGuideWidthFraction,
          child: AspectRatio(
            aspectRatio: kCardAspect,
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(
                  color: scanning ? Colors.lightGreenAccent : Colors.white70,
                  width: 2,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Text(
                    scanning ? 'Fit the card exactly in the frame' : 'Paused',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
