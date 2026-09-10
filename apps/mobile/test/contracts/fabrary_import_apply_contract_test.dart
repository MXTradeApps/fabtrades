import 'package:fabtrades/core/logic/fabrary_import_apply.dart';
import 'package:flutter_test/flutter_test.dart';

import 'contract_fixtures.dart';

List<Map<String, dynamic>> _sortAdds(Iterable<dynamic> adds) {
  final mapped = adds
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList()
    ..sort(
      (a, b) => '${a['printingId']}'.compareTo('${b['printingId']}'),
    );
  return mapped;
}

void main() {
  final contract = loadContract('fabrary_import_apply');
  final cases = contractCases(contract, 'cases');

  group('fabrary import apply contract', () {
    for (final testCase in cases) {
      test(testCase['name'] as String, () {
        final rows = (testCase['rows'] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        final catalog = (testCase['catalog'] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        final existing = (testCase['existingEntries'] as List? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        final existingOwnedIds = (testCase['existingOwnedIds'] as List?)
            ?.map((e) => '$e')
            .toList();
        final result = planFabraryImport(
          headers: (testCase['headers'] as List).map((e) => '$e').toList(),
          rows: rows,
          catalog: catalog,
          binderId: testCase['binderId'] as String,
          existingEntries: existing,
          existingOwnedIds: existingOwnedIds,
          isPro: testCase['isPro'] as bool? ?? false,
        );
        final expected = Map<String, dynamic>.from(testCase['expected'] as Map);
        expect(result.ok, expected['ok']);
        expect(result.refuseReason, expected['refuseReason']);
        expect(result.ownedCount, expected['ownedCount']);
        expect(result.matchedCount, expected['matchedCount']);
        expect(result.copiesToAdd, expected['copiesToAdd']);
        expect(
          result.unmatched.map((u) => u.toJson()).toList(),
          expected['unmatched'],
        );
        expect(_sortAdds(result.adds.map((a) => a.toJson())),
            _sortAdds(expected['adds'] as List));
      });
    }
  });
}
