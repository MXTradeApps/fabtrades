import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SharedBinder from '../../src/pages/SharedBinder.jsx';
import { sharedBinderTitle } from '../../src/utils/binderNames.js';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';

const mockGetPublicBinder = jest.fn();

jest.mock('../../src/contexts/AuthContext.jsx', () => ({
    useAuth: () => ({ user: null }),
}));

jest.mock('../../src/contexts/EntitlementContext.jsx', () => ({
    useEntitlement: () => ({ isPro: false, loading: false }),
}));

jest.mock('../../src/hooks/useCardData.jsx', () => {
    const { pricedPrinting: priced } = require('../fixtures/printings.js');
    return {
        useCardData: () => ({
            cards: [priced],
            cardGroups: [],
            pricesUpdatedAt: '2026-08-14T12:00:00Z',
        }),
    };
});

jest.mock('../../src/contexts/CardDetailContext.jsx', () => ({
    useCardDetail: () => ({ openDetail: jest.fn() }),
}));

jest.mock('../../src/services/binder.js', () => ({
    getPublicBinder: (...args) => mockGetPublicBinder(...args),
}));

jest.mock('../../src/components/search/index.js', () => ({
    SearchInput: () => <div data-testid="search-input" />,
    SearchDialog: () => null,
}));

jest.mock('../../src/components/auth/SignInDialog.jsx', () => ({
    __esModule: true,
    default: () => null,
}));

const renderShared = (query = '') =>
    render(
        <MemoryRouter initialEntries={[`/b/${'a'.repeat(32)}${query}`]}>
            <ThemeProvider theme={createTheme()}>
                <ThemeModeProvider>
                    <Routes>
                        <Route path="/b/:token" element={<SharedBinder />} />
                    </Routes>
                </ThemeModeProvider>
            </ThemeProvider>
        </MemoryRouter>,
    );

const entry = {
    cardId: '123-Normal',
    quantity: 3,
    condition: 'NM',
    card: { name: 'Lightning Press' },
};

describe('SharedBinder', () => {
    test('titles the page with the owner name and shows a card grid', async () => {
        mockGetPublicBinder.mockResolvedValue({
            data: { ownerName: 'Max', entries: [entry] },
            error: null,
        });
        renderShared();

        expect(await screen.findByText('Max’s Binder')).toBeInTheDocument();
        expect(screen.queryByText('Shared Binder')).not.toBeInTheDocument();
        expect(screen.getByTestId('binder-card-grid')).toBeInTheDocument();
        const tile = screen.getByTestId('binder-card-tile-123-Normal');
        expect(tile).toHaveTextContent('Lightning Press');
        expect(tile).toHaveTextContent('3×');
        expect(tile.querySelector('img')).toHaveAttribute('src', expect.stringContaining('SUP001'));
    });

    test('falls back to the generic title without an owner name', async () => {
        mockGetPublicBinder.mockResolvedValue({
            data: { ownerName: null, entries: [entry] },
            error: null,
        });
        renderShared();
        expect(await screen.findByText('Shared Binder')).toBeInTheDocument();
    });

    describe('filters', () => {
        const foilEntry = {
            cardId: 'stub-rainbow',
            quantity: 1,
            condition: 'NM',
            card: { name: 'Snatch', subTypeName: 'Rainbow Foil', rarity: 'Rare', setName: 'Welcome to Rathe' },
        };

        beforeEach(() => {
            mockGetPublicBinder.mockResolvedValue({
                data: { ownerName: 'Max', entries: [entry, foilEntry] },
                error: null,
            });
        });

        test('picking a foiling narrows the grid and shows the count', async () => {
            renderShared();
            fireEvent.click(await screen.findByTestId('binder-filter-foiling-rainbow'));
            expect(screen.getByTestId('binder-card-tile-stub-rainbow')).toBeInTheDocument();
            expect(screen.queryByTestId('binder-card-tile-123-Normal')).not.toBeInTheDocument();
            expect(screen.getByTestId('binder-filter-result-count')).toHaveTextContent('1 of 4 cards');

            fireEvent.click(screen.getByTestId('binder-filters-clear-all'));
            expect(screen.getByTestId('binder-card-tile-123-Normal')).toBeInTheDocument();
        });

        test('reads filters from the link', async () => {
            renderShared('?foil=nonfoil');
            expect(await screen.findByTestId('binder-card-tile-123-Normal')).toBeInTheDocument();
            expect(screen.queryByTestId('binder-card-tile-stub-rainbow')).not.toBeInTheDocument();
        });

        test('pitch comes from the name qualifier when there is no pitch field', async () => {
            mockGetPublicBinder.mockResolvedValue({
                data: {
                    ownerName: 'Max',
                    entries: [entry, { ...foilEntry, card: { ...foilEntry.card, name: 'Snatch (Blue)' } }],
                },
                error: null,
            });
            renderShared('?pitch=3');
            expect(await screen.findByTestId('binder-card-tile-stub-rainbow')).toBeInTheDocument();
            expect(screen.queryByTestId('binder-card-tile-123-Normal')).not.toBeInTheDocument();
        });

        test('search matches by name', async () => {
            renderShared();
            fireEvent.change(await screen.findByLabelText('Search this binder'), { target: { value: 'snat' } });
            expect(screen.getByTestId('binder-card-tile-stub-rainbow')).toBeInTheDocument();
            expect(screen.queryByTestId('binder-card-tile-123-Normal')).not.toBeInTheDocument();
        });

        test('shows a clear-filters empty state when nothing matches', async () => {
            renderShared('?foil=rainbow');
            fireEvent.change(await screen.findByLabelText('Search this binder'), { target: { value: 'press' } });
            expect(screen.getByText('No matching cards in this binder')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
            expect(screen.getByTestId('binder-card-tile-123-Normal')).toBeInTheDocument();
        });

        test('ignores link filters that match nothing in this binder', async () => {
            renderShared('?foil=gold');
            expect(await screen.findByTestId('binder-card-tile-123-Normal')).toBeInTheDocument();
            expect(screen.getByTestId('binder-card-tile-stub-rainbow')).toBeInTheDocument();
            expect(screen.queryByTestId('binder-active-filters')).not.toBeInTheDocument();
        });
    });

    test('sharedBinderTitle handles names ending in s', () => {
        expect(sharedBinderTitle('James')).toBe('James’ Binder');
        expect(sharedBinderTitle('  Max ')).toBe('Max’s Binder');
        expect(sharedBinderTitle('')).toBe('Shared Binder');
    });
});
