import contract from '../../../../packages/contracts/binder_names.json';
import { validateBinderName } from '../../src/utils/binderNames.js';

describe('binder names contract', () => {
    contract.cases.forEach((testCase) => {
        it(testCase.name, () => {
            const result = validateBinderName({
                proposedName: testCase.proposedName,
                binders: testCase.binders,
                binderId: testCase.binderId,
            });
            expect(result.ok).toBe(testCase.expected.ok);
            expect(result.normalized).toBe(testCase.expected.normalized);
            expect(result.reason).toBe(testCase.expected.reason);
            expect(result.role).toBe(testCase.expected.role);
        });
    });
});
