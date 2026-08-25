import 'dart:io' show Platform;

import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../logic/version_compare.dart';
import '../models/app_update_config.dart';

/// Fetches remote update config and decides whether to nudge the user.
class AppUpdateRepository {
  AppUpdateRepository(this._client, this._prefs);

  final SupabaseClient _client;
  final SharedPreferences _prefs;

  static const _table = 'fab_app_config';
  static const _dismissedKey = 'appUpdateDismissedVersion';

  Future<AppUpdateConfig?> fetchConfig() async {
    final row = await _client.from(_table).select().eq('id', 1).maybeSingle();
    if (row == null) return null;
    final config = AppUpdateConfig.fromMap(row);
    return config.isValid ? config : null;
  }

  Future<PackageInfo> packageInfo() => PackageInfo.fromPlatform();

  /// Soft reminder when installed version/build is behind latest and the user
  /// has not dismissed this latest release. Failures return null (no nag on
  /// errors).
  Future<AppUpdatePrompt?> checkForUpdatePrompt() async {
    try {
      final config = await fetchConfig();
      if (config == null) return null;

      final info = await packageInfo();
      if (!isReleaseBehind(
        installedVersion: info.version,
        installedBuild: info.buildNumber,
        latestVersion: config.resolvedVersion,
        latestBuild: config.resolvedBuild,
      )) {
        return null;
      }

      final prompt = AppUpdatePrompt(
        installedVersion: info.version,
        installedBuild: info.buildNumber,
        latestVersion: config.resolvedVersion,
        latestBuild: config.resolvedBuild,
        config: config,
        storeUrl: _storeUrlForPlatform(config),
      );
      final dismissed = _prefs.getString(_dismissedKey);
      if (dismissed == prompt.dismissToken) return null;

      return prompt;
    } catch (_) {
      return null;
    }
  }

  Future<void> dismiss(String latestVersion) =>
      _prefs.setString(_dismissedKey, latestVersion);

  Future<bool> openStore(String? url) async {
    if (url == null || url.isEmpty) return false;
    final uri = Uri.tryParse(url);
    if (uri == null) return false;
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  String? _storeUrlForPlatform(AppUpdateConfig config) {
    if (Platform.isIOS) {
      final ios = config.iosStoreUrl;
      if (ios != null && ios.isNotEmpty) return ios;
    }
    final android = config.androidStoreUrl;
    if (android != null && android.isNotEmpty) return android;
    return config.iosStoreUrl;
  }
}

/// Payload for the soft update dialog.
class AppUpdatePrompt {
  const AppUpdatePrompt({
    required this.installedVersion,
    required this.installedBuild,
    required this.latestVersion,
    this.latestBuild,
    required this.config,
    required this.storeUrl,
  });

  final String installedVersion;
  final String installedBuild;
  final String latestVersion;
  final String? latestBuild;
  final AppUpdateConfig config;
  final String? storeUrl;

  String get latestLabel => formatReleaseLabel(latestVersion, latestBuild);

  String get installedLabel =>
      formatReleaseLabel(installedVersion, installedBuild);

  String get dismissToken => latestLabel;

  String get message =>
      (config.message != null && config.message!.isNotEmpty)
          ? config.message!
          : 'A newer version of FAB Trades ($latestLabel) is available. '
              'You are on $installedLabel.';
}
