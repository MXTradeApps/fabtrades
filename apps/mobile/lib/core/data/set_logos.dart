import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:shared_preferences/shared_preferences.dart';

/// Set logo URLs keyed by TCGplayer group id — which matches [CardModel.setId].
///
/// Two sources, merged with [withStored]:
///  1. `fab_sets.logo_url` in the database (our own copies in Storage), so a
///     new logo reaches the app without a release.
///  2. The bundled `assets/setLogos.json` (same shape as the web app's
///     `public/setLogos.json`), which covers any set the database has no logo
///     for and everything when the database cannot be reached.
class SetLogoMap {
  const SetLogoMap(this._urlsByGroupId, [this._abbreviationsByGroupId = const {}]);

  final Map<String, String> _urlsByGroupId;
  final Map<String, String> _abbreviationsByGroupId;

  static const empty = SetLogoMap({});

  /// Parse the scraped JSON blob. Tolerates either
  /// `{ "logos": { "2724": { "logoUrl": "…" } } }` or a flat
  /// `{ "2724": "https://…" }` map.
  factory SetLogoMap.fromJson(String jsonText) {
    final decoded = jsonDecode(jsonText);
    if (decoded is! Map) return empty;

    final raw = decoded['logos'] is Map
        ? decoded['logos'] as Map
        : decoded;
    final urls = <String, String>{};
    final abbreviations = <String, String>{};
    for (final entry in raw.entries) {
      final key = entry.key.toString();
      final value = entry.value;
      String? url;
      if (value is String) {
        url = value;
      } else if (value is Map) {
        final logoUrl = value['logoUrl'];
        if (logoUrl is String) url = logoUrl;
        final abbr = value['abbreviation'];
        if (abbr is String && abbr.trim().isNotEmpty) {
          abbreviations[key] = abbr.trim();
        }
      }
      if (url != null && url.isNotEmpty) urls[key] = url;
    }
    return SetLogoMap(urls, abbreviations);
  }

  /// Build from `fab_sets` rows (`group_id`, `logo_url`). Rows without a
  /// usable URL are dropped.
  static Map<String, String> storedFromRows(Iterable<Map<String, dynamic>> rows) {
    final urls = <String, String>{};
    for (final row in rows) {
      final id = row['group_id'];
      final url = row['logo_url'];
      if (id == null || url is! String || url.trim().isEmpty) continue;
      urls[id.toString()] = url.trim();
    }
    return urls;
  }

  /// This map with database logos laid over it: a stored URL wins, every
  /// other entry (and all abbreviations) stays as bundled.
  SetLogoMap withStored(Map<String, String> storedUrlsByGroupId) {
    if (storedUrlsByGroupId.isEmpty) return this;
    return SetLogoMap(
      {..._urlsByGroupId, ...storedUrlsByGroupId},
      _abbreviationsByGroupId,
    );
  }

  String? urlForGroupId(int? groupId) {
    if (groupId == null) return null;
    return _urlsByGroupId[groupId.toString()];
  }

  /// TCGCSV abbreviation when the bundled map has one; otherwise null.
  String? abbreviationForGroupId(int? groupId) {
    if (groupId == null) return null;
    return _abbreviationsByGroupId[groupId.toString()];
  }

  /// All distinct logo CDN URLs (for disk/memory cache warming).
  Iterable<String> get urls => _urlsByGroupId.values;

  bool get isEmpty => _urlsByGroupId.isEmpty;
  int get length => _urlsByGroupId.length;
}

/// Load the bundled set-logo map. Returns [SetLogoMap.empty] on any failure
/// so the browse UI can fall back to set names without crashing.
Future<SetLogoMap> loadSetLogoMap() async {
  try {
    final jsonText = await rootBundle.loadString('assets/setLogos.json');
    return SetLogoMap.fromJson(jsonText);
  } catch (_) {
    return SetLogoMap.empty;
  }
}

/// Local copy of the database logos, so they show offline and on the first
/// frame of the next launch.
class StoredSetLogosRepository {
  StoredSetLogosRepository(this._prefs);
  final SharedPreferences _prefs;

  static const _key = 'set_logo_urls';

  Map<String, String>? load() {
    final raw = _prefs.getString(_key);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final urls = <String, String>{};
      for (final entry in decoded.entries) {
        final value = entry.value;
        if (value is String && value.isNotEmpty) {
          urls[entry.key.toString()] = value;
        }
      }
      return urls;
    } catch (_) {
      return null;
    }
  }

  Future<void> save(Map<String, String> urlsByGroupId) async {
    await _prefs.setString(_key, jsonEncode(urlsByGroupId));
  }
}
