import contract from '../../../../packages/contracts/fabrary_import_apply.json';
import { planFabraryImport } from '../../src/utils/fabraryImportApply.js';

function sortAdds(adds) {
    return [...(adds || [])].sort((a, b) =>
        String(a.printingId).localeCompare(String(b.printingId)),
    );
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
                existingOwnedIds: testCase.existingOwnedIds,
                isPro: testCase.isPro,
            });
            expect(result.ok).toBe(testCase.expected.ok);
            expect(result.refuseReason).toBe(testCase.expected.refuseReason);
            expect(result.ownedCount).toBe(testCase.expected.ownedCount);
            expect(result.matchedCount).toBe(testCase.expected.matchedCount);
            expect(result.copiesToAdd).toBe(testCase.expected.copiesToAdd);
            expect(result.unmatched).toEqual(testCase.expected.unmatched);
            expect(sortAdds(result.adds)).toEqual(sortAdds(testCase.expected.adds));
            const wantIds = (testCase.expected.adds || []).map((a) => a.printingId);
            expect(result.adds.some((a) => a.printingId === 'want-card')).toBe(false);
            if (testCase.name.includes('Want and Extra')) {
                expect(wantIds).not.toContain('want-card');
            }
        });
    });
});
