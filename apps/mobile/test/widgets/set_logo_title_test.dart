import 'dart:async';
import 'dart:ui' as ui;

import 'package:fabtrades/app/widgets.dart';
import 'package:fabtrades/core/data/set_logo_cache.dart';
import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';

/// ImageProvider that never produces a frame (simulates a disk/memory miss).
class _NeverLoadingImageProvider
    extends ImageProvider<_NeverLoadingImageProvider> {
  @override
  Future<_NeverLoadingImageProvider> obtainKey(ImageConfiguration configuration) {
    return SynchronousFuture<_NeverLoadingImageProvider>(this);
  }

  @override
  ImageStreamCompleter loadImage(
    _NeverLoadingImageProvider key,
    ImageDecoderCallback decode,
  ) {
    return MultiFrameImageStreamCompleter(
      codec: Completer<ui.Codec>().future,
      scale: 1,
    );
  }
}

Future<ui.Image> _testImage(WidgetTester tester) async {
  final image = await tester.runAsync(() async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.drawRect(
      const Rect.fromLTWH(0, 0, 2, 2),
      Paint()..color = const Color(0xFFCC0000),
    );
    return recorder.endRecording().toImage(2, 2);
  });
  return image!;
}

void main() {
  tearDown(() {
    SetLogoTitle.debugResetWarmUrls();
    SetLogoCache.debugResetPins();
  });

  testWidgets(
    'warm logos do not flash the set name while the image re-resolves',
    (tester) async {
      const url = 'https://example.com/cru.png';
      SetLogoTitle.markWarm(url);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SetLogoTitle(
              setName: 'Crucible of War',
              logoUrl: url,
              debugImageProvider: _NeverLoadingImageProvider(),
            ),
          ),
        ),
      );

      expect(find.text('Crucible of War'), findsNothing);
    },
  );

  testWidgets(
    'cold logos show the set name until the first frame arrives',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SetLogoTitle(
              setName: 'Crucible of War',
              logoUrl: 'https://example.com/cru.png',
              debugImageProvider: _NeverLoadingImageProvider(),
            ),
          ),
        ),
      );

      expect(find.text('Crucible of War'), findsOneWidget);
    },
  );

  testWidgets(
    'warm logos stay quiet across Settings push/pop during a cache miss',
    (tester) async {
      const url = 'https://example.com/cru.png';
      const setName = 'Crucible of War';
      SetLogoTitle.markWarm(url);

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              return Scaffold(
                appBar: AppBar(
                  actions: [
                    IconButton(
                      icon: const Icon(Icons.tune),
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => Scaffold(
                              appBar: AppBar(title: const Text('Settings')),
                              body: const SizedBox.shrink(),
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
                body: SetLogoTitle(
                  setName: setName,
                  logoUrl: url,
                  debugImageProvider: _NeverLoadingImageProvider(),
                ),
              );
            },
          ),
        ),
      );

      expect(find.text(setName), findsNothing);

      await tester.tap(find.byIcon(Icons.tune));
      await tester.pumpAndSettle();
      expect(find.text('Settings'), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text(setName), findsNothing);
    },
  );

  testWidgets(
    'warm logos stay quiet across set drill-in push/pop during a cache miss',
    (tester) async {
      const url = 'https://example.com/cru.png';
      const setName = 'Crucible of War';
      SetLogoTitle.markWarm(url);

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              return Scaffold(
                body: ListTile(
                  title: SetLogoTitle(
                    setName: setName,
                    logoUrl: url,
                    debugImageProvider: _NeverLoadingImageProvider(),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.chevron_right),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => Scaffold(
                            appBar: AppBar(title: const Text('Set cards')),
                            body: const SizedBox.shrink(),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              );
            },
          ),
        ),
      );

      expect(find.text(setName), findsNothing);

      await tester.tap(find.byIcon(Icons.chevron_right));
      await tester.pumpAndSettle();
      expect(find.text('Set cards'), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text(setName), findsNothing);
    },
  );

  testWidgets(
    'retained logos paint on the first frame after a full remount',
    (tester) async {
      // Simulates Browse list tiles being disposed while SetCardsScreen is
      // open, then recreated on pop — the unload/reload the user sees.
      const url = 'https://example.com/cru.png';
      const setName = 'Crucible of War';
      final image = await _testImage(tester);
      SetLogoCache.retain(url, image);
      image.dispose();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SetLogoTitle(
              key: const ValueKey('remount'),
              setName: setName,
              logoUrl: url,
              // Would hang forever without the retained-frame fast path.
              debugImageProvider: _NeverLoadingImageProvider(),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text(setName), findsNothing);
      expect(find.byType(RawImage), findsOneWidget);
      expect(SetLogoCache.debugHasImage(url), isTrue);
    },
  );

  test('memory precache uses the same resize key as SetLogoTitle', () {
    const height = SetLogoCache.defaultHeight;
    const dpr = 2.0;
    final memH = SetLogoCache.memCacheHeightFor(height, dpr);
    expect(memH, ((height + SetLogoCache.platePadding) * dpr).round());

    final a = SetLogoCache.providerFor('https://example.com/a.png',
        memCacheHeight: memH);
    final b = SetLogoCache.providerFor('https://example.com/a.png',
        memCacheHeight: memH);
    expect(a, b);
  });
}
