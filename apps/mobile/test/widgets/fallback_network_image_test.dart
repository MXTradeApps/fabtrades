import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:file/memory.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fabtrades/app/fallback_network_image.dart';

/// 1×1 transparent PNG.
final Uint8List _kPngBytes = Uint8List.fromList(<int>[
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
]);

class _FakeCacheManager extends Mock implements CacheManager {
  void throwsNotFound(String url) {
    when(
      () => getFileStream(
        url,
        key: any(named: 'key'),
        headers: any(named: 'headers'),
        withProgress: any(named: 'withProgress'),
      ),
    ).thenThrow(
      HttpExceptionWithStatus(
        404,
        'Invalid statusCode: 404',
        uri: Uri.parse(url),
      ),
    );
  }

  void returns(String url, List<int> imageData) {
    when(
      () => getFileStream(
        url,
        key: any(named: 'key'),
        headers: any(named: 'headers'),
        withProgress: any(named: 'withProgress'),
      ),
    ).thenAnswer((_) async* {
      final file =
          MemoryFileSystem().systemTempDirectory.childFile('test.png');
      await file.writeAsBytes(imageData);
      yield FileInfo(
        file,
        FileSource.Online,
        DateTime.now().add(const Duration(days: 1)),
        url,
      );
    });
  }
}

void main() {
  late _FakeCacheManager cacheManager;

  setUp(() {
    cacheManager = _FakeCacheManager();
  });

  tearDown(() {
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();
  });

  testWidgets(
    'falls back to TCGplayer URL when FAB CDN returns 404',
    (tester) async {
      const cdnUrl =
          'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/OMA137.webp';
      const tcgUrl = 'https://tcgplayer.example/oma137.png';

      cacheManager.throwsNotFound(cdnUrl);
      cacheManager.returns(tcgUrl, _kPngBytes);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FallbackNetworkImage(
              imageUrl: cdnUrl,
              fallbackUrl: tcgUrl,
              cacheManager: cacheManager,
              errorWidget: (_, _, _) =>
                  const Icon(Icons.broken_image_outlined, key: Key('broken')),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pumpAndSettle();

      // User-visible symptom of the bug: broken-image icon in the zoom viewer.
      expect(find.byKey(const Key('broken')), findsNothing);
      // Fallback image is present (CachedNetworkImage may keep the failed
      // primary Image in the tree briefly/alongside the error rebuild).
      expect(
        find.byWidgetPredicate(
          (w) =>
              w is Image &&
              w.image is CachedNetworkImageProvider &&
              (w.image as CachedNetworkImageProvider).url == tcgUrl,
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'shows error widget when both primary and fallback fail',
    (tester) async {
      const cdnUrl =
          'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/OMA137.webp';
      const fallbackUrl =
          'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/OMA138.webp';

      cacheManager.throwsNotFound(cdnUrl);
      cacheManager.throwsNotFound(fallbackUrl);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FallbackNetworkImage(
              imageUrl: cdnUrl,
              fallbackUrl: fallbackUrl,
              cacheManager: cacheManager,
              errorWidget: (_, _, _) =>
                  const Icon(Icons.broken_image_outlined, key: Key('broken')),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('broken')), findsOneWidget);
    },
  );
}
