import 'package:fabtrades/core/scan/ocr_guide_filter.dart';
import 'package:fabtrades/core/scan/photo_cards.dart';
import 'package:fabtrades/core/scan/photo_text_reader.dart';

/// Width of a synthetic card in photo pixels. Cards are 63 × 88 mm.
const double photoCardWidth = 300;
const double photoCardHeight = photoCardWidth * 88 / 63;

/// Height of a synthetic name line, from the same ratio the grouping assumes.
const double photoTitleHeight =
    photoCardHeight / kPhotoCardHeightInTitleHeights;

/// The text lines ML Kit would plausibly return for one card whose top-left
/// corner is at ([x], [y]): the name centred near the top, rules text in the
/// lower half, and the set code at the bottom left.
///
/// [titleOnly] leaves out everything below the name, as when another card
/// lies on top of this one in a fan.
List<OcrLine> photoCard({
  required double x,
  required double y,
  required String title,
  List<String> rules = const [],
  String? code,
  bool titleOnly = false,
}) {
  const w = photoCardWidth;
  const h = photoCardHeight;
  const th = photoTitleHeight;
  final titleWidth = w * 0.5;
  final lines = <OcrLine>[
    (
      left: x + (w - titleWidth) / 2,
      top: y + h * 0.04,
      right: x + (w + titleWidth) / 2,
      bottom: y + h * 0.04 + th,
      text: title,
    ),
  ];
  if (titleOnly) return lines;
  for (var i = 0; i < rules.length; i++) {
    final top = y + h * 0.62 + i * th * 0.85;
    lines.add((
      left: x + w * 0.1,
      top: top,
      right: x + w * 0.9,
      bottom: top + th * 0.6,
      text: rules[i],
    ));
  }
  if (code != null) {
    lines.add((
      left: x + w * 0.08,
      top: y + h * 0.94,
      right: x + w * 0.3,
      bottom: y + h * 0.94 + th * 0.4,
      text: code,
    ));
  }
  return lines;
}

/// Top-left corner of the card at [column], [row] in a grid with a small gap
/// between cards.
({double x, double y}) photoGridCell(int column, int row) => (
      x: 40 + column * (photoCardWidth + 20),
      y: 40 + row * (photoCardHeight + 20),
    );

/// Stands in for ML Kit: returns canned lines for any photo.
class FakePhotoTextReader implements PhotoTextReader {
  FakePhotoTextReader(this.lines, {this.error});

  final List<OcrLine> lines;
  final Object? error;
  final paths = <String>[];

  @override
  Future<List<OcrLine>> read(String imagePath) async {
    paths.add(imagePath);
    if (error != null) throw error!;
    return lines;
  }
}
