import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CollectionStats from '../../src/pages/CollectionStats.jsx';
import BinderCollection from '../../src/pages/BinderCollection.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { PriceProvider } from '../../src/contexts/PriceContext.jsx';
import { pricedPrinting, unpricedPrinting, otherCard } from '../fixtures/printings.js';
import { setOpenBinderId } from '../../src/utils/openBinder.js';
import { trendingMovers, collectionValueHistory } from '../../src/services/fabDb.js';

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
    trendingMovers: jest.fn(),
    collectionValueHistory: jest.fn(),
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
    start_price: 8,
    latest_price: 12.5,
    percent_change: 0.5625,
    amount_change: 4.5,
    history: [8, 9, 12.5],
};

const loser = {
    ...gainer,
    direction: 'loser',
    card_id: unpricedPrinting._uniqueId,
    name: 'Falling Card',
    start_price: 10,
    latest_price: 9,
    percent_change: -0.1,
    amount_change: -1,
    history: [10, 9],
};

const catalogGainer = {
    ...gainer,
    card_id: otherCard._uniqueId,
    name: 'Sink Below',
    set_name: 'Welcome to Rathe',
};

/** [count] daily rows ending 2026-11-15, starting at [start] and rising [step] a day. */
const valueRows = (count, start, step) => Array.from({ length: count }, (_, i) => {
    const day = new Date(Date.UTC(2026, 10, 15) - (count - 1 - i) * 86400000);
    return {
        captured_on: day.toISOString().slice(0, 10),
        total_value: start + i * step,
        priced_copies: 1,
        unpriced_copies: 0,
    };
});

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
        trendingMovers.mockReset();
        trendingMovers.mockResolvedValue([gainer]);
        collectionValueHistory.mockReset();
        collectionValueHistory.mockResolvedValue(valueRows(40, 100, 1));
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
        expect(screen.getByRole('heading', { name: 'Collection Stats' })).toBeInTheDocument();
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
        // The headline mounts before the entries load; wait for the totals.
        await waitFor(() => expect(headline).toHaveTextContent('$25.00'));
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
        trendingMovers.mockImplementation(async (source, opts) => {
            const ids = opts?.cardIds;
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
        expect(screen.getByRole('heading', { name: 'Rising' })).toBeInTheDocument();
        expect(screen.getByTestId('trend-row')).toHaveTextContent('was $8.00 → $12.50');
        // Net counts both copies: 2 × $4.50.
        expect(screen.getByTestId('collection-stats-net')).toHaveTextContent('1 card in this Binder moved this week · net +$9.00');
        expect(screen.queryByText('Sink Below')).not.toBeInTheDocument();
        expect(trendingMovers).toHaveBeenCalledWith('tcgplayer', {
            days: 7,
            sort: 'percent',
            minPrice: 0,
            cardIds: [pricedPrinting._uniqueId],
            limit: null,
        });

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

    test('30 days reloads the window; By $ ranks by change across held copies', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    { cardId: pricedPrinting._uniqueId, quantity: 1, isWanted: false, binderId: 'system:trade', card: pricedPrinting },
                    { cardId: unpricedPrinting._uniqueId, quantity: 6, isWanted: false, binderId: 'system:trade', card: unpricedPrinting },
                ],
                wants: [],
            },
            error: null,
        });
        trendingMovers.mockResolvedValue([gainer, loser]);
        setOpenBinderId('system:trade');
        wrap(routes, '/binder/stats');
        // +$4.50 × 1 and −$1.00 × 6.
        expect(await screen.findByTestId('collection-stats-net')).toHaveTextContent('2 cards in this Binder moved this week · net −$1.50');
        expect(screen.getByTestId('movers-list-gainer')).toHaveTextContent('Lightning Press');
        expect(screen.getByTestId('movers-list-loser')).toHaveTextContent('Falling Card');
        expect(screen.getByTestId('movers-list-loser')).toHaveTextContent('6 copies');

        fireEvent.click(within(screen.getByTestId('collection-stats-controls')).getByRole('button', { name: '30 days' }));
        await waitFor(() => expect(trendingMovers).toHaveBeenLastCalledWith('tcgplayer', expect.objectContaining({
            days: 30,
            limit: null,
        })));
        expect(await screen.findByTestId('collection-stats-net')).toHaveTextContent('in the last 30 days');

        const calls = trendingMovers.mock.calls.length;
        fireEvent.click(screen.getByRole('button', { name: 'By $' }));
        expect(trendingMovers.mock.calls.length).toBe(calls);
    });

    test('long lists show the top 10 with a Show all button', async () => {
        const many = Array.from({ length: 12 }, (_, i) => ({
            ...gainer,
            card_id: `many-${i}`,
            name: `Riser ${i + 1}`,
            percent_change: 1 - i * 0.05,
        }));
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: many.map((row) => ({
                    cardId: row.card_id,
                    quantity: 1,
                    isWanted: false,
                    binderId: 'system:trade',
                    card: { ...pricedPrinting, _uniqueId: row.card_id },
                })),
                wants: [],
            },
            error: null,
        });
        trendingMovers.mockResolvedValue(many);
        setOpenBinderId('system:trade');
        wrap(routes, '/binder/stats');
        await screen.findByText('Riser 1');
        expect(screen.getAllByTestId('trend-row')).toHaveLength(10);
        fireEvent.click(screen.getByRole('button', { name: 'Show all 12' }));
        expect(screen.getAllByTestId('trend-row')).toHaveLength(12);
    });

    test('value over time charts this Binder at the copies held, 30 days first', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    { cardId: pricedPrinting._uniqueId, quantity: 2, isWanted: false, binderId: 'system:trade', card: pricedPrinting },
                    { cardId: otherCard._uniqueId, quantity: 5, isWanted: false, binderId: 'system:collection', card: otherCard },
                ],
                wants: [],
            },
            error: null,
        });
        // 91 daily rows: $100 rising $1 a day to $190.
        collectionValueHistory.mockResolvedValue(valueRows(91, 100, 1));
        setOpenBinderId('system:trade');
        wrap(routes, '/binder/stats');
        const change = await screen.findByTestId('value-over-time-change');
        // Last 30 days: $160 to $190.
        expect(change).toHaveTextContent('+$30.00 (+19%) over 30 days · was $160.00 → $190.00');
        expect(screen.getByTestId('value-history-chart')).toBeInTheDocument();
        expect(collectionValueHistory).toHaveBeenCalledWith(
            'tcgplayer',
            { [pricedPrinting._uniqueId]: 2 },
            { days: 90 },
        );

        const calls = collectionValueHistory.mock.calls.length;
        fireEvent.click(within(screen.getByTestId('value-over-time')).getByRole('button', { name: '90 days' }));
        expect(screen.getByTestId('value-over-time-change'))
            .toHaveTextContent('+$90.00 (+90%) over 90 days · was $100.00 → $190.00');
        expect(collectionValueHistory.mock.calls.length).toBe(calls);
    });

    test('value over time shows a falling Binder in red wording and stays honest when empty or failing', async () => {
        collectionValueHistory.mockResolvedValue(valueRows(10, 50, -2));
        setOpenBinderId('system:trade');
        const first = wrap(routes, '/binder/stats');
        expect(await screen.findByTestId('value-over-time-change'))
            .toHaveTextContent('−$18.00 (−36%) over 9 days · was $50.00 → $32.00');
        first.unmount();

        collectionValueHistory.mockResolvedValue([]);
        const second = wrap(routes, '/binder/stats');
        expect(await screen.findByText(/Not enough TCGplayer price history/)).toBeInTheDocument();
        expect(screen.queryByTestId('value-history-chart')).not.toBeInTheDocument();
        second.unmount();

        collectionValueHistory.mockRejectedValue(new Error('offline'));
        wrap(routes, '/binder/stats');
        expect(await screen.findByText(/Couldn’t load the value history/)).toBeInTheDocument();
        expect(screen.getByTestId('collection-stats-headline')).toBeInTheDocument();
    });

    test('RPC empty with ids is honest empty; headline stays', async () => {
        trendingMovers.mockResolvedValue([]);
        setOpenBinderId('system:trade');
        wrap(routes, '/binder/stats');
        expect(await screen.findByText(/None of the cards in this Binder moved this week/)).toBeInTheDocument();
        expect(screen.getByTestId('collection-stats-headline')).toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    });

    test('movers error shows retry and leaves headline and snapshot visible', async () => {
        trendingMovers.mockRejectedValue(new Error('offline'));
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
        await waitFor(() => expect(trendingMovers).toHaveBeenCalled());
        const idLists = trendingMovers.mock.calls.map((call) => call[1]?.cardIds);
        expect(idLists.every((ids) => !ids || !ids.includes(unpricedPrinting._uniqueId))).toBe(true);
    });
});
