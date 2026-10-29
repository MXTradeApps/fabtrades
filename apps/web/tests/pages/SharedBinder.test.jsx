import { render, screen } from '@testing-library/react';
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

const renderShared = () =>
    render(
        <MemoryRouter initialEntries={[`/b/${'a'.repeat(32)}`]}>
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

    test('sharedBinderTitle handles names ending in s', () => {
        expect(sharedBinderTitle('James')).toBe('James’ Binder');
        expect(sharedBinderTitle('  Max ')).toBe('Max’s Binder');
        expect(sharedBinderTitle('')).toBe('Shared Binder');
    });
});
