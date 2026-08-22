import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/logic/binder_names.dart';
import 'package:fabtrades/core/models/binder.dart';

import 'contract_fixtures.dart';

void main() {
  final contract = loadContract('binder_names');

  for (final c in contractCases(contract, 'cases')) {
    test(c['name'] as String, () {
      final binders = (c['binders'] as List).map((raw) {
        final e = Map<String, dynamic>.from(raw as Map);
        final deleted = e['deletedAt'] as String?;
        return Binder(
          clientId: e['clientId'] as String,
          name: e['name'] as String,
          role: BinderRole.parse(e['role'] as String?),
          createdAt: DateTime.utc(2026, 1, 1),
          updatedAt: DateTime.utc(2026, 1, 1),
          deletedAt: deleted == null ? null : DateTime.parse(deleted),
        );
      }).toList();
      final result = validateBinderName(
        proposedName: c['proposedName'] as String,
        binders: binders,
        binderId: c['binderId'] as String?,
      );
      final expected = Map<String, dynamic>.from(c['expected'] as Map);
      expect(result.ok, expected['ok']);
      expect(result.normalized, expected['normalized']);
      expect(result.reason, expected['reason']);
      final role = expected['role'] as String?;
      expect(result.role?.wire, role);
    });
  }
}
