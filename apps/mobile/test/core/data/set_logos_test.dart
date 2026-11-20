import 'package:fabtrades/core/data/set_logo_cache.dart';
import 'package:fabtrades/core/data/set_logos.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('SetLogoMap', () {
    test('parses nested logos shape and exposes urls', () {
      const json = '''
      {
        "logos": {
          "2724": { "name": "Crucible of War", "abbreviation": "CRU", "logoUrl": "https://example.com/cru.png" },
          "2725": { "name": "Arcane Rising", "logoUrl": "https://example.com/arc.png" }
        }
      }
      ''';
      final map = SetLogoMap.fromJson(json);
      expect(map.length, 2);
      expect(map.urlForGroupId(2724), 'https://example.com/cru.png');
      expect(map.abbreviationForGroupId(2724), 'CRU');
      expect(map.abbreviationForGroupId(2725), isNull);
      expect(map.urls.toSet(), {
        'https://example.com/cru.png',
        'https://example.com/arc.png',
      });
    });

    test('parses flat map shape', () {
      const json = '''
      {
        "2724": "https://example.com/cru.png"
      }
      ''';
      final map = SetLogoMap.fromJson(json);
      expect(map.urlForGroupId(2724), 'https://example.com/cru.png');
      expect(map.urls, ['https://example.com/cru.png']);
    });

    test('returns null for missing group ids', () {
      expect(SetLogoMap.empty.urlForGroupId(1), isNull);
      expect(SetLogoMap.empty.urlForGroupId(null), isNull);
    });
  });

  group('SetLogoMap.withStored', () {
    const bundledJson = '''
    {
      "logos": {
        "2775": { "name": "Monarch", "abbreviation": "MON", "logoUrl": "https://cdn.example/monarch.png" },
        "2885": { "name": "Tales of Aria", "abbreviation": "ELE", "logoUrl": "https://cdn.example/toa.png" }
      }
    }
    ''';

    test('with nothing stored it is exactly the bundled list', () {
      final bundled = SetLogoMap.fromJson(bundledJson);
      final merged = bundled.withStored(const {});
      expect(merged.length, 2);
      expect(merged.urlForGroupId(2775), 'https://cdn.example/monarch.png');
      expect(merged.urlForGroupId(2885), 'https://cdn.example/toa.png');
    });

    test('a stored logo wins and the rest stays bundled', () {
      final merged = SetLogoMap.fromJson(bundledJson).withStored(const {
        '2775': 'https://db.example/2775.png',
        '2818': 'https://db.example/2775.png',
      });
      expect(merged.urlForGroupId(2775), 'https://db.example/2775.png');
      expect(merged.urlForGroupId(2885), 'https://cdn.example/toa.png');
      // A set the bundled list never had.
      expect(merged.urlForGroupId(2818), 'https://db.example/2775.png');
      // Abbreviations still come from the bundled list.
      expect(merged.abbreviationForGroupId(2775), 'MON');
    });

    test('storedFromRows keeps only rows with a usable url', () {
      final stored = SetLogoMap.storedFromRows([
        {'group_id': 2775, 'logo_url': 'https://db.example/2775.png'},
        {'group_id': 2885, 'logo_url': null},
        {'group_id': 3056, 'logo_url': '  '},
        {'group_id': null, 'logo_url': 'https://db.example/x.png'},
        {'group_id': 2818, 'logo_url': 42},
      ]);
      expect(stored, {'2775': 'https://db.example/2775.png'});
    });
  });

  group('StoredSetLogosRepository', () {
    test('round-trips the stored logos', () async {
      SharedPreferences.setMockInitialValues({});
      final store =
          StoredSetLogosRepository(await SharedPreferences.getInstance());
      expect(store.load(), isNull);
      await store.save(const {'2775': 'https://db.example/2775.png'});
      expect(store.load(), {'2775': 'https://db.example/2775.png'});
    });

    test('ignores a corrupt entry instead of throwing', () async {
      SharedPreferences.setMockInitialValues({'set_logo_urls': 'not json'});
      final store =
          StoredSetLogosRepository(await SharedPreferences.getInstance());
      expect(store.load(), isNull);
    });
  });

  group('SetLogoCache', () {
    test('uses a dedicated long-lived cache key', () {
      expect(SetLogoCache.key, 'setLogoCache');
    });

    test('memCacheHeightFor matches the logo plate size', () {
      expect(
        SetLogoCache.memCacheHeightFor(40, 3),
        ((40 + SetLogoCache.platePadding) * 3).round(),
      );
    });
  });
}
