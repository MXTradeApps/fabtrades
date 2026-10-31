import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BinderCollection from '../../src/pages/BinderCollection.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';

const mockGetBinderEntries = jest.fn();
const mockGetBinders = jest.fn();
const mockUpsertEntries = jest.fn();
const mockEnsureCollectionBinder = jest.fn();

let mockUser = { id: 'user-1' };
let mockIsPro = true;

jest.mock('../../src/contexts/AuthContext.jsx', () => ({
    useAuth: () => ({ user: mockUser }),
}));

jest.mock('../../src/contexts/EntitlementContext.jsx', () => ({
    useEntitlement: () => ({ isPro: mockIsPro, loading: false }),
}));

jest.mock('../../src/hooks/useCardData.jsx', () => {
    const { pricedPrinting: priced, reprintSibling, foilSibling } = require('../fixtures/printings.js');
    const cards = [priced, reprintSibling, foilSibling];
    return {
        useCardData: () => ({
            cards,
            cardGroups: [],
            pricesUpdatedAt: '2026-08-14T12:00:00Z',
        }),
    };
});

jest.mock('../../src/contexts/CardDetailContext.jsx', () => ({
    useCardDetail: () => ({ openDetail: jest.fn() }),
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
        const live = (binders || []).filter((b) => !b.deletedAt && b.clientId !== 'system:want');
        const trade = live.find((b) => b.role === 'trade');
        const collection = live.find((b) => b.clientId === 'system:collection');
        const rest = live.filter((b) => b !== trade && b !== collection);
        return [...(trade ? [trade] : []), ...(collection ? [collection] : []), ...rest];
    },
    getBinderEntries: (...args) => mockGetBinderEntries(...args),
    getBinders: (...args) => mockGetBinders(...args),
    upsertEntries: (...args) => mockUpsertEntries(...args),
    ensureCollectionBinder: (...args) => mockEnsureCollectionBinder(...args),
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

jest.mock('../../src/components/search/index.js', () => ({
    SearchInput: () => <div data-testid="search-input" />,
    SearchDialog: () => null,
}));

jest.mock('../../src/components/auth/SignInDialog.jsx', () => ({
    __esModule: true,
    default: () => null,
}));

const binders = {
    data: {
        binders: [
            { clientId: 'system:trade', name: 'Trade Binder', role: 'trade', deletedAt: null },
        ],
    },
    error: null,
};

const row = (cardId, quantity) => ({
    cardId,
    binderId: 'system:trade',
    quantity,
    condition: 'NM',
    isWanted: false,
    card: {},
});

const renderBinder = (query = '') =>
    render(
        <ThemeProvider theme={createTheme()}>
            <ThemeModeProvider>
                <MemoryRouter initialEntries={[`/binder?b=system:trade${query}`]}>
                    <Routes>
                        <Route path="/binder" element={<BinderCollection isWanted={false} />} />
                    </Routes>
                </MemoryRouter>
            </ThemeModeProvider>
        </ThemeProvider>,
    );

describe('Binder filters', () => {
    beforeEach(() => {
        mockGetBinders.mockResolvedValue(binders);
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [row('123-Normal', 2), row('123-Rainbow Foil', 1), row('999-Normal', 1)],
                wants: [],
            },
            error: null,
        });
    });

    test('foiling and set filters narrow the list and show copies', async () => {
        renderBinder();
        fireEvent.click(await screen.findByTestId('binder-filter-foiling-nonfoil'));
        expect(screen.getByTestId('binder-filter-result-count')).toHaveTextContent('3 of 4 cards');
        expect(screen.queryByTestId('binder-entry-row-123-Rainbow Foil')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-filter-set-HP'));
        expect(screen.getByTestId('binder-entry-row-999-Normal')).toBeInTheDocument();
        expect(screen.queryByTestId('binder-entry-row-123-Normal')).not.toBeInTheDocument();
    });

    test('bulk selection only counts cards still shown after filtering', async () => {
        renderBinder();
        fireEvent.click(await screen.findByTestId('binder-select-123-Normal|system:trade|NM'));
        fireEvent.click(screen.getByTestId('binder-select-all'));
        expect(screen.getByTestId('binder-selection-bar')).toHaveTextContent('3 selected');

        fireEvent.click(screen.getByTestId('binder-filter-foiling-rainbow'));
        expect(screen.getByTestId('binder-selection-bar')).toHaveTextContent('1 selected');
    });

    test('opens filtered from the URL', async () => {
        renderBinder('&foil=rainbow');
        expect(await screen.findByTestId('binder-entry-row-123-Rainbow Foil')).toBeInTheDocument();
        expect(screen.queryByTestId('binder-entry-row-123-Normal')).not.toBeInTheDocument();
    });
});
