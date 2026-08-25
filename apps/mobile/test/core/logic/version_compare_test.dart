import 'package:fabtrades/core/logic/version_compare.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('compareVersions', () {
    test('orders semver numerically', () {
      expect(compareVersions('1.0.1', '1.0.2'), lessThan(0));
      expect(compareVersions('1.0.10', '1.0.2'), greaterThan(0));
      expect(compareVersions('1.0.1', '1.0.1'), 0);
      expect(compareVersions('2.0.0', '1.9.9'), greaterThan(0));
    });

    test('ignores build metadata after +', () {
      expect(compareVersions('1.0.1+4', '1.0.1'), 0);
      expect(compareVersions('1.0.1+4', '1.0.2'), lessThan(0));
    });
  });

  group('isVersionBehind', () {
    test('true only when installed is older', () {
      expect(isVersionBehind('1.0.1', '1.0.2'), isTrue);
      expect(isVersionBehind('1.0.2', '1.0.2'), isFalse);
      expect(isVersionBehind('1.0.3', '1.0.2'), isFalse);
    });
  });

  group('parseVersionLabel', () {
    test('splits store-style version and build', () {
      expect(parseVersionLabel('1.0.2 (12)'), (version: '1.0.2', build: '12'));
      expect(parseVersionLabel('1.0.2+12'), (version: '1.0.2', build: '12'));
      expect(parseVersionLabel('1.0.2'), (version: '1.0.2', build: null));
    });
  });

  group('isReleaseBehind', () {
    test('prompts when marketing version is older', () {
      expect(
        isReleaseBehind(
          installedVersion: '1.0.1',
          installedBuild: '20',
          latestVersion: '1.0.2',
          latestBuild: '1',
        ),
        isTrue,
      );
    });

    test('prompts when version matches but installed build is older', () {
      expect(
        isReleaseBehind(
          installedVersion: '1.0.2',
          installedBuild: '11',
          latestVersion: '1.0.2',
          latestBuild: '12',
        ),
        isTrue,
      );
    });

    test('does not prompt when version and build match', () {
      expect(
        isReleaseBehind(
          installedVersion: '1.0.2',
          installedBuild: '12',
          latestVersion: '1.0.2',
          latestBuild: '12',
        ),
        isFalse,
      );
    });

    test('does not prompt when installed build is newer', () {
      expect(
        isReleaseBehind(
          installedVersion: '1.0.2',
          installedBuild: '13',
          latestVersion: '1.0.2',
          latestBuild: '12',
        ),
        isFalse,
      );
    });

    test('ignores build when latest build is omitted', () {
      expect(
        isReleaseBehind(
          installedVersion: '1.0.2',
          installedBuild: '8',
          latestVersion: '1.0.2',
        ),
        isFalse,
      );
    });

    test('reads build from a store-style latest_version label', () {
      expect(
        isReleaseBehind(
          installedVersion: '1.0.2',
          installedBuild: '11',
          latestVersion: '1.0.2 (12)',
        ),
        isTrue,
      );
    });

    test('does not prompt when installed marketing version is newer', () {
      expect(
        isReleaseBehind(
          installedVersion: '1.0.3',
          installedBuild: '1',
          latestVersion: '1.0.2',
          latestBuild: '99',
        ),
        isFalse,
      );
    });
  });
}
