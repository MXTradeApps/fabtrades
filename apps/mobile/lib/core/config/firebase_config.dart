import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Firebase, used only for push notifications (Firebase Cloud Messaging, which
/// also reaches iOS through APNs).
///
/// Options come from `--dart-define-from-file` (`env/production.json`) rather
/// than `google-services.json` / `GoogleService-Info.plist`, the same way as
/// Supabase and PostHog. These values are client identifiers, safe to ship.
/// When they are missing, push silently stays off and price alerts still show
/// in the app.
abstract final class FirebaseEnv {
  static const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const messagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const androidAppId = String.fromEnvironment('FIREBASE_ANDROID_APP_ID');
  static const iosAppId = String.fromEnvironment('FIREBASE_IOS_APP_ID');
  static const iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');

  static String get _appId =>
      defaultTargetPlatform == TargetPlatform.iOS ? iosAppId : androidAppId;

  static bool get isConfigured =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.android) &&
      apiKey.isNotEmpty &&
      projectId.isNotEmpty &&
      messagingSenderId.isNotEmpty &&
      _appId.isNotEmpty;

  static FirebaseOptions get options => FirebaseOptions(
        apiKey: apiKey,
        appId: _appId,
        messagingSenderId: messagingSenderId,
        projectId: projectId,
        iosBundleId: iosBundleId.isEmpty ? null : iosBundleId,
      );
}
