import '../logic/version_compare.dart';

/// Remote soft/force update config from `fab_app_config`.
class AppUpdateConfig {
  const AppUpdateConfig({
    required this.latestVersion,
    this.latestBuild,
    this.minVersion,
    this.androidStoreUrl,
    this.iosStoreUrl,
    this.message,
  });

  final String latestVersion;
  final String? latestBuild;
  final String? minVersion;
  final String? androidStoreUrl;
  final String? iosStoreUrl;
  final String? message;

  factory AppUpdateConfig.fromMap(Map<String, dynamic> map) {
    return AppUpdateConfig(
      latestVersion: (map['latest_version'] as String? ?? '').trim(),
      latestBuild: _optionalBuild(map['latest_build']),
      minVersion: (map['min_version'] as String?)?.trim(),
      androidStoreUrl: (map['android_store_url'] as String?)?.trim(),
      iosStoreUrl: (map['ios_store_url'] as String?)?.trim(),
      message: (map['message'] as String?)?.trim(),
    );
  }

  bool get isValid => latestVersion.isNotEmpty;

  /// Marketing version with parenthetical / `+build` stripped.
  String get resolvedVersion => parseVersionLabel(latestVersion).version;

  /// `latest_build` column, or a build encoded in [latestVersion].
  String? get resolvedBuild {
    final fromColumn = latestBuild?.trim();
    if (fromColumn != null && fromColumn.isNotEmpty) return fromColumn;
    return parseVersionLabel(latestVersion).build;
  }
}

String? _optionalBuild(dynamic value) {
  if (value == null) return null;
  if (value is String) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
  if (value is num) return value.toInt().toString();
  return value.toString();
}
