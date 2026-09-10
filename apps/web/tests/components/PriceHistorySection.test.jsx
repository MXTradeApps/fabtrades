import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PriceHistorySection from '../../src/components/cardDetail/PriceHistorySection.jsx';
import { PriceProvider } from '../../src/contexts/PriceContext.jsx';
import PriceContext from '../../src/contexts/PriceContext.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';

const entitlementState = { isPro: false };
const mockPriceHistory = jest.fn();

jest.mock('../../src/contexts/EntitlementContext.jsx', () => ({
    useEntitlement: () => ({ isPro: entitlementState.isPro, loading: false }),
}));

jest.mock('../../src/services/fabDb.js', () => ({
    priceHistory: (...args) => mockPriceHistory(...args),
}));

const today = new Date();
const isoDaysAgo = (n) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const row = (capturedOn, tcgLow, extra = {}) => ({
    card_id: extra.cardId || '123-Normal',
    captured_on: capturedOn,
    tcg_low: tcgLow,
    tcg_market: extra.tcg_market ?? null,
    cm_low: extra.cm_low ?? null,
    cm_trend: extra.cm_trend ?? null,
});

const chartable = ({ withOlder = false, cardId = '123-Normal' } = {}) => [
    ...(withOlder ? [row(isoDaysAgo(60), 1.0, { cardId })] : []),
    row(isoDaysAgo(20), 2.0, { cardId }),
    row(isoDaysAgo(5), 4.0, { cardId }),
];

const renderSection = async ({
    printingId = '123-Normal',
    priceSource = 'tcgplayer',
    settle = true,
} = {}) => {
    const utils = render(
        <ThemeProvider theme={createTheme()}>
            <ThemeModeProvider>
                <PriceContext.Provider value={{ priceSource, setPriceSource: jest.fn() }}>
                    <PriceHistorySection printingId={printingId} />
                </PriceContext.Provider>
            </ThemeModeProvider>
        </ThemeProvider>,
    );
    if (settle) {
        await waitFor(() => {
            expect(screen.queryByTestId('price-history-loading')).not.toBeInTheDocument();
        });
    }
    return utils;
};

describe('PriceHistorySection', () => {
    beforeEach(() => {
        entitlementState.isPro = false;
        mockPriceHistory.mockReset();
        mockPriceHistory.mockResolvedValue([]);
    });

    test('chartable state shows one Low line and a numeric change', async () => {
        mockPriceHistory.mockResolvedValue(chartable());
        await renderSection();
        expect(await screen.findByText('Low up $2.00')).toBeInTheDocument();
        expect(screen.getByTestId('price-history-chart')).toBeInTheDocument();
        expect(screen.getByText(/Observed catalog Low/)).toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
        expect(screen.queryByText('See full history with Pro')).not.toBeInTheDocument();
    });

    test('loading leaves the section placeholder, not a chart', async () => {
        let resolve;
        mockPriceHistory.mockReturnValue(new Promise((r) => { resolve = r; }));
        await renderSection({ settle: false });
        expect(screen.getByTestId('price-history-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('price-history-chart')).not.toBeInTheDocument();
        resolve(chartable());
        expect(await screen.findByTestId('price-history-chart')).toBeInTheDocument();
    });

    test('empty leaves copy, not a chart, and no span control', async () => {
        mockPriceHistory.mockResolvedValue([row(isoDaysAgo(5), 1.0)]);
        await renderSection();
        expect(await screen.findByText('History not available yet')).toBeInTheDocument();
        expect(screen.queryByTestId('price-history-chart')).not.toBeInTheDocument();
        expect(screen.queryByTestId('price-history-span-toggle')).not.toBeInTheDocument();
        expect(screen.queryByText('See full history with Pro')).not.toBeInTheDocument();
    });

    test('error + Retry refetch this Printing', async () => {
        mockPriceHistory
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce(chartable());
        await renderSection();
        expect(await screen.findByText("Couldn't load history")).toBeInTheDocument();
        expect(screen.queryByTestId('price-history-chart')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('price-history-retry'));
        expect(await screen.findByTestId('price-history-chart')).toBeInTheDocument();
        expect(mockPriceHistory).toHaveBeenCalledTimes(2);
        expect(mockPriceHistory.mock.calls[1][0]).toBe('123-Normal');
    });

    test('free + older snapshots never show an upgrade CTA or span control', async () => {
        mockPriceHistory.mockResolvedValue(chartable({ withOlder: true }));
        await renderSection();
        expect(await screen.findByText('Low up $2.00')).toBeInTheDocument();
        expect(screen.queryByText('See full history with Pro')).not.toBeInTheDocument();
        expect(screen.queryByTestId('price-history-span-toggle')).not.toBeInTheDocument();
        expect(screen.queryByText('All recorded')).not.toBeInTheDocument();
    });

    test('Pro + older snapshots show span control, default 30-day window', async () => {
        entitlementState.isPro = true;
        mockPriceHistory.mockResolvedValue(chartable({ withOlder: true }));
        await renderSection();
        expect(await screen.findByText('Low up $2.00')).toBeInTheDocument();
        expect(screen.queryByText('See full history with Pro')).not.toBeInTheDocument();
        expect(screen.getByTestId('price-history-span-toggle')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'All recorded' }));
        expect(await screen.findByText('Low up $3.00')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '30 days' }));
        expect(await screen.findByText('Low up $2.00')).toBeInTheDocument();
    });

    test('hover or tap a point shows that day’s date and Low, never $0.00', async () => {
        const earlier = isoDaysAgo(20);
        mockPriceHistory.mockResolvedValue(chartable());
        await renderSection();
        const point = await screen.findByTestId(`price-history-point-${earlier}`);
        fireEvent.mouseEnter(point);
        const readout = screen.getByTestId('price-history-inspect');
        expect(readout).toHaveTextContent('$2.00');
        expect(readout).not.toHaveTextContent('$0.00');
        fireEvent.click(await screen.findByTestId(`price-history-point-${isoDaysAgo(5)}`));
        expect(screen.getByTestId('price-history-inspect')).toHaveTextContent('$4.00');
    });

    test('CardMarket with only tcgLow is empty, not a silent TCG line', async () => {
        mockPriceHistory.mockResolvedValue(chartable());
        await renderSection({ priceSource: 'cardmarket' });
        expect(
            await screen.findByText("History isn't available for CardMarket yet"),
        ).toBeInTheDocument();
        expect(screen.queryByTestId('price-history-chart')).not.toBeInTheDocument();
        expect(screen.queryByText('Low up $2.00')).not.toBeInTheDocument();
    });

    test('changing Printing drops the previous line while the new series loads', async () => {
        mockPriceHistory.mockImplementation(async (id) => {
            if (id === '123-Rainbow Foil') {
                return [
                    row(isoDaysAgo(20), 8.0, { cardId: id }),
                    row(isoDaysAgo(5), 9.0, { cardId: id }),
                ];
            }
            return chartable();
        });
        const { rerender } = await renderSection();
        expect(await screen.findByText('Low up $2.00')).toBeInTheDocument();

        rerender(
            <ThemeProvider theme={createTheme()}>
                <ThemeModeProvider>
                    <PriceProvider>
                        <PriceHistorySection printingId="123-Rainbow Foil" />
                    </PriceProvider>
                </ThemeModeProvider>
            </ThemeProvider>,
        );
        await waitFor(() => {
            expect(screen.getByText('Low up $1.00')).toBeInTheDocument();
        });
        expect(screen.queryByText('Low up $2.00')).not.toBeInTheDocument();
    });

    test('a gap day is omitted, never shown as $0.00', async () => {
        mockPriceHistory.mockResolvedValue([
            row(isoDaysAgo(20), 2.0),
            row(isoDaysAgo(10), null, { tcg_market: 3.0 }),
            row(isoDaysAgo(5), 3.0),
        ]);
        await renderSection();
        expect(await screen.findByText('Low up $1.00')).toBeInTheDocument();
        expect(screen.getByTestId('price-history-chart')).toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
        expect(screen.queryByTestId(`price-history-point-${isoDaysAgo(10)}`)).not.toBeInTheDocument();
    });
});
