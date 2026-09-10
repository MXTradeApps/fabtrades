export const BINDER_PAGE_SIZE = 50;
export const BINDER_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

/**
 * Slice `items` into a page, clamping an out-of-range page index.
 */
export function paginate(items, page, rowsPerPage = BINDER_PAGE_SIZE) {
    const list = Array.isArray(items) ? items : [];
    const total = list.length;
    const size = Math.max(1, Number(rowsPerPage) || BINDER_PAGE_SIZE);
    const lastPage = Math.max(0, Math.ceil(total / size) - 1);
    const safePage = Math.min(Math.max(0, Number(page) || 0), lastPage);
    const start = safePage * size;
    const end = Math.min(start + size, total);
    return {
        page: safePage,
        rowsPerPage: size,
        total,
        start,
        end,
        rows: list.slice(start, end),
    };
}
