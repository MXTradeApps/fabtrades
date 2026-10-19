// Contract tests for the "Post for sale" composer.
//
// These assert the shared fixtures in packages/contracts, which the Dart
// implementation in apps/mobile is held to as well. See
// packages/contracts/README.md.
import contract from '../../../../packages/contracts/sale_post.json';
import { buildSalePost, salePriceCents } from '../../src/utils/salePost.js';

describe('sale post contract', () => {
    describe('salePriceCents', () => {
        contract.salePriceCents.forEach(({ price, percent, expected }) => {
            it(`prices ${price} at ${percent}% as ${expected}`, () => {
                expect(salePriceCents(price, percent)).toBe(expected);
            });
        });
    });

    describe('buildSalePost', () => {
        contract.buildSalePost.forEach(({ name, input, expected }) => {
            it(name, () => {
                expect(buildSalePost(input)).toEqual(expected);
            });
        });
    });

    it('keeps every Discord message under the limit', () => {
        contract.buildSalePost
            .filter(({ input }) => input.platform === 'discord')
            .forEach(({ input, expected }) => {
                expected.forEach((message) => {
                    expect(message.length).toBeLessThanOrEqual(input.limit ?? 2000);
                });
            });
    });
});
