import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';

import 'ocr_guide_filter.dart';

/// Reads the text in a still photo, one [OcrLine] per printed line with its
/// box in upright image pixels. Behind an interface so "Post from photo" runs
/// under `flutter test`, where ML Kit does not exist.
abstract class PhotoTextReader {
  Future<List<OcrLine>> read(String imagePath);
}

/// The same on-device ML Kit recognizer the live scanner uses, run once on a
/// file. ML Kit applies the photo's EXIF rotation, so boxes come back upright.
class MlKitPhotoTextReader implements PhotoTextReader {
  const MlKitPhotoTextReader();

  @override
  Future<List<OcrLine>> read(String imagePath) async {
    final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
    try {
      final result = await recognizer
          .processImage(InputImage.fromFilePath(imagePath))
          .timeout(const Duration(seconds: 30));
      return [
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
    } finally {
      await recognizer.close();
    }
  }
}

enum PhotoSource { camera, gallery }

/// Returns the path of the photo the user took or chose, or null when they
/// backed out.
typedef PhotoPicker = Future<String?> Function(PhotoSource source);

/// Full resolution on purpose: several cards share one photo, so each card's
/// text is already small.
Future<String?> pickPhotoWithImagePicker(PhotoSource source) async {
  final file = await ImagePicker().pickImage(
    source: source == PhotoSource.camera
        ? ImageSource.camera
        : ImageSource.gallery,
  );
  return file?.path;
}
