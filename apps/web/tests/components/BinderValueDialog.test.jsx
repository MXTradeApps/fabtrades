import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BinderValueDialog from '../../src/components/binder/BinderValueDialog.jsx';
import BinderCollection from '../../src/pages/BinderCollection.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { pricedPrinting, unpricedPrinting } from '../fixtures/printings.js';

const mockGetBinderEntries = jest.fn();

jest.mock('../../src/contexts/AuthContext.jsx', () => ({
    useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../src/contexts/EntitlementContext.jsx', () => ({
    useEntitlement: () => ({ isPro: true, loading: false }),
}));

jest.mock('../../src/hooks/useCardData.jsx', () => {
    const { pricedPrinting: priced, unpricedPrinting: unpriced } = require('../fixtures/printings.js');
    return {
        useCardData: () => ({
            cards: [priced, unpriced],
            cardGroups: [],
            pricesUpdatedAt: '2026-08-14T12:00:00Z',
        }),
    };
});

jest.mock('../../src/contexts/CardDetailContext.jsx', () => ({
    useCardDetail: () => ({ openDetail: jest.fn() }),
}));

jest.mock('../../src/services/binder.js', () => ({
    getBinderEntries: (...args) => mockGetBinderEntries(...args),
    getBinders: () => Promise.resolve({
        data: {
            binders: [
                { clientId: 'system:trade', name: 'Trade Binder', role: 'trade', deletedAt: null },
                { clientId: 'system:collection', name: 'Collection', role: 'standard', deletedAt: null },
            ],
        },
        error: null,
    }),
    upsertEntry: jest.fn(),
    removeEntry: jest.fn(),
    ensureBinderShare: jest.fn(),
    regenerateBinderShare: jest.fn(),
    setBinderShareEnabled: jest.fn(),
    createBinder: jest.fn(),
    renameBinder: jest.fn(),
    deleteBinder: jest.fn(),
    applyBinderMove: jest.fn(),
    TRADE_BINDER_ID: 'system:trade',
    COLLECTION_BINDER_ID: 'system:collection',
    gridOrderBinders: (binders) => {
        const live = (binders || []).filter((b) => !b.deletedAt);
        const trade = live.find((b) => b.role === 'trade');
        const collection = live.find((b) => b.clientId === 'system:collection');
        const rest = live.filter((b) => b !== trade && b !== collection);
        return [...(trade ? [trade] : []), ...(collection ? [collection] : []), ...rest];
    },
}));

jest.mock('../../src/components/elements/Header.jsx', () => () => (
    <div data-testid="header" />
));

jest.mock('../../src/components/search/index.js', () => ({
    SearchInput: () => <div data-testid="search-input" />,
}));

jest.mock('../../src/components/auth/SignInDialog.jsx', () => ({
    __esModule: true,
    default: () => null,
}));

const catalogById = new Map([
    [pricedPrinting._uniqueId, pricedPrinting],
    [unpricedPrinting._uniqueId, unpricedPrinting],
]);

const renderDialog = ({
    open = true,
    headline = '$12.50',
    entries = [{ cardId: pricedPrinting._uniqueId, quantity: 1, card: pricedPrinting }],
    onClose = jest.fn(),
} = {}) => {
    const utils = render(
        <ThemeProvider theme={createTheme()}>
            <div data-testid="parent-page">Binder list</div>
            <BinderValueDialog
                open={open}
                onClose={onClose}
                headline={headline}
                entries={entries}
                catalogById={catalogById}
            />
        </ThemeProvider>,
    );
    return { ...utils, onClose };
};

const renderCollection = (isWanted) =>
    render(
        <MemoryRouter>
            <ThemeProvider theme={createTheme()}>
                <ThemeModeProvider>
                    <BinderCollection isWanted={isWanted} />
                </ThemeModeProvider>
            </ThemeProvider>
        </MemoryRouter>,
    );

describe('BinderValueDialog', () => {
    test('shows headline over the parent page and dismisses via close', () => {
        const { onClose } = renderDialog();
        expect(screen.getByTestId('parent-page')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Binder value' })).toBeInTheDocument();
        expect(screen.getByTestId('binder-value-headline')).toHaveTextContent('$12.50');
        fireEvent.click(screen.getByLabelText('Close'));
        expect(onClose).toHaveBeenCalled();
    });

    test('shows TCG Market/Low and CardMarket Trend/Low; unpriced is dash not zero', () => {
        renderDialog({
            entries: [
                { cardId: pricedPrinting._uniqueId, quantity: 2, card: pricedPrinting },
                { cardId: unpricedPrinting._uniqueId, quantity: 1, card: unpricedPrinting },
            ],
        });
        expect(screen.getByText('TCGplayer (USD)')).toBeInTheDocument();
        expect(screen.getByText('CardMarket (EUR)')).toBeInTheDocument();
        expect(screen.getAllByText('$25.00').length).toBeGreaterThan(0);
        expect(screen.getByText('$16.00')).toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
        expect(screen.queryByText('€0.00')).not.toBeInTheDocument();
        expect(screen.getAllByText(/unpriced/).length).toBeGreaterThan(0);

        cleanup();
        renderDialog({
            headline: '—',
            entries: [
                { cardId: unpricedPrinting._uniqueId, quantity: 1, card: unpricedPrinting },
            ],
        });
        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
        expect(screen.queryByText('€0.00')).not.toBeInTheDocument();
    });

    test('shows stock counts and top Printings without padding', () => {
        renderDialog({
            headline: '$12.50',
            entries: [
                { cardId: pricedPrinting._uniqueId, quantity: 1, card: pricedPrinting },
            ],
        });
        expect(screen.getByText(/1 copies/)).toBeInTheDocument();
        expect(screen.getByText(/1 Printings/)).toBeInTheDocument();
        expect(screen.getByText(/0 foil/)).toBeInTheDocument();
        expect(screen.getByText(/1 Regular/)).toBeInTheDocument();
        expect(screen.getByText('Top Printings')).toBeInTheDocument();
        expect(screen.getByText('Lightning Press')).toBeInTheDocument();
        expect(screen.getByText(/Normal · ×1/)).toBeInTheDocument();
    });
});

describe('BinderCollection entry', () => {
    beforeEach(() => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 1,
                        isWanted: false,
                        card: pricedPrinting,
                    },
                ],
                wants: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 1,
                        isWanted: true,
                        card: pricedPrinting,
                    },
                ],
            },
            error: null,
        });
    });

    test('/binder total opens the value dialog matching the header', async () => {
        renderCollection(false);
        const tile = await screen.findByTestId('binder-tile-system:trade');
        fireEvent.click(tile);
        const total = await waitFor(() => {
            const el = screen.getByTestId('binder-value-total');
            expect(el).toHaveTextContent('$12.5');
            return el;
        });
        fireEvent.click(total);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByTestId('binder-value-headline')).toHaveTextContent('$12.5');
        fireEvent.click(screen.getByLabelText('Close'));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.getByTestId('binder-value-total')).toBeInTheDocument();
    });

    test('/wants total is not the Binder value control', async () => {
        renderCollection(true);
        await waitFor(() => screen.getByText('Want List'));
        expect(screen.queryByTestId('binder-value-total')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
