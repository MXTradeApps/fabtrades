import contract from '../../../../packages/contracts/fabrary_import_apply.json';
import { planFabraryImport } from '../../src/utils/fabraryImportApply.js';

function sortAdds(adds) {
    return [...(adds || [])].sort((a, b) => {
        const byId = String(a.printingId).localeCompare(String(b.printingId));
        if (byId !== 0) return byId;
        return String(a.destination || 'collection')
            .localeCompare(String(b.destination || 'collection'));
    });
}

describe('fabrary import apply contract', () => {
    contract.cases.forEach((testCase) => {
        it(testCase.name, () => {
            const result = planFabraryImport({
                headers: testCase.headers,
                rows: testCase.rows,
                catalog: testCase.catalog,
                binderId: testCase.binderId,
                existingEntries: testCase.existingEntries,
            });
            expect(result.ok).toBe(testCase.expected.ok);
            expect(result.refuseReason).toBe(testCase.expected.refuseReason);
            expect(result.ownedCount).toBe(testCase.expected.ownedCount);
            expect(result.matchedCount).toBe(testCase.expected.matchedCount);
            expect(result.copiesToAdd).toBe(testCase.expected.copiesToAdd);
            expect(result.unmatched).toEqual(testCase.expected.unmatched);
            expect(sortAdds(result.adds)).toEqual(sortAdds(testCase.expected.adds));
            expect(result.adds.some((a) => a.printingId === 'want-card')).toBe(false);
        });
    });
});
