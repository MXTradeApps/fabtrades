import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { PriceProvider } from '../../src/contexts/PriceContext.jsx';
import Trends from '../../src/pages/Trends.jsx';
import SetList from '../../src/pages/SetList.jsx';
import Header from '../../src/components/elements/Header.jsx';
import { recentMovers, trendingMovers, printingRecentChanges } from '../../src/services/fabDb.js';
import { getBinderEntries } from '../../src/services/binder.js';
import { pricedPrinting, otherCard, unpricedPrinting } from '../fixtures/printings.js';

const mockOpenDetail = jest.fn();
let mockUser = null;

jest.mock('../../src/components/auth/LoginButton.jsx', () => () => null);

jest.mock('../../src/contexts/AuthContext.jsx', () => ({
    useAuth: () => ({ user: mockUser, loading: false, signOut: jest.fn(), authError: null }),
    AuthProvider: ({ children }) => children,
    OAUTH_PROVIDERS: ['discord'],
}));

jest.mock('../../src/contexts/CardDetailContext.jsx', () => ({
    useCardDetail: () => ({ openDetail: mockOpenDetail, closeDetail: jest.fn(), open: false, printing: null }),
    CardDetailProvider: ({ children }) => children,
}));

const mockCatalog = [
    { ...pricedPrinting, name: 'Awakening', displayName: 'Awakening (HNT001)', _setName: 'The Hunted' },
    otherCard,
    unpricedPrinting,
];

jest.mock('../../src/hooks/useCardData.jsx', () => ({
    useCardData: () => ({
        cards: mockCatalog,
        cardIdLookup: Object.fromEntries(mockCatalog.map((c) => [c._uniqueId, c])),
        pricesUpdatedAt: null,
        loading: false,
        dataReady: true,
        error: null,
        sets: [],
    }),
}));

jest.mock('../../src/hooks/useSets.js', () => ({
    useSets: () => ({
        sets: [{
            groupId: 1,
            name: 'Welcome to Rathe',
            abbreviation: 'WTR',
            publishedOn: '2019-10-11',
            cardCount: 2,
            topMarketPrice: 12,
            slug: 'welcome-to-rathe',
            logoUrl: '',
        }],
        loading: false,
        error: null,
    }),
}));

jest.mock('../../src/services/fabDb.js', () => ({
    recentMovers: jest.fn(),
    trendingMovers: jest.fn(),
    printingRecentChanges: jest.fn(),
}));

jest.mock('../../src/services/binder.js', () => ({
    getBinderEntries: jest.fn(),
}));

const gainer = {
    direction: 'gainer',
    rank: 1,
    card_id: pricedPrinting._uniqueId,
    name: 'Awakening',
    set_name: 'The Hunted',
    finish: 'Normal',
    image_url: null,
    start_low: 4,
    start_on: '2026-08-22',
    latest_low: 6,
    percent_change: 0.5,
    amount_change: 2,
    direction_total: 37,
    price_kind: 'low',
    start_price: 4,
    latest_price: 6,
    history: [4, 4.5, 5.2],
};

const wrap = (ui, route = '/trends') => render(
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

describe('Trends', () => {
    beforeEach(() => {
        mockUser = null;
        mockOpenDetail.mockClear();
        recentMovers.mockReset();
        trendingMovers.mockReset();
        printingRecentChanges.mockReset();
        getBinderEntries.mockReset();
        trendingMovers.mockResolvedValue([gainer]);
        printingRecentChanges.mockResolvedValue([]);
        getBinderEntries.mockResolvedValue({ data: { binder: [] }, error: null });
    });

    test('navigation has Trending and Browse Sets, not Home', () => {
        wrap(<Header />, '/');
        expect(screen.getAllByText('Trending').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Browse Sets').length).toBeGreaterThan(0);
        expect(screen.queryByText('Home')).not.toBeInTheDocument();
        expect(screen.getAllByText('Trade Calculator').length).toBeGreaterThan(0);
        expect(screen.getByRole('link', { name: 'iOS App' })).toHaveAttribute(
            'href',
            'https://apps.apple.com/us/app/fabtrades/id6794308687',
        );
        expect(screen.getByRole('link', { name: 'Android App' })).toHaveAttribute(
            'href',
            'https://play.google.com/store/apps/details?id=fabtrades.myapp',
        );
    });

    test('/trends lands on recent movers with no set list', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        expect(screen.getByRole('heading', { name: 'Trending' })).toBeInTheDocument();
        await screen.findByTestId('movers-list-gainer');
        expect(await screen.findByText('Awakening')).toBeInTheDocument();
        expect(screen.getByText(/The Hunted/)).toBeInTheDocument();
        expect(screen.queryByText('Welcome to Rathe')).not.toBeInTheDocument();
        expect(screen.queryByText('Your recent movers')).not.toBeInTheDocument();
        expect(screen.getByText(/Rising uses the TCGplayer Low/)).toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    });

    test('catalog Printing search covers movers; clear returns movers', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByTestId('movers-list-gainer');
        expect(await screen.findByRole('img', { name: 'Awakening' })).toBeInTheDocument();
        expect(trendingMovers).toHaveBeenCalledTimes(1);
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Awakening' },
        });
        expect(screen.getByTestId('trend-controls').closest('[data-movers-hidden]')).toBeTruthy();
        expect(screen.getAllByText('Awakening').length).toBeGreaterThan(0);
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: '' },
        });
        expect(screen.getByTestId('trend-controls').closest('[data-movers-hidden]')).toBeNull();
        expect(screen.queryByText('Welcome to Rathe')).not.toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Awakening' })).toBeInTheDocument();
        expect(trendingMovers).toHaveBeenCalledTimes(1);
    });

    test('signed-out has catalog-wide and no owned section', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByTestId('movers-list-gainer');
        expect(getBinderEntries).not.toHaveBeenCalled();
        expect(screen.queryByText('Your recent movers')).not.toBeInTheDocument();
    });

    test('signed-in shows how your cards moved, with net change across copies', async () => {
        mockUser = { id: 'user-1' };
        getBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    { cardId: pricedPrinting._uniqueId, isWanted: false, quantity: 3 },
                    { cardId: otherCard._uniqueId, isWanted: true, quantity: 1 },
                ],
            },
            error: null,
        });
        trendingMovers.mockImplementation(async (_source, opts) => {
            if (opts.cardIds) return [gainer];
            return [{ ...gainer, card_id: otherCard._uniqueId, name: 'Sink Below' }];
        });
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        expect(await screen.findByText('Sink Below')).toBeInTheDocument();
        const strip = await screen.findByTestId('your-movers');
        await waitFor(() => expect(within(strip).getByText(/1 of your cards moved this week/)).toBeInTheDocument());
        expect(within(strip).getByText('+$6.00')).toBeInTheDocument();
        expect(trendingMovers).toHaveBeenCalledWith('tcgplayer', expect.objectContaining({
            cardIds: [pricedPrinting._uniqueId],
            limit: null,
        }));
        fireEvent.click(within(strip).getByText('See them'));
        expect(within(strip).getByText(/3 copies/)).toBeInTheDocument();
    });

    test('signed-out has no your-binders strip', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByTestId('movers-list-gainer');
        expect(screen.queryByTestId('your-movers')).not.toBeInTheDocument();
    });

    test('rows show was → now with cents, percent and amount', async () => {
        trendingMovers.mockResolvedValue([{
            ...gainer, start_price: 1, latest_price: 4.2, percent_change: 3.2, amount_change: 3.2,
        }]);
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        const list = await screen.findByTestId('movers-list-gainer');
        await within(list).findByText('$4.20');
        expect(within(list).getByText(/was \$1\.00/)).toBeInTheDocument();
        expect(within(list).getByText('+320%')).toBeInTheDocument();
        expect(within(list).getByText('+$3.20')).toBeInTheDocument();
        expect(within(list).getByTestId('mover-sparkline')).toBeInTheDocument();
        expect(within(list).getAllByText('37 cards · by Low').length).toBeGreaterThan(0);
    });

    test('window, sort, and price floor controls refetch with those options', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByTestId('movers-list-gainer');
        expect(trendingMovers).toHaveBeenLastCalledWith('tcgplayer', {
            days: 7, sort: 'percent', minPrice: 0, limit: 10,
        });
        fireEvent.click(screen.getByRole('button', { name: '30 days' }));
        await waitFor(() => expect(trendingMovers).toHaveBeenLastCalledWith('tcgplayer', {
            days: 30, sort: 'percent', minPrice: 0, limit: 10,
        }));
        fireEvent.click(screen.getByRole('button', { name: 'By $' }));
        fireEvent.click(screen.getByRole('button', { name: '$10+' }));
        await waitFor(() => expect(trendingMovers).toHaveBeenLastCalledWith('tcgplayer', {
            days: 30, sort: 'amount', minPrice: 10, limit: 10,
        }));
    });

    test('filters come from the URL', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
            '/trends?days=30&sort=amount&min=50',
        );
        await screen.findByTestId('movers-list-gainer');
        expect(trendingMovers).toHaveBeenCalledWith('tcgplayer', {
            days: 30, sort: 'amount', minPrice: 50, limit: 10,
        });
        expect(screen.getByRole('button', { name: '$50+' })).toHaveAttribute('aria-pressed', 'true');
    });

    test('phone toggle switches between Rising and Falling', async () => {
        trendingMovers.mockResolvedValue([
            gainer,
            {
                ...gainer,
                direction: 'loser',
                price_kind: 'market',
                card_id: otherCard._uniqueId,
                name: 'Sink Below',
                percent_change: -0.5,
                amount_change: -2,
            },
        ]);
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText('Sink Below');
        expect(screen.getByRole('button', { name: 'Rising' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Falling' }));
        expect(screen.getByRole('button', { name: 'Falling' })).toHaveAttribute('aria-pressed', 'true');
        expect(within(screen.getByTestId('movers-list-loser')).getAllByText(/by Market/).length).toBeGreaterThan(0);
        expect(screen.getByText(/Falling uses the TCGplayer Market price/)).toBeInTheDocument();
    });

    test('movers sit in Rising and Falling lists with card art from the catalog', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText('Awakening');
        expect(screen.getByTestId('movers-list-gainer')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Awakening' })).toHaveAttribute(
            'src',
            'https://example.test/lightning.webp',
        );
        expect(screen.getAllByText('Rising').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Falling').length).toBeGreaterThan(0);
    });

    test('row opens details from the catalog snapshot and stays on /trends', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText('Awakening');
        fireEvent.click(screen.getByText('Awakening'));
        expect(mockOpenDetail).toHaveBeenCalledWith(expect.objectContaining({
            _uniqueId: pricedPrinting._uniqueId,
        }));
        expect(screen.getByTestId('trend-controls')).toBeInTheDocument();
    });

    test('empty and error states do not invent zeros and do not block search', async () => {
        trendingMovers.mockResolvedValueOnce([]);
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText(/No cards rose this week on TCGplayer/);
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();

        trendingMovers.mockRejectedValueOnce(new Error('offline'));
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText('Retry');
        fireEvent.change(screen.getAllByPlaceholderText('Search all cards…')[0], {
            target: { value: 'Awakening' },
        });
        expect(screen.getAllByText('Awakening').length).toBeGreaterThan(0);
    });

    test('wants route is unrelated and /sets is not rendered on Trends', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByTestId('movers-list-gainer');
        const main = screen.getByRole('main');
        expect(within(main).queryByText('Want List')).not.toBeInTheDocument();
        expect(within(main).queryByText('Browse Sets')).not.toBeInTheDocument();
    });

    test('search renders trend boxes, not a catalog list, including off-list matches', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByTestId('movers-list-gainer');
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Sink' },
        });
        expect(screen.getByTestId('search-trend-boxes')).toBeInTheDocument();
        expect(screen.getAllByTestId('mover-box').length).toBeGreaterThan(0);
        expect(screen.getByText('Sink Below')).toBeInTheDocument();
        expect(screen.getByTestId('trend-controls').closest('[data-movers-hidden]')).toBeTruthy();
        expect(screen.getByTestId('movers-list-gainer').closest('[data-movers-hidden]')).toBeTruthy();
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: '' },
        });
        expect(screen.queryByTestId('search-trend-boxes')).not.toBeInTheDocument();
        expect(screen.getByTestId('trend-controls').closest('[data-movers-hidden]')).toBeNull();
    });

    test('search overlay percent and under-floor change show on boxes', async () => {
        printingRecentChanges.mockImplementation(async (_source, ids) => {
            const rows = [];
            if (ids.includes(pricedPrinting._uniqueId)) {
                rows.push({
                    card_id: pricedPrinting._uniqueId,
                    start_on: '2026-08-22',
                    start_low: 4,
                    latest_low: 6,
                    percent_change: 0.5,
                    amount_change: 2,
                });
            }
            if (ids.includes(otherCard._uniqueId)) {
                rows.push({
                    card_id: otherCard._uniqueId,
                    start_on: '2026-08-22',
                    start_low: 0.3,
                    latest_low: 0.6,
                    percent_change: 1,
                    amount_change: 0.3,
                });
            }
            return rows;
        });
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByTestId('movers-list-gainer');
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Awakening' },
        });
        await waitFor(() => {
            expect(within(screen.getByTestId('search-trend-boxes')).getByText(/\+50%/)).toBeInTheDocument();
        });
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Sink' },
        });
        await waitFor(() => {
            expect(within(screen.getByTestId('search-trend-boxes')).getByText(/\+100%/)).toBeInTheDocument();
        });
    });

    test('signed-out search still uses boxes without a sign-in wall', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Awakening' },
        });
        expect(screen.getByTestId('search-trend-boxes')).toBeInTheDocument();
        expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    });

    test('clicking a search box opens catalog details and keeps the query', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Awakening' },
        });
        fireEvent.click(screen.getByText('Awakening'));
        expect(mockOpenDetail).toHaveBeenCalledWith(expect.objectContaining({
            _uniqueId: pricedPrinting._uniqueId,
        }));
        expect(screen.getByPlaceholderText('Search all cards…')).toHaveValue('Awakening');
        expect(screen.getByTestId('search-trend-boxes')).toBeInTheDocument();
    });

    test('no matches, omitted change, overlay error, and unpriced stay honest', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'zzzznope' },
        });
        expect(screen.getByText('No Printings match your search.')).toBeInTheDocument();
        expect(screen.queryByTestId('search-trend-boxes')).not.toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Awakening' },
        });
        await waitFor(() => {
            expect(printingRecentChanges).toHaveBeenCalled();
        });
        expect(screen.getByTestId('search-trend-boxes')).toBeInTheDocument();
        expect(screen.queryByText('+0%')).not.toBeInTheDocument();
        expect(screen.queryByText('No recent move')).not.toBeInTheDocument();
        expect(screen.queryByText('— · —')).not.toBeInTheDocument();

        printingRecentChanges.mockRejectedValue(new Error('offline'));
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Sink' },
        });
        await waitFor(() => {
            expect(screen.getByText('Retry')).toBeInTheDocument();
        });
        expect(screen.getByText('Sink Below')).toBeInTheDocument();
        expect(screen.getByTestId('search-trend-boxes')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Promo' },
        });
        expect(screen.getByText('New Promo')).toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    });
});

describe('SetList Browse Sets', () => {
    beforeEach(() => {
        mockUser = null;
        mockOpenDetail.mockClear();
        recentMovers.mockReset();
        trendingMovers.mockReset();
        printingRecentChanges.mockReset();
        trendingMovers.mockRejectedValue(new Error('Trends is down'));
        recentMovers.mockRejectedValue(new Error('Trends is down'));
        printingRecentChanges.mockRejectedValue(new Error('overlay down'));
    });

    test('empty search shows the set list and no movers', () => {
        wrap(
            <Routes>
                <Route path="/sets" element={<SetList />} />
            </Routes>,
            '/sets',
        );
        expect(screen.getByRole('heading', { name: 'Browse Sets' })).toBeInTheDocument();
        expect(screen.getByText('Welcome to Rathe')).toBeInTheDocument();
        expect(screen.queryByText('Catalog-wide recent movers')).not.toBeInTheDocument();
        expect(screen.queryByText('Your recent movers')).not.toBeInTheDocument();
        expect(recentMovers).not.toHaveBeenCalled();
        expect(trendingMovers).not.toHaveBeenCalled();
    });

    test('catalog Printing search covers the set list; clear returns sets', () => {
        wrap(
            <Routes>
                <Route path="/sets" element={<SetList />} />
            </Routes>,
            '/sets',
        );
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Awakening' },
        });
        expect(screen.queryByText('Welcome to Rathe')).not.toBeInTheDocument();
        expect(screen.getByText('Awakening')).toBeInTheDocument();
        expect(screen.queryByTestId('search-trend-boxes')).not.toBeInTheDocument();
        expect(screen.queryByTestId('mover-box')).not.toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: '' },
        });
        expect(screen.getByText('Welcome to Rathe')).toBeInTheDocument();
        expect(screen.queryByText('Catalog-wide recent movers')).not.toBeInTheDocument();
    });

    test('selecting a Printing result opens existing details and stays on /sets', () => {
        wrap(
            <Routes>
                <Route path="/sets" element={<SetList />} />
            </Routes>,
            '/sets',
        );
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Awakening' },
        });
        fireEvent.click(screen.getByText('Awakening'));
        expect(mockOpenDetail).toHaveBeenCalledWith(expect.objectContaining({
            _uniqueId: pricedPrinting._uniqueId,
        }));
        expect(screen.getByPlaceholderText('Search all cards…')).toBeInTheDocument();
    });

    test('signed-out search works; Trends failure does not blank Browse Sets', () => {
        wrap(
            <Routes>
                <Route path="/sets" element={<SetList />} />
            </Routes>,
            '/sets',
        );
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Sink' },
        });
        expect(screen.getByText('Sink Below')).toBeInTheDocument();
        expect(recentMovers).not.toHaveBeenCalled();
        expect(trendingMovers).not.toHaveBeenCalled();
        expect(printingRecentChanges).not.toHaveBeenCalled();
        expect(screen.queryByTestId('search-trend-boxes')).not.toBeInTheDocument();
        expect(screen.queryByTestId('mover-box')).not.toBeInTheDocument();
    });
});
