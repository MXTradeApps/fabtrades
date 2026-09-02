import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { PriceProvider } from '../../src/contexts/PriceContext.jsx';
import Trends from '../../src/pages/Trends.jsx';
import SetList from '../../src/pages/SetList.jsx';
import Header from '../../src/components/elements/Header.jsx';
import { recentMovers, printingRecentChanges } from '../../src/services/fabDb.js';
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
        printingRecentChanges.mockReset();
        getBinderEntries.mockReset();
        recentMovers.mockResolvedValue([gainer]);
        printingRecentChanges.mockResolvedValue([]);
        getBinderEntries.mockResolvedValue({ data: { binder: [] }, error: null });
    });

    test('hamburger has Trends and Browse Sets, not Home', () => {
        wrap(<Header />, '/');
        fireEvent.click(screen.getByLabelText('open drawer'));
        expect(screen.getAllByText('Trends').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Browse Sets').length).toBeGreaterThan(0);
        expect(screen.queryByText('Home')).not.toBeInTheDocument();
        expect(screen.getAllByText('Trade Calculator').length).toBeGreaterThan(0);
    });

    test('/trends lands on recent movers with no set list', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        expect(screen.getByText('Trends')).toBeInTheDocument();
        await screen.findByText('Catalog-wide recent movers');
        expect(await screen.findByText('Awakening')).toBeInTheDocument();
        expect(screen.getByText(/The Hunted/)).toBeInTheDocument();
        expect(screen.queryByText('Welcome to Rathe')).not.toBeInTheDocument();
        expect(screen.queryByText('Your recent movers')).not.toBeInTheDocument();
        expect(screen.getByText(/Observed catalog Lows/)).toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    });

    test('catalog Printing search covers movers; clear returns movers', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText('Catalog-wide recent movers');
        expect(await screen.findByRole('img', { name: 'Awakening' })).toBeInTheDocument();
        expect(recentMovers).toHaveBeenCalledTimes(1);
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Awakening' },
        });
        expect(screen.getByText('Catalog-wide recent movers').closest('[data-movers-hidden]')).toBeTruthy();
        expect(screen.getAllByText('Awakening').length).toBeGreaterThan(0);
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: '' },
        });
        expect(screen.getByText('Catalog-wide recent movers').closest('[data-movers-hidden]')).toBeNull();
        expect(screen.queryByText('Welcome to Rathe')).not.toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Awakening' })).toBeInTheDocument();
        expect(recentMovers).toHaveBeenCalledTimes(1);
    });

    test('signed-out has catalog-wide and no owned section', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText('Catalog-wide recent movers');
        expect(getBinderEntries).not.toHaveBeenCalled();
        expect(screen.queryByText('Your recent movers')).not.toBeInTheDocument();
    });

    test('signed-in Binder entries stay catalog-wide only', async () => {
        mockUser = { id: 'user-1' };
        getBinderEntries.mockResolvedValue({
            data: {
                binder: [{ cardId: pricedPrinting._uniqueId, isWanted: false, quantity: 1 }],
            },
            error: null,
        });
        recentMovers.mockImplementation(async (source, ids) => {
            if (ids) return [gainer];
            return [{ ...gainer, card_id: otherCard._uniqueId, name: 'Sink Below' }];
        });
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText('Catalog-wide recent movers');
        expect(screen.queryByText('Your recent movers')).not.toBeInTheDocument();
        expect(await screen.findByText('Sink Below')).toBeInTheDocument();
        expect(getBinderEntries).not.toHaveBeenCalled();
        expect(recentMovers).toHaveBeenCalledWith('tcgplayer');
    });

    test('movers sit in a desktop grid with card art from the catalog', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText('Awakening');
        expect(screen.getByTestId('movers-grid-gainer')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Awakening' })).toHaveAttribute(
            'src',
            'https://example.test/lightning.webp',
        );
        expect(screen.getByText('Gainers')).toBeInTheDocument();
        expect(screen.getByText(/Biggest recent Low increases/)).toBeInTheDocument();
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
        expect(screen.getByText('Catalog-wide recent movers')).toBeInTheDocument();
    });

    test('empty and error states do not invent zeros and do not block search', async () => {
        recentMovers.mockResolvedValueOnce([]);
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText(/No recent gainers on TCGplayer/);
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();

        recentMovers.mockRejectedValueOnce(new Error('offline'));
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
        await screen.findByText('Catalog-wide recent movers');
        expect(screen.queryByText('Want List')).not.toBeInTheDocument();
        expect(screen.queryByText('Browse Sets')).not.toBeInTheDocument();
    });

    test('search renders trend boxes, not a catalog list, including off-list matches', async () => {
        wrap(
            <Routes>
                <Route path="/trends" element={<Trends />} />
            </Routes>,
        );
        await screen.findByText('Catalog-wide recent movers');
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Sink' },
        });
        expect(screen.getByTestId('search-trend-boxes')).toBeInTheDocument();
        expect(screen.getAllByTestId('mover-box').length).toBeGreaterThan(0);
        expect(screen.getByText('Sink Below')).toBeInTheDocument();
        expect(screen.getByText('Catalog-wide recent movers').closest('[data-movers-hidden]')).toBeTruthy();
        expect(screen.queryByText('Gainers')).toBeTruthy();
        expect(screen.getByText('Gainers').closest('[data-movers-hidden]')).toBeTruthy();
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: '' },
        });
        expect(screen.queryByTestId('search-trend-boxes')).not.toBeInTheDocument();
        expect(screen.getByText('Catalog-wide recent movers').closest('[data-movers-hidden]')).toBeNull();
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
        await screen.findByText('Catalog-wide recent movers');
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
        printingRecentChanges.mockReset();
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
        expect(screen.getByText('Browse Sets')).toBeInTheDocument();
        expect(screen.getByText('Welcome to Rathe')).toBeInTheDocument();
        expect(screen.queryByText('Catalog-wide recent movers')).not.toBeInTheDocument();
        expect(screen.queryByText('Your recent movers')).not.toBeInTheDocument();
        expect(recentMovers).not.toHaveBeenCalled();
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
        expect(printingRecentChanges).not.toHaveBeenCalled();
        expect(screen.queryByTestId('search-trend-boxes')).not.toBeInTheDocument();
        expect(screen.queryByTestId('mover-box')).not.toBeInTheDocument();
    });
});
