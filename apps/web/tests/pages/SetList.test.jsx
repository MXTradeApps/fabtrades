import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { PriceProvider } from '../../src/contexts/PriceContext.jsx';
import SetList from '../../src/pages/SetList.jsx';
import { pricedPrinting, otherCard } from '../fixtures/printings.js';

const mockOpenDetail = jest.fn();

jest.mock('../../src/components/auth/LoginButton.jsx', () => () => null);

jest.mock('../../src/contexts/CardDetailContext.jsx', () => ({
    useCardDetail: () => ({ openDetail: mockOpenDetail, closeDetail: jest.fn() }),
}));

const mockCatalog = [
    { ...pricedPrinting, name: 'Awakening', displayName: 'Awakening (HNT001)', _setName: 'The Hunted' },
    otherCard,
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
    recentMovers: jest.fn(() => {
        throw new Error('SetList must not call recentMovers');
    }),
    printingRecentChanges: jest.fn(() => {
        throw new Error('SetList must not call printingRecentChanges');
    }),
}));

const wrap = () => render(
    <ThemeProvider theme={createTheme()}>
        <ThemeModeProvider>
            <PriceProvider>
                <MemoryRouter initialEntries={['/sets']}>
                    <Routes>
                        <Route path="/sets" element={<SetList />} />
                    </Routes>
                </MemoryRouter>
            </PriceProvider>
        </ThemeModeProvider>
    </ThemeProvider>,
);

describe('SetList', () => {
    beforeEach(() => {
        mockOpenDetail.mockClear();
    });

    test('empty search shows the set list and no movers', () => {
        wrap();
        expect(screen.getByText('Browse Sets')).toBeInTheDocument();
        expect(screen.getByText('Welcome to Rathe')).toBeInTheDocument();
        expect(screen.queryByText('Catalog-wide recent movers')).not.toBeInTheDocument();
        expect(screen.queryByText('Recent movers')).not.toBeInTheDocument();
    });

    test('catalog Printing search covers the set list; clear returns the set list', () => {
        wrap();
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
    });

    test('selecting a Printing opens existing details', () => {
        wrap();
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Awakening' },
        });
        fireEvent.click(screen.getByText('Awakening'));
        expect(mockOpenDetail).toHaveBeenCalledWith(expect.objectContaining({
            _uniqueId: pricedPrinting._uniqueId,
        }));
    });

    test('signed-out search works without calling movers RPC', () => {
        wrap();
        fireEvent.change(screen.getByPlaceholderText('Search all cards…'), {
            target: { value: 'Sink' },
        });
        expect(screen.getByText('Sink Below')).toBeInTheDocument();
        expect(screen.queryByTestId('search-trend-boxes')).not.toBeInTheDocument();
        expect(screen.queryByTestId('mover-box')).not.toBeInTheDocument();
    });
});
