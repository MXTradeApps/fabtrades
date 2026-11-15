import { lastDays, spanDays, valueChange, valueHistoryPoints } from '../../src/utils/valueHistory.js';

describe('valueHistory', () => {
    test('points are sorted oldest first and unusable rows are dropped', () => {
        const points = valueHistoryPoints([
            { captured_on: '2026-11-03', total_value: '12.50' },
            { captured_on: '2026-11-01', total_value: 10 },
            { captured_on: '2026-11-02', total_value: null },
            { captured_on: null, total_value: 4 },
            { captured_on: '2026-11-04', total_value: 'n/a' },
        ]);
        expect(points).toEqual([
            { date: '2026-11-01', value: 10 },
            { date: '2026-11-03', value: 12.5 },
        ]);
        expect(valueHistoryPoints(null)).toEqual([]);
    });

    test('lastDays counts back from the newest point, not from today', () => {
        const points = [
            { date: '2026-10-01', value: 1 },
            { date: '2026-10-20', value: 2 },
            { date: '2026-11-01', value: 3 },
        ];
        expect(lastDays(points, 30).map((p) => p.date)).toEqual(['2026-10-20', '2026-11-01']);
        expect(lastDays(points, 31).map((p) => p.date)).toEqual(['2026-10-01', '2026-10-20', '2026-11-01']);
        expect(lastDays([], 30)).toEqual([]);
    });

    test('valueChange gives amount and ratio; no ratio from a zero start', () => {
        expect(valueChange([{ date: 'a', value: 100 }, { date: 'b', value: 125 }])).toEqual({
            start: 100,
            latest: 125,
            amount: 25,
            ratio: 0.25,
        });
        expect(valueChange([{ date: 'a', value: 0 }, { date: 'b', value: 5 }]).ratio).toBeNull();
        expect(valueChange([{ date: 'a', value: 1 }])).toBeNull();
    });

    test('spanDays is the calendar distance between the first and last point', () => {
        expect(spanDays([{ date: '2026-10-16', value: 1 }, { date: '2026-11-15', value: 2 }])).toBe(30);
        expect(spanDays([{ date: '2026-11-15', value: 2 }])).toBe(0);
    });
});
