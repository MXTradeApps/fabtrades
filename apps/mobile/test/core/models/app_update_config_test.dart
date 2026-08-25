import 'package:fabtrades/core/models/app_update_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('fromMap parses config row', () {
    final config = AppUpdateConfig.fromMap({
      'latest_version': '1.0.2',
      'min_version': null,
      'android_store_url': 'https://play.google.com/store/apps/details?id=fabtrades.myapp',
      'ios_store_url': null,
      'message': 'Please update',
    });
    expect(config.isValid, isTrue);
    expect(config.latestVersion, '1.0.2');
    expect(config.latestBuild, isNull);
    expect(config.resolvedVersion, '1.0.2');
    expect(config.resolvedBuild, isNull);
    expect(config.message, 'Please update');
    expect(config.androidStoreUrl, contains('fabtrades.myapp'));
  });

  test('fromMap parses latest_build column', () {
    final config = AppUpdateConfig.fromMap({
      'latest_version': '1.0.2',
      'latest_build': 12,
    });
    expect(config.latestBuild, '12');
    expect(config.resolvedBuild, '12');
  });

  test('resolvedBuild falls back to parenthetical latest_version', () {
    final config = AppUpdateConfig.fromMap({
      'latest_version': '1.0.2 (12)',
    });
    expect(config.resolvedVersion, '1.0.2');
    expect(config.resolvedBuild, '12');
  });

  test('resolvedBuild prefers latest_build column over label', () {
    final config = AppUpdateConfig.fromMap({
      'latest_version': '1.0.2 (11)',
      'latest_build': '12',
    });
    expect(config.resolvedVersion, '1.0.2');
    expect(config.resolvedBuild, '12');
  });

  test('empty latest_version is invalid', () {
    expect(AppUpdateConfig.fromMap({'latest_version': '  '}).isValid, isFalse);
  });
}
