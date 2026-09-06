import 'package:fabtrades/core/sync/binders_sync.dart';
import 'package:flutter_test/flutter_test.dart';

class _PgError {
  _PgError({this.code, this.message, this.details});

  final String? code;
  final String? message;
  final String? details;
}

void main() {
  test('unique-violation is a surfaced error, not a silent rename', () {
    expect(
      isLiveNameUniqueViolation(_PgError(code: '23505')),
      isTrue,
    );
    expect(
      isLiveNameUniqueViolation(_PgError(
        message:
            'duplicate key value violates unique constraint "binders_user_live_name_idx"',
      )),
      isTrue,
    );
    expect(
      isLiveNameUniqueViolation(_PgError(message: 'network timeout')),
      isFalse,
    );
  });
}
