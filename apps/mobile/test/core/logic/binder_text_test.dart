import 'package:fabtrades/core/logic/binder_text.dart';
import 'package:fabtrades/core/models/binder_entry.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/fixtures.dart';

void main() {
  group('formatBinderAsText', () {
    test('empty binder is just the name', () {
      expect(
        formatBinderAsText(name: 'Trade Binder', entries: const []),
        'Trade Binder',
      );
    });

    test('formats quantity, name, collector, finish, condition, and set', () {
      final text = formatBinderAsText(
        name: 'Trade Binder',
        entries: [
          BinderEntry(
            card: buildCard(
              name: 'Lightning Press',
              collectorNumber: 'SUP001',
              subTypeName: 'Rainbow Foil',
              setName: 'Super Slam',
            ),
            quantity: 4,
            condition: 'LP',
            addedAt: DateTime.utc(2026, 1, 1),
          ),
          BinderEntry(
            card: buildCard(
              id: 'bravo-Normal',
              name: 'Bravo',
              collectorNumber: 'WTR001',
              subTypeName: 'Normal',
              setName: 'Welcome to Rathe',
            ),
            quantity: 2,
            addedAt: DateTime.utc(2026, 1, 1),
          ),
        ],
      );
      expect(
        text,
        'Trade Binder\n'
        '\n'
        '2x Bravo · WTR001 · NM · Welcome to Rathe\n'
        '4x Lightning Press · SUP001 · Rainbow Foil · LP · Super Slam',
      );
    });
  });
}
