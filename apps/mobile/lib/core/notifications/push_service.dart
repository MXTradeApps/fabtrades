// Token APIs are deprecated in firebase_messaging 17; see [PushService].
// ignore_for_file: deprecated_member_use

import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../config/firebase_config.dart';

/// Push notifications through Firebase Cloud Messaging.
///
/// Uses registration tokens, which firebase_messaging 17 deprecates in favour
/// of Installation-ID registration. Tokens are what the HTTP v1 `messages:send`
/// call in `supabase/functions/_shared/fcm.ts` targets, so the deprecated calls
/// stay until that function moves to the new direct-send API too (see the
/// ignore at the top of this file).
///
/// Everything here no-ops when [FirebaseEnv] is not configured or Firebase
/// failed to start, so a build without push keys behaves exactly as before:
/// price alerts still fire and show under More, there is just no notification.
class PushService {
  PushService._();

  static bool _ready = false;

  /// Whether Firebase started and push can be used.
  static bool get isAvailable => _ready;

  /// Called once from main(). Never throws.
  static Future<void> initialize() async {
    if (!FirebaseEnv.isConfigured) return;
    try {
      await Firebase.initializeApp(options: FirebaseEnv.options);
      // iOS hides notifications that arrive while the app is open unless asked.
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
      _ready = true;
    } catch (e, s) {
      debugPrint('Firebase setup failed: $e\n$s');
    }
  }

  static String get platform =>
      defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';

  /// Shows the system permission prompt (once; later calls return the stored
  /// answer) and returns whether notifications are allowed.
  static Future<bool> requestPermission() async {
    if (!_ready) return false;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission();
      return _allowed(settings.authorizationStatus);
    } catch (e) {
      debugPrint('push permission: $e');
      return false;
    }
  }

  /// Whether permission was already granted, without prompting.
  static Future<bool> hasPermission() async {
    if (!_ready) return false;
    try {
      final settings =
          await FirebaseMessaging.instance.getNotificationSettings();
      return _allowed(settings.authorizationStatus);
    } catch (e) {
      debugPrint('push settings: $e');
      return false;
    }
  }

  static bool _allowed(AuthorizationStatus status) =>
      status == AuthorizationStatus.authorized ||
      status == AuthorizationStatus.provisional;

  /// This device's FCM token, or null when push is unavailable. On iOS the
  /// APNs token can lag the permission grant, which surfaces as an error here
  /// and is covered by [onTokenRefresh].
  static Future<String?> token() async {
    if (!_ready) return null;
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      debugPrint('push token: $e');
      return null;
    }
  }

  /// Invalidates this device's token, so a signed-out device stops receiving
  /// the previous account's alerts (the server drops dead tokens on next send).
  static Future<void> deleteToken() async {
    if (!_ready) return;
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (e) {
      debugPrint('push delete token: $e');
    }
  }

  static Stream<String> get onTokenRefresh => _ready
      ? FirebaseMessaging.instance.onTokenRefresh
      : const Stream.empty();

  /// A notification tapped while the app was in the background.
  static Stream<RemoteMessage> get onMessageOpenedApp =>
      _ready ? FirebaseMessaging.onMessageOpenedApp : const Stream.empty();

  /// A notification received while the app is open.
  static Stream<RemoteMessage> get onMessage =>
      _ready ? FirebaseMessaging.onMessage : const Stream.empty();

  /// The notification that launched the app from terminated, if any.
  static Future<RemoteMessage?> initialMessage() async {
    if (!_ready) return null;
    try {
      return await FirebaseMessaging.instance.getInitialMessage();
    } catch (e) {
      debugPrint('push initial message: $e');
      return null;
    }
  }
}
