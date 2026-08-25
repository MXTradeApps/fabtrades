/// Compare two dotted version strings (e.g. `1.0.2` vs `1.0.10`).
///
/// Returns negative if [a] < [b], zero if equal, positive if [a] > [b].
/// Non-numeric suffixes on a segment are ignored (so `1.0.1+4` and `1.0.1`
/// compare equal on the name portion when callers strip the build already).
int compareVersions(String a, String b) {
  final partsA = _segments(a);
  final partsB = _segments(b);
  final len = partsA.length > partsB.length ? partsA.length : partsB.length;
  for (var i = 0; i < len; i++) {
    final ai = i < partsA.length ? partsA[i] : 0;
    final bi = i < partsB.length ? partsB[i] : 0;
    if (ai != bi) return ai.compareTo(bi);
  }
  return 0;
}

/// True when [installed] is strictly behind [latest] on marketing version only.
bool isVersionBehind(String installed, String latest) =>
    compareVersions(installed, latest) < 0;

/// Marketing version and optional integer build from a store-style label.
///
/// Accepts `1.0.2`, `1.0.2 (12)`, and Flutter-style `1.0.2+12`.
({String version, String? build}) parseVersionLabel(String label) {
  final trimmed = label.trim();
  if (trimmed.isEmpty) return (version: '', build: null);

  final paren = RegExp(r'^(.+?)\s*\((\d+)\)\s*$').firstMatch(trimmed);
  if (paren != null) {
    return (version: paren.group(1)!.trim(), build: paren.group(2));
  }

  final plusIdx = trimmed.lastIndexOf('+');
  if (plusIdx > 0) {
    final build = trimmed.substring(plusIdx + 1).trim();
    if (RegExp(r'^\d+$').hasMatch(build)) {
      return (version: trimmed.substring(0, plusIdx).trim(), build: build);
    }
  }

  return (version: trimmed, build: null);
}

/// Settings / App Store Connect style label, e.g. `1.0.2 (12)`.
String formatReleaseLabel(String version, String? build) {
  final b = build?.trim();
  if (b == null || b.isEmpty) return version;
  return '$version ($b)';
}

/// True when the installed marketing version (and optional build) is strictly
/// behind the latest.
///
/// Version is compared first. When versions are equal and a latest build is
/// present, integer build numbers are compared. A missing latest build keeps
/// version-only comparison (no prompt when versions match).
bool isReleaseBehind({
  required String installedVersion,
  required String installedBuild,
  required String latestVersion,
  String? latestBuild,
}) {
  final installed = parseVersionLabel(installedVersion);
  final latest = parseVersionLabel(latestVersion);
  final versionCmp = compareVersions(installed.version, latest.version);
  if (versionCmp != 0) return versionCmp < 0;

  final remoteBuild =
      _parseBuildNumber(latestBuild) ?? _parseBuildNumber(latest.build);
  if (remoteBuild == null) return false;

  final localBuild = _parseBuildNumber(installedBuild) ??
      _parseBuildNumber(installed.build) ??
      0;
  return localBuild < remoteBuild;
}

int? _parseBuildNumber(String? build) {
  if (build == null) return null;
  final match = RegExp(r'^\d+').firstMatch(build.trim());
  if (match == null) return null;
  return int.parse(match.group(0)!);
}

List<int> _segments(String version) {
  final cleaned = version.trim().split('+').first.split('-').first;
  if (cleaned.isEmpty) return const [0];
  return cleaned.split('.').map((part) {
    final match = RegExp(r'^\d+').firstMatch(part);
    return match == null ? 0 : int.parse(match.group(0)!);
  }).toList();
}
