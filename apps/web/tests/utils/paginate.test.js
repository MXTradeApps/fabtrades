import { paginate, BINDER_PAGE_SIZE } from '../../src/utils/paginate.js';

describe('paginate', () => {
    const items = Array.from({ length: 120 }, (_, i) => i);

    test('returns the first page by default', () => {
        const result = paginate(items, 0);
        expect(result.rowsPerPage).toBe(BINDER_PAGE_SIZE);
        expect(result.rows).toEqual(items.slice(0, 50));
        expect(result.total).toBe(120);
        expect(result.start).toBe(0);
        expect(result.end).toBe(50);
    });

    test('returns a later page', () => {
        const result = paginate(items, 2, 50);
        expect(result.page).toBe(2);
        expect(result.rows).toEqual(items.slice(100, 120));
        expect(result.start).toBe(100);
        expect(result.end).toBe(120);
    });

    test('clamps a page past the end', () => {
        const result = paginate(items, 99, 50);
        expect(result.page).toBe(2);
        expect(result.rows).toEqual(items.slice(100, 120));
    });

    test('handles an empty list', () => {
        const result = paginate([], 3, 50);
        expect(result.page).toBe(0);
        expect(result.rows).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.start).toBe(0);
        expect(result.end).toBe(0);
    });
});
