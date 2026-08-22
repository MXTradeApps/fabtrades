// Contract tests for Binder tile cover pick.
//
// These assert the shared fixtures in packages/contracts, which the Dart
// implementation in apps/mobile is held to as well.
import contract from '../../../../packages/contracts/binder_cover.json';
import { pickBinderCover } from '../../src/utils/binderCover.js';

describe('binder cover contract', () => {
    contract.cases.forEach((testCase) => {
        it(testCase.name, () => {
            const cover = pickBinderCover(testCase.entries, {
                source: testCase.source,
                headline: testCase.headline,
            });
            expect(cover.printingId).toBe(testCase.expected.printingId);
            if (testCase.expected.condition != null) {
                expect(cover.condition).toBe(testCase.expected.condition);
            }
        });
    });
});
