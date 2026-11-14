import 'dart:async';

import 'package:camera_platform_interface/camera_platform_interface.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/scan/frame_hasher.dart';

/// Stands in for the device camera so the scan screen can run under
/// `flutter test`: it reports cameras (or fails to), "initializes" them, and
/// lets a test push frames into the image stream.
class FakeCameraPlatform extends CameraPlatform {
  FakeCameraPlatform({
    List<CameraDescription>? cameras,
    this.availableCamerasError,
    this.initializeError,
    this.failingPresets = const {},
  }) : cameras = cameras ?? const [backCamera];

  static const backCamera = CameraDescription(
    name: 'back',
    lensDirection: CameraLensDirection.back,
    sensorOrientation: 90,
  );

  /// Frame size in sensor orientation. Rotated upright it is 480 × 640.
  static const frameWidth = 640;
  static const frameHeight = 480;

  final List<CameraDescription> cameras;

  /// Thrown by [availableCameras], e.g. a denied permission.
  Object? availableCamerasError;

  /// Thrown by every [initializeCamera].
  Object? initializeError;

  /// Resolution presets whose [initializeCamera] fails.
  final Set<ResolutionPreset> failingPresets;

  final presetsTried = <ResolutionPreset?>[];
  final flashModes = <FlashMode>[];
  final disposedIds = <int>[];
  int availableCamerasCalls = 0;

  int _nextId = 1;
  final _presetById = <int, ResolutionPreset?>{};
  final _initialized = <int, StreamController<CameraInitializedEvent>>{};
  // Synchronous so a pushed frame reaches the screen before the test's next line.
  final _frames = StreamController<CameraImageData>.broadcast(sync: true);

  /// Whether the screen is currently listening for frames.
  bool get isStreaming => _frames.hasListener;

  /// Camera ids created and not yet disposed.
  int get openCameras => _presetById.length - disposedIds.length;

  /// Delivers one camera frame to whoever started the image stream.
  void pushFrame() {
    _frames.add(
      CameraImageData(
        format: const CameraImageFormat(ImageFormatGroup.nv21, raw: 17),
        width: frameWidth,
        height: frameHeight,
        planes: [
          CameraImagePlane(
            bytes: Uint8List(frameWidth * frameHeight * 3 ~/ 2),
            bytesPerRow: frameWidth,
            width: frameWidth,
            height: frameHeight,
          ),
        ],
      ),
    );
  }

  @override
  Future<List<CameraDescription>> availableCameras() async {
    availableCamerasCalls++;
    final error = availableCamerasError;
    if (error != null) throw error;
    return cameras;
  }

  @override
  Future<int> createCameraWithSettings(
    CameraDescription cameraDescription,
    MediaSettings mediaSettings,
  ) async {
    final id = _nextId++;
    _presetById[id] = mediaSettings.resolutionPreset;
    presetsTried.add(mediaSettings.resolutionPreset);
    _initialized[id] = StreamController<CameraInitializedEvent>.broadcast();
    return id;
  }

  @override
  Future<void> initializeCamera(
    int cameraId, {
    ImageFormatGroup imageFormatGroup = ImageFormatGroup.unknown,
  }) async {
    final error = initializeError;
    if (error != null) throw error;
    if (failingPresets.contains(_presetById[cameraId])) {
      throw CameraException('unsupportedPreset', 'Preset not supported');
    }
    _initialized[cameraId]!.add(
      CameraInitializedEvent(
        cameraId,
        frameWidth.toDouble(),
        frameHeight.toDouble(),
        ExposureMode.auto,
        true,
        FocusMode.auto,
        true,
      ),
    );
  }

  @override
  Stream<CameraInitializedEvent> onCameraInitialized(int cameraId) =>
      _initialized[cameraId]!.stream;

  @override
  Stream<CameraErrorEvent> onCameraError(int cameraId) =>
      StreamController<CameraErrorEvent>().stream;

  @override
  Stream<DeviceOrientationChangedEvent> onDeviceOrientationChanged() =>
      StreamController<DeviceOrientationChangedEvent>().stream;

  @override
  bool supportsImageStreaming() => true;

  @override
  Stream<CameraImageData> onStreamedFrameAvailable(
    int cameraId, {
    CameraImageStreamOptions? options,
  }) =>
      _frames.stream;

  @override
  Future<void> setFlashMode(int cameraId, FlashMode mode) async =>
      flashModes.add(mode);

  @override
  Widget buildPreview(int cameraId) => const SizedBox.expand();

  @override
  Future<void> dispose(int cameraId) async => disposedIds.add(cameraId);
}

/// Stands in for ML Kit text recognition. Each processed frame "reads" whatever
/// [reads] yields next, repeating the last entry once the list runs out.
class FakeTextRecognizer {
  FakeTextRecognizer(this._tester) {
    _tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      _channel,
      (call) async {
        if (call.method != 'vision#startTextRecognizer') return null;
        framesRead++;
        final next = _queue.length > 1 ? _queue.removeAt(0) : _queue.first;
        if (next is Exception) throw next;
        return next;
      },
    );
    // Deliberately left in place after the test: the screen closes its
    // recognizer when the widget tree is torn down, which happens later.
  }

  static const _channel = MethodChannel('google_mlkit_text_recognizer');

  final WidgetTester _tester;
  final List<Object> _queue = [nothing];
  int framesRead = 0;

  /// What the next frames read, in order. The last entry keeps repeating.
  set reads(List<Object> values) {
    assert(values.isNotEmpty);
    _queue
      ..clear()
      ..addAll(values);
  }

  /// A frame with no readable text.
  static final Map<String, Object> nothing = {'text': '', 'blocks': <Object>[]};

  /// A failure inside the native recognizer.
  static final Exception failure =
      PlatformException(code: 'InputImageConverterError', message: 'boom');

  /// A frame showing a card whose title reads [name], framed inside the guide,
  /// optionally with [code] printed in its bottom-left corner.
  static Map<String, Object> card(String name, {String? code}) {
    // The frame is rotated upright before text positions are compared with
    // the on-screen guide.
    final guide = guideRectInRotatedFrame(
      rotatedWidth: FakeCameraPlatform.frameHeight.toDouble(),
      rotatedHeight: FakeCameraPlatform.frameWidth.toDouble(),
    );
    Map<String, Object> line(String text, double topFraction) {
      final top = guide.top + guide.height * topFraction;
      final rect = {
        'left': guide.left + guide.width * 0.1,
        'top': top,
        'right': guide.left + guide.width * 0.9,
        'bottom': top + guide.height * 0.05,
      };
      return {
        'text': text,
        'rect': rect,
        'recognizedLanguages': <String>[],
        'points': <Object>[],
        'confidence': 0.99,
        'angle': 0.0,
        'elements': <Object>[],
      };
    }

    final lines = [
      line(name, 0.04),
      if (code != null) line(code, 0.92),
    ];
    return {
      'text': lines.map((l) => l['text']).join('\n'),
      'blocks': [
        {
          'text': lines.map((l) => l['text']).join('\n'),
          'rect': lines.first['rect']!,
          'recognizedLanguages': <String>[],
          'points': <Object>[],
          'lines': lines,
        },
      ],
    };
  }
}
