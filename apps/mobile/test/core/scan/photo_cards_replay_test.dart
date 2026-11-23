// Replays saved ML Kit output through "Post from photo" recognition and
// prints the hit rate per fixture. See test/fixtures/photo_ocr/README.md for
// how to capture a real photo's text from a debug build.

import 'dart:convert';
import 'dart:io';

import 'package:fabtrades/core/data/card_repository.dart';
import 'package:fabtrades/core/scan/ocr_guide_filter.dart';
import 'package:fabtrades/core/scan/photo_cards.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/fixtures.dart';

void main() {
  final dir = Directory('test/fixtures/photo_ocr');
  final files = dir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.json'))
      .toList()
    ..sort((a, b) => a.path.compareTo(b.path));

  for (final file in files) {
    final name = file.uri.pathSegments.last;
    test('photo fixture $name', () {
      final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
      final catalog = [
        for (final raw in (json['catalog'] as List).cast<Map<String, dynamic>>())
          buildCard(
            id: raw['id'] as String,
            name: raw['name'] as String,
            collectorNumber: raw['collectorNumber'] as String?,
            pitch: raw['pitch'] as String?,
            cardType: raw['cardType'] as String?,
            rarity: (raw['rarity'] as String?) ?? 'Common',
            isFoil: (raw['isFoil'] as bool?) ?? false,
          ),
      ];
      final lines = <OcrLine>[
        for (final raw in (json['lines'] as List).cast<Map<String, dynamic>>())
          (
            left: (raw['left'] as num).toDouble(),
            top: (raw['top'] as num).toDouble(),
            right: (raw['right'] as num).toDouble(),
            bottom: (raw['bottom'] as num).toDouble(),
            text: raw['text'] as String,
          ),
      ];
      final expected = (json['expected'] as List).cast<String>();

      final result =
          recognizePhotoCards(lines, PhotoCatalogIndex.build(catalog));

      // A hit is an expected card that some detection offers: by exact
      // printing when it was suggested, else by name among its candidates.
      final suggested = [
        for (final d in result.detections)
          if (d.suggested != null) d.suggested!.name,
      ];
      final offered = {
        for (final d in result.detections)
          for (final c in d.candidates) baseCardName(c.name),
      };
      var exact = 0;
      var hits = 0;
      for (final want in expected) {
        if (suggested.remove(want)) {
          exact++;
          hits++;
        } else if (offered.contains(baseCardName(want))) {
          hits++;
        }
      }
      // ignore: avoid_print
      print('$name: ${expected.length} cards in photo, '
          '${result.detections.length} found, $hits offered, '
          '$exact suggested exactly, '
          '${result.count(PhotoCardConfidence.unrecognized)} unrecognized');

      final minHits = json['minHits'] as int?;
      if (minHits != null) expect(hits, greaterThanOrEqualTo(minHits));
    });
  }
}
