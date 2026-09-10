import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CollectionStats from '../../src/pages/CollectionStats.jsx';
import BinderCollection from '../../src/pages/BinderCollection.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { PriceProvider } from '../../src/contexts/PriceContext.jsx';
import { pricedPrinting, unpricedPrinting, otherCard } from '../fixtures/printings.js';
import { setOpenBinderId } from '../../src/utils/openBinder.js';
import { recentMovers } from '../../src/services/fabDb.js';

const mockGetBinderEntries = jest.fn();
const mockGetBinders = jest.fn();
const mockOpenDetail = jest.fn();
let mockUser = { id: 'user-1' };

jest.mock('../../src/contexts/AuthContext.jsx', () => ({
    useAuth: () => ({ user: mockUser }),
}));

jest.mock('../../src/contexts/EntitlementContext.jsx', () => ({
    useEntitlement: () => ({ isPro: true, loading: false }),
}));

jest.mock('../../src/hooks/useCardData.jsx', () => {
    const { pricedPrinting: priced, unpricedPrinting: unpriced, otherCard: other } = require('../fixtures/printings.js');
    const cards = [priced, unpriced, other];
    return {
        useCardData: () => ({
            cards,
            cardGroups: [],
            cardIdLookup: Object.fromEntries(cards.map((c) => [c._uniqueId, c])),
            pricesUpdatedAt: '2026-08-14T12:00:00Z',
        }),
    };
});

jest.mock('../../src/contexts/CardDetailContext.jsx', () => ({
    useCardDetail: () => ({ openDetail: mockOpenDetail }),
}));

jest.mock('../../src/services/binder.js', () => ({
    TRADE_BINDER_ID: 'system:trade',
    COLLECTION_BINDER_ID: 'system:collection',
    WANT_BINDER_ID: 'system:want',
    isWantListBinder: (binderOrId) => {
        const id = typeof binderOrId === 'string' ? binderOrId : binderOrId?.clientId;
        return id === 'system:want';
    },
    isProtectedBinder: (binderOrId) => {
        const id = typeof binderOrId === 'string' ? binderOrId : binderOrId?.clientId;
        return id === 'system:want' || id === 'system:trade' || binderOrId?.role === 'trade';
    },
    countableLiveBinders: (binders) =>
        (binders || []).filter((b) => !b.deletedAt && b.clientId !== 'system:want'),
    gridOrderBinders: (binders) => {
        const live = (binders || []).filter((b) => !b.deletedAt);
        const trade = live.find((b) => b.role === 'trade');
        const want = live.find((b) => b.clientId === 'system:want') || {
            clientId: 'system:want',
            name: 'Want List',
            role: 'standard',
            deletedAt: null,
        };
        const collection = live.find((b) => b.clientId === 'system:collection');
        const rest = live.filter((b) =>
            b !== trade && b !== want && b !== collection && b.clientId !== 'system:want',
        );
        return [...(trade ? [trade] : []), want, ...(collection ? [collection] : []), ...rest];
    },
    getBinderEntries: (...args) => mockGetBinderEntries(...args),
    getBinders: (...args) => mockGetBinders(...args),
    upsertEntry: jest.fn(),
    removeEntry: jest.fn(),
    ensureBinderShare: jest.fn(),
    regenerateBinderShare: jest.fn(),
    setBinderShareEnabled: jest.fn(),
    createBinder: jest.fn(),
    renameBinder: jest.fn(),
    deleteBinder: jest.fn(),
    clearBinder: jest.fn(),
    applyBinderMove: jest.fn(),
}));

jest.mock('../../src/services/fabDb.js', () => ({
    recentMovers: jest.fn(),
}));

jest.mock('../../src/components/elements/Header.jsx', () => () => (
    <div data-testid="header" />
));

jest.mock('../../src/components/search/index.js', () => ({
    SearchInput: () => <div data-testid="search-input" />,
    SearchDialog: () => null,
}));

jest.mock('../../src/components/auth/SignInDialog.jsx', () => ({
    __esModule: true,
    default: () => null,
}));

const defaultBinders = {
    data: {
        binders: [
            { clientId: 'system:trade', name: 'Trade Binder', role: 'trade', deletedAt: null },
            { clientId: 'system:collection', name: 'Collection', role: 'standard', deletedAt: null },
        ],
    },
    error: null,
};

const gainer = {
    direction: 'gainer',
    rank: 1,
    card_id: pricedPrinting._uniqueId,
    name: 'Lightning Press',
    set_name: 'Super Slam',
    finish: 'Normal',
    image_url: null,
    start_low: 8,
    start_on: '2026-08-22',
    latest_low: 12.5,
    percent_change: 0.5625,
    amount_change: 4.5,
};

const catalogGainer = {
    ...gainer,
    card_id: otherCard._uniqueId,
    name: 'Sink Below',
    set_name: 'Welcome to Rathe',
};

const wrap = (ui, route = '/binder') => render(
    <ThemeProvider theme={createTheme()}>
        <ThemeModeProvider>
            <PriceProvider>
                <MemoryRouter initialEntries={[route]}>
                    {ui}
                </MemoryRouter>
            </PriceProvider>
        </ThemeModeProvider>
    </ThemeProvider>,
);

const routes = (
    <Routes>
        <Route path="/binder" element={<BinderCollection isWanted={false} />} />
        <Route path="/binder/stats" element={<CollectionStats />} />
        <Route path="/wants" element={<BinderCollection isWanted={true} />} />
    </Routes>
);

describe('Collection Stats entry and page', () => {
    beforeEach(() => {
        mockUser = { id: 'user-1' };
        mockOpenDetail.mockClear();
        recentMovers.mockReset();
        recentMovers.mockResolvedValue([gainer]);
        setOpenBinderId(null);
        mockGetBinders.mockResolvedValue(defaultBinders);
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 1,
                        isWanted: false,
                        binderId: 'system:trade',
                        card: pricedPrinting,
                    },
                ],
                wants: [],
            },
            error: null,
        });
    });

    test('/binder shows Collection Stats with no currency; click opens /binder/stats', async () => {
        wrap(routes);
        fireEvent.click(await screen.findByTestId('binder-tile-system:trade'));
        const button = await screen.findByTestId('collection-stats');
        expect(button).toHaveTextContent('Collection Stats');
        expect(button).not.toHaveTextContent('$');
        expect(screen.queryByTestId('binder-value-total')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        fireEvent.click(button);
        await waitFor(() => {
            expect(screen.getByTestId('collection-stats-headline')).toHaveTextContent('$12.50');
        });
        expect(screen.getByTestId('collection-stats-headline')).toHaveTextContent('€10.20');
        expect(screen.getByText('Total Value')).toBeInTheDocument();
        expect(screen.getByText('Collection Stats', { selector: 'h4' })).toBeInTheDocument();
        expect(screen.getByText('Trade Binder')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByTestId('binder-value-headline')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Back/i }));
        expect(await screen.findByTestId('collection-stats')).toBeInTheDocument();
        expect(screen.getByTestId('binder-open-name')).toHaveTextContent('Trade Binder');
    });

    test('/wants has no Collection Stats control', async () => {
        wrap(routes, '/wants');
        await waitFor(() => screen.getByText('Want List'));
        expect(screen.queryByTestId('collection-stats')).not.toBeInTheDocument();
    });

    test('empty open Binder has no Collection Stats button', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: { binder: [], wants: [] },
            error: null,
        });
        wrap(routes);
        fireEvent.click(await screen.findByTestId('binder-tile-system:trade'));
        await waitFor(() => screen.getByTestId('binder-open-name'));
        expect(screen.queryByTestId('collection-stats')).not.toBeInTheDocument();
    });

    test('direct /binder/stats with empty Binder sends the player back to /binder', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: { binder: [], wants: [] },
            error: null,
        });
        setOpenBinderId('system:trade');
        wrap(routes, '/binder/stats');
        expect(await screen.findByTestId('binder-grid')).toBeInTheDocument();
    });

    test('headline shows Total Value with USD and Euro side by side', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 2,
                        isWanted: false,
                        binderId: 'system:trade',
                        card: pricedPrinting,
                    },
                    {
                        cardId: unpricedPrinting._uniqueId,
                        quantity: 1,
                        isWanted: false,
                        binderId: 'system:trade',
                        card: unpricedPrinting,
                    },
                ],
                wants: [],
            },
            error: null,
        });
        setOpenBinderId('system:trade');
        wrap(routes, '/binder/stats');
        const headline = await screen.findByTestId('collection-stats-headline');
        expect(headline).toHaveTextContent('Total Value');
        expect(headline).toHaveTextContent('$25.00');
        expect(headline).toHaveTextContent('€20.40');
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
        expect(screen.queryByText('€0.00')).not.toBeInTheDocument();
        expect(screen.queryByText('TCGplayer (USD)')).not.toBeInTheDocument();
        expect(screen.queryByText('CardMarket (EUR)')).not.toBeInTheDocument();
        expect(screen.queryByText('Top Printings')).not.toBeInTheDocument();
        expect(screen.queryByText(/3 copies/)).not.toBeInTheDocument();
        expect(screen.queryByText(/^Stock$/)).not.toBeInTheDocument();
    });

    test('movers call this Binder ids only and show copies; tap opens details', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 2,
                        isWanted: false,
                        binderId: 'system:trade',
                        card: pricedPrinting,
                    },
                ],
                wants: [],
            },
            error: null,
        });
        recentMovers.mockImplementation(async (source, ids) => {
            if (ids && ids.length === 1 && ids[0] === pricedPrinting._uniqueId) {
                return [gainer];
            }
            return [catalogGainer];
        });
        setOpenBinderId('system:trade');
        wrap(routes, '/binder/stats');
        expect((await screen.findAllByText('Lightning Press')).length).toBeGreaterThan(0);
        expect(await screen.findByText(/Super Slam/)).toBeInTheDocument();
        expect(screen.getAllByText(/2 copies/).length).toBeGreaterThan(0);
        expect(screen.getByText('Gainers')).toBeInTheDocument();
        expect(screen.queryByText('Sink Below')).not.toBeInTheDocument();
        expect(recentMovers).toHaveBeenCalledWith('tcgplayer', [pricedPrinting._uniqueId]);

        fireEvent.click(screen.getAllByText('Lightning Press')[0]);
        expect(mockOpenDetail).toHaveBeenCalledWith(expect.objectContaining({
            _uniqueId: pricedPrinting._uniqueId,
        }));
        expect(screen.getByTestId('collection-stats-headline')).toBeInTheDocument();
    });

    test('Printing in Binder A does not appear on Binder B', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 1,
                        isWanted: false,
                        binderId: 'system:trade',
                        card: pricedPrinting,
                    },
                ],
                wants: [],
            },
            error: null,
        });
        setOpenBinderId('system:collection');
        wrap(routes, '/binder/stats');
        expect(await screen.findByTestId('binder-grid')).toBeInTheDocument();
    });

    test('RPC empty with ids is honest empty; headline stays', async () => {
        recentMovers.mockResolvedValue([]);
        setOpenBinderId('system:trade');
        wrap(routes, '/binder/stats');
        expect(await screen.findByText(/None of these Printings gained or lost enough to rank/)).toBeInTheDocument();
        expect(screen.getByTestId('collection-stats-headline')).toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    });

    test('movers error shows retry and leaves headline and snapshot visible', async () => {
        recentMovers.mockRejectedValue(new Error('offline'));
        setOpenBinderId('system:trade');
        wrap(routes, '/binder/stats');
        expect(await screen.findByText('Retry')).toBeInTheDocument();
        expect(screen.getByTestId('collection-stats-headline')).toBeInTheDocument();
        expect(screen.getByText('Total Value')).toBeInTheDocument();
    });

    test('Want List ids are never sent', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 1,
                        isWanted: false,
                        binderId: 'system:trade',
                        card: pricedPrinting,
                    },
                ],
                wants: [
                    {
                        cardId: unpricedPrinting._uniqueId,
                        quantity: 1,
                        isWanted: true,
                        card: unpricedPrinting,
                    },
                ],
            },
            error: null,
        });
        setOpenBinderId('system:trade');
        wrap(routes, '/binder/stats');
        await screen.findByTestId('collection-stats-headline');
        await waitFor(() => expect(recentMovers).toHaveBeenCalled());
        const idLists = recentMovers.mock.calls.map((call) => call[1]);
        expect(idLists.every((ids) => !ids || !ids.includes(unpricedPrinting._uniqueId))).toBe(true);
    });
});
