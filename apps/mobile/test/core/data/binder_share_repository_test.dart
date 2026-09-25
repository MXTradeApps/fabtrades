import 'package:fabtrades/core/data/binder_share_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('newBinderShareToken returns 32 hex chars', () {
    final token = newBinderShareToken();
    expect(token, matches(RegExp(r'^[0-9a-f]{32}$')));
  });

  test('binderShareUrl builds /b/:token path', () {
    expect(
      binderShareUrl('abc123def4567890', origin: 'https://fabtrades.net'),
      'https://fabtrades.net/b/abc123def4567890',
    );
    expect(
      binderShareUrl('abc', origin: 'https://fabtrades.net/'),
      'https://fabtrades.net/b/abc',
    );
  });
}
