import contract from '../../../../packages/contracts/fabrary_printing_match.json';
import { parseFabraryCsv } from '../../src/utils/fabraryCsv.js';
import { matchFabraryRow } from '../../src/utils/fabraryMatch.js';

describe('fabrary printing match contract', () => {
    contract.cases.forEach((testCase) => {
        it(testCase.name, () => {
            let row = testCase.row;
            if (testCase.csv) {
                const parsed = parseFabraryCsv(testCase.csv);
                expect(parsed.ok).toBe(true);
                expect(parsed.rows[0].Name).toBe(testCase.row.Name);
                row = parsed.rows[0];
            }
            expect(matchFabraryRow(row, testCase.catalog)).toEqual(testCase.expected);
        });
    });
});
