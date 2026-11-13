/**
 * The Trade History page: listing confirmed trades from either client,
 * searching, deleting, and loading one back into the calculator.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import TradeHistory from '../../src/pages/TradeHistory.jsx';
import { getUserTrades, deleteTrade } from '../../src/services/tradeHistory.js';

let mockUser = { id: 'user-1' };
const mockOpenDetail = jest.fn();
const mockLookup = { 'sink-normal': { _uniqueId: 'sink-normal', name: 'Sink Below (Red)' } };

jest.mock('../../src/contexts/AuthContext', () => ({
    useAuth: () => ({ user: mockUser }),
}));

jest.mock('../../src/services/tradeHistory', () => ({
    getUserTrades: jest.fn(),
    deleteTrade: jest.fn(),
}));

jest.mock('../../src/hooks/useCardData.jsx', () => ({
    useCardData: () => ({ pricesUpdatedAt: null, cardIdLookup: mockLookup }),
}));

jest.mock('../../src/contexts/CardDetailContext.jsx', () => ({
    useCardDetail: () => ({ openDetail: mockOpenDetail }),
}));

jest.mock('../../src/components/elements/Header.jsx', () => () => null);

jest.mock('../../src/components/auth/SignInDialog.jsx', () => ({
    __esModule: true,
    default: ({ open }) => (open ? <div data-testid="sign-in-dialog" /> : null),
}));

// Ages are measured from the start of each test, plus a small margin so a slow
// run cannot tip "2 hours ago" back to "1 hour ago".
let testStart = Date.now();
const ago = (ms) => new Date(testStart - ms - 20 * 1000).toISOString();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let webTrade;
let mobileTrade;

const buildTrades = () => {
    // Saved by the web calculator.
    webTrade = {
        id: 'web-1',
        name: 'Armory night',
        created_at: ago(2 * HOUR),
        diff: '-21.00',
        have_list: [{ name: 'Sink Below (Red)', subTypeName: 'Normal', uniqueId: 'sink-normal', price: 4.5, quantity: 2 }],
        want_list: [{ name: 'Enlightened Strike (Red)', subTypeName: 'Rainbow Foil', uniqueId: 'es-rf', price: 30, quantity: 1 }],
    };

    // Saved by the mobile app: unnamed, nested card objects, cash and notes.
    mobileTrade = {
        id: 'mob-1',
        name: null,
        created_at: ago(3 * DAY),
        diff: '12.50',
        currency_symbol: '€',
        have_cash: 10,
        want_cash: 0,
        notes: 'Met at the store',
        have_list: [{ quantity: 1, price_each: 2.5, card: { id: 'cnc-1', name: 'Command and Conquer', sub_type_name: 'Cold Foil' } }],
        want_list: [],
    };
};

// Landing page stand-in that shows what the calculator would receive.
const Calculator = () => {
    const location = useLocation();
    return <div data-testid="calculator">{JSON.stringify(location.state ?? null)}</div>;
};

const renderPage = () =>
    render(
        <ThemeModeProvider>
            <MemoryRouter initialEntries={['/history']}>
                <Routes>
                    <Route path="/history" element={<TradeHistory />} />
                    <Route path="/" element={<Calculator />} />
                </Routes>
            </MemoryRouter>
        </ThemeModeProvider>,
    );

const tradeRow = (title) => screen.getByRole('heading', { name: title }).closest('li');

beforeEach(() => {
    testStart = Date.now();
    buildTrades();
    mockUser = { id: 'user-1' };
    mockOpenDetail.mockReset();
    getUserTrades.mockReset();
    deleteTrade.mockReset();
    getUserTrades.mockResolvedValue({ data: [webTrade, mobileTrade], error: null });
    deleteTrade.mockResolvedValue({ error: null });
});

describe('TradeHistory — signed out', () => {
    beforeEach(() => {
        mockUser = null;
    });

    it('asks the visitor to sign in and loads nothing', () => {
        renderPage();
        expect(screen.getByText('Sign In Required')).toBeInTheDocument();
        expect(getUserTrades).not.toHaveBeenCalled();
    });

    it('opens the sign-in dialog from the page', () => {
        renderPage();
        expect(screen.queryByTestId('sign-in-dialog')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
        expect(screen.getByTestId('sign-in-dialog')).toBeInTheDocument();
    });

    it('offers a way back to the calculator', () => {
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: 'Back to Trading' }));
        expect(screen.getByTestId('calculator')).toBeInTheDocument();
    });
});

describe('TradeHistory — the list', () => {
    it('shows a spinner while trades load', async () => {
        let finish;
        getUserTrades.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
        renderPage();

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        finish({ data: [], error: null });
        expect(await screen.findByText('No saved trades yet')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('shows a web trade with both sides, line totals and who came out ahead', async () => {
        renderPage();
        const row = await waitFor(() => tradeRow('Armory night'));

        expect(within(row).getByText('2 hours ago')).toBeInTheDocument();
        expect(within(row).getByText('Diff: -$21.00')).toBeInTheDocument();
        expect(within(row).getByText('Gave')).toBeInTheDocument();
        expect(within(row).getByText('2× Sink Below (Red) (Normal)')).toBeInTheDocument();
        expect(within(row).getByText('$4.50 ea')).toBeInTheDocument();
        expect(within(row).getByText('$9.00')).toBeInTheDocument();
        expect(within(row).getByText('Got')).toBeInTheDocument();
        expect(within(row).getByText('1× Enlightened Strike (Red) (Rainbow Foil)')).toBeInTheDocument();
    });

    it('shows a trade saved by the mobile app: dated title, currency, cash and notes', async () => {
        renderPage();
        const title = `Trade on ${new Date(mobileTrade.created_at).toLocaleDateString()}`;
        const row = await waitFor(() => tradeRow(title));

        expect(within(row).getByText('3 days ago')).toBeInTheDocument();
        expect(within(row).getByText('Diff: +€12.50')).toBeInTheDocument();
        expect(within(row).getByText('1× Command and Conquer (Cold Foil)')).toBeInTheDocument();
        expect(within(row).getByText('€2.50 ea')).toBeInTheDocument();
        expect(within(row).getByText('Cash')).toBeInTheDocument();
        expect(within(row).getByText('€10.00')).toBeInTheDocument();
        expect(within(row).getByText('Met at the store')).toBeInTheDocument();
        // Nothing was received, so there is no empty "Got" column.
        expect(within(row).queryByText('Got')).not.toBeInTheDocument();
    });

    it.each([
        [10 * 1000, 'Just now'],
        [5 * 60 * 1000, '5 minutes ago'],
        [HOUR, '1 hour ago'],
        [DAY, 'Yesterday'],
        [8 * DAY, '1 week ago'],
        [15 * DAY, '2 weeks ago'],
    ])('describes a trade from %p ms ago as "%s"', async (age, label) => {
        getUserTrades.mockResolvedValue({ data: [{ ...webTrade, created_at: ago(age) }], error: null });
        renderPage();
        expect(await screen.findByText(label)).toBeInTheDocument();
    });

    it('falls back to the calendar date for trades older than a month', async () => {
        const created = ago(60 * DAY);
        getUserTrades.mockResolvedValue({ data: [{ ...webTrade, created_at: created }], error: null });
        renderPage();
        expect(await screen.findByText(new Date(created).toLocaleDateString())).toBeInTheDocument();
    });

    it('skips an unreadable line and still shows the rest of the trade', async () => {
        getUserTrades.mockResolvedValue({
            data: [{ ...webTrade, have_list: [null, { price: 3 }, ...webTrade.have_list], want_list: 'corrupt' }],
            error: null,
        });
        renderPage();
        const row = await waitFor(() => tradeRow('Armory night'));

        expect(within(row).getByText('2× Sink Below (Red) (Normal)')).toBeInTheDocument();
        expect(within(row).queryByText('Got')).not.toBeInTheDocument();
    });

    it('shows a zero difference without a sign', async () => {
        getUserTrades.mockResolvedValue({ data: [{ ...webTrade, diff: 0 }], error: null });
        renderPage();
        expect(await screen.findByText('Diff: $0.00')).toBeInTheDocument();
    });

    it('opens card details for a card still in the catalog, and not for one that left it', async () => {
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: 'View details for Sink Below (Red)' }));
        expect(mockOpenDetail).toHaveBeenCalledWith(mockLookup['sink-normal']);

        expect(screen.queryByRole('button', { name: 'View details for Enlightened Strike (Red)' })).not.toBeInTheDocument();
    });

    it('invites a first trade when history is empty', async () => {
        getUserTrades.mockResolvedValue({ data: [], error: null });
        renderPage();
        expect(await screen.findByText('No saved trades yet')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Start Trading' }));
        expect(screen.getByTestId('calculator')).toBeInTheDocument();
    });

    it('treats a missing result as an empty history', async () => {
        getUserTrades.mockResolvedValue({ data: null, error: null });
        renderPage();
        expect(await screen.findByText('No saved trades yet')).toBeInTheDocument();
    });

    it('shows the error and no empty state when loading fails', async () => {
        getUserTrades.mockResolvedValue({ data: null, error: { message: 'Could not reach the server' } });
        renderPage();
        expect(await screen.findByText('Could not reach the server')).toBeInTheDocument();
        expect(screen.queryByText('No saved trades yet')).not.toBeInTheDocument();
    });

    it('uses a plain message when the failure has none', async () => {
        getUserTrades.mockResolvedValue({ data: null, error: {} });
        renderPage();
        expect(await screen.findByText('Failed to load trade history')).toBeInTheDocument();
    });
});

describe('TradeHistory — search', () => {
    it('filters by name, ignoring case', async () => {
        renderPage();
        await screen.findByRole('heading', { name: 'Armory night' });

        fireEvent.change(screen.getByLabelText('Search trades'), { target: { value: 'ARMORY' } });

        expect(screen.getByRole('heading', { name: 'Armory night' })).toBeInTheDocument();
        expect(screen.queryByText('Met at the store')).not.toBeInTheDocument();
    });

    it('finds an unnamed mobile trade by its dated title', async () => {
        renderPage();
        await screen.findByRole('heading', { name: 'Armory night' });

        fireEvent.change(screen.getByLabelText('Search trades'), { target: { value: 'trade on' } });

        expect(screen.getByText('Met at the store')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Armory night' })).not.toBeInTheDocument();
    });

    it('says so when nothing matches', async () => {
        renderPage();
        await screen.findByRole('heading', { name: 'Armory night' });

        fireEvent.change(screen.getByLabelText('Search trades'), { target: { value: 'zzz' } });

        expect(screen.getByText('No trades found')).toBeInTheDocument();
    });
});

describe('TradeHistory — loading a trade into the calculator', () => {
    it('hands the whole saved trade to the calculator', async () => {
        renderPage();
        const row = await waitFor(() => tradeRow('Armory night'));
        fireEvent.click(within(row).getByRole('button', { name: 'Load this trade' }));

        const state = JSON.parse(screen.getByTestId('calculator').textContent);
        expect(state.loadTrade).toEqual(webTrade);
    });

    it('starts a blank trade from New trade', async () => {
        renderPage();
        await screen.findByRole('heading', { name: 'Armory night' });
        fireEvent.click(screen.getByRole('button', { name: 'New trade' }));

        expect(JSON.parse(screen.getByTestId('calculator').textContent)).toBeNull();
    });
});

describe('TradeHistory — deleting', () => {
    const askToDelete = async (title) => {
        const row = await waitFor(() => tradeRow(title));
        fireEvent.click(within(row).getByRole('button', { name: 'Delete this trade' }));
        return screen.getByRole('dialog');
    };

    it('asks first, naming the trade', async () => {
        renderPage();
        const dialog = await askToDelete('Armory night');

        expect(within(dialog).getByText(/"Armory night" will be permanently removed/)).toBeInTheDocument();
        expect(deleteTrade).not.toHaveBeenCalled();
    });

    it('names an unnamed mobile trade by its date', async () => {
        renderPage();
        const title = `Trade on ${new Date(mobileTrade.created_at).toLocaleDateString()}`;
        const dialog = await askToDelete(title);

        expect(within(dialog).getByText(new RegExp(`"${title}" will be permanently removed`))).toBeInTheDocument();
    });

    it('removes the trade from the list once deleted', async () => {
        renderPage();
        const dialog = await askToDelete('Armory night');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Armory night' })).not.toBeInTheDocument());
        expect(deleteTrade).toHaveBeenCalledWith('web-1');
        expect(screen.getByText('Met at the store')).toBeInTheDocument();
    });

    it('keeps the trade when cancelled', async () => {
        renderPage();
        const dialog = await askToDelete('Armory night');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

        expect(deleteTrade).not.toHaveBeenCalled();
        // The page is hidden from assistive tech while the dialog closes, so query by text.
        expect(screen.getByText('Armory night')).toBeInTheDocument();
    });

    it('keeps the trade and shows the error when deleting fails', async () => {
        deleteTrade.mockResolvedValue({ error: { message: 'Not allowed' } });
        renderPage();
        const dialog = await askToDelete('Armory night');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Not allowed')).toBeInTheDocument();
        expect(screen.getByText('Armory night')).toBeInTheDocument();
    });

    it('uses a plain message when the delete failure has none', async () => {
        deleteTrade.mockResolvedValue({ error: {} });
        renderPage();
        const dialog = await askToDelete('Armory night');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Failed to delete trade')).toBeInTheDocument();
    });
});
