import 'package:flutter_test/flutter_test.dart';
import 'package:fabtrades/core/logic/binder_move.dart';

import 'contract_fixtures.dart';

void main() {
  final contract = loadContract('binder_move');

  Map<String, dynamic> identity(Map<String, dynamic> e) => {
        'printingId': e['printingId'],
        'binderId': e['binderId'],
        'isWanted': e['isWanted'] ?? false,
        'quantity': e['quantity'],
        'condition': e['condition'],
      };

  for (final c in contractCases(contract, 'cases')) {
    test(c['name'] as String, () {
      final now = DateTime.utc(2026, 8, 1);
      final binders = (c['binders'] as List)
          .map((e) => binderFromContract(Map<String, dynamic>.from(e as Map), now: now))
          .toList();
      final entries = (c['entries'] as List)
          .map((e) => binderEntryFromContract(Map<String, dynamic>.from(e as Map), now: now))
          .toList();
      final result = moveBinderCopies(
        binders: binders,
        entries: entries,
        fromBinderId: c['fromBinderId'] as String,
        toBinderId: c['toBinderId'] as String,
        printingId: c['printingId'] as String,
        condition: c['condition'] as String,
        quantity: (c['quantity'] as num).toInt(),
        now: now,
      );
      final expected = Map<String, dynamic>.from(c['expected'] as Map);
      expect(result.ok, expected['ok']);
      expect(result.reason, expected['reason']);
      expect(result.distinctOwned, expected['distinctOwned']);
      final actual = [
        for (final e in result.entries)
          {
            'printingId': e.card.id,
            'binderId': e.binderId,
            'isWanted': e.isWanted,
            'quantity': e.quantity,
            'condition': e.condition,
          }
      ];
      expect(
        actual.map(identity).toSet(),
        (expected['entries'] as List)
            .map((e) => identity(Map<String, dynamic>.from(e as Map)))
            .toSet(),
      );
    });
  }
}
