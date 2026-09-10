import 'package:fabtrades/core/logic/fabrary_csv.dart';
import 'package:fabtrades/core/logic/fabrary_match.dart';
import 'package:flutter_test/flutter_test.dart';

import 'contract_fixtures.dart';

void main() {
  final contract = loadContract('fabrary_printing_match');
  final cases = contractCases(contract, 'cases');

  group('fabrary printing match contract', () {
    for (final testCase in cases) {
      test(testCase['name'] as String, () {
        var row = Map<String, dynamic>.from(testCase['row'] as Map);
        final csv = testCase['csv'] as String?;
        if (csv != null) {
          final parsed = parseFabraryCsv(csv);
          expect(parsed.ok, isTrue);
          expect(parsed.rows.first['Name'], row['Name']);
          row = Map<String, dynamic>.from(parsed.rows.first);
        }
        final catalog = (testCase['catalog'] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        final result = matchFabraryRow(row, catalog);
        expect(result.toJson(), testCase['expected']);
      });
    }
  });
}
