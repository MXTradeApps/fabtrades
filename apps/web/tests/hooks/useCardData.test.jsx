import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';

jest.mock('../../src/services/fabDb.js', () => ({
    fetchCatalog: jest.fn(),
}));

import { fetchCatalog } from '../../src/services/fabDb.js';
import { CardDataProvider, useCardData } from '../../src/hooks/useCardData.jsx';

const catalogWith = (marketPrice, pricesUpdatedAt) => ({
    version: 1,
    pricesUpdatedAt,
    sets: [],
    rows: [{
        productId: 1,
        name: 'Command and Conquer',
        groupId: 10,
        subTypeName: 'Normal',
        extNumber: 'ARC159',
        extCardType: 'Attack Action',
        extRarity: 'Majestic',
        marketPrice,
        lowPrice: marketPrice - 5,
        _uniqueId: '1-Normal',
        _setName: 'Arcane Rising',
        _setNumber: 4,
    }],
});

const Probe = () => {
    const { cards, dataReady, pricesUpdatedAt } = useCardData();
    return (
        <div>
            <span data-testid="ready">{String(dataReady)}</span>
            <span data-testid="price">{cards[0]?.marketPrice ?? 'none'}</span>
            <span data-testid="stamp">{pricesUpdatedAt ?? 'none'}</span>
        </div>
    );
};

describe('CardDataProvider', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('is ready on the snapshot, then swaps in fresher prices when they arrive', async () => {
        let refresh;
        fetchCatalog.mockImplementation(async ({ onRefresh }) => {
            refresh = onRefresh;
            return catalogWith(40, '2026-10-05T06:00:00.000Z');
        });

        render(<CardDataProvider><Probe /></CardDataProvider>);

        // Search unlocks on the snapshot alone, before any fresher catalog exists.
        await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
        expect(screen.getByTestId('price').textContent).toBe('40');
        expect(screen.getByTestId('stamp').textContent).toBe('2026-10-05T06:00:00.000Z');

        act(() => refresh(catalogWith(55, '2026-10-06T06:00:00.000Z')));

        expect(screen.getByTestId('price').textContent).toBe('55');
        expect(screen.getByTestId('stamp').textContent).toBe('2026-10-06T06:00:00.000Z');
        expect(screen.getByTestId('ready').textContent).toBe('true');
    });

    test('ignores a fresher catalog that arrives after the provider is gone', async () => {
        let refresh;
        fetchCatalog.mockImplementation(async ({ onRefresh }) => {
            refresh = onRefresh;
            return catalogWith(40, '2026-10-05T06:00:00.000Z');
        });
        const errors = jest.spyOn(console, 'error').mockImplementation(() => {});

        const { unmount } = render(<CardDataProvider><Probe /></CardDataProvider>);
        await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
        unmount();

        expect(() => refresh(catalogWith(55, '2026-10-06T06:00:00.000Z'))).not.toThrow();
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
    });
});
