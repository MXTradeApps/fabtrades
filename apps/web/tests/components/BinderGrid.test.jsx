import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BinderCollection from '../../src/pages/BinderCollection.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { pricedPrinting, unpricedPrinting } from '../fixtures/printings.js';
import Header from '../../src/components/elements/Header.jsx';

const mockGetBinderEntries = jest.fn();
const mockGetBinders = jest.fn();
const mockUpsertEntry = jest.fn();
const mockCreateBinder = jest.fn();
const mockRenameBinder = jest.fn();
const mockDeleteBinder = jest.fn();
const mockApplyBinderMove = jest.fn();

let mockUser = { id: 'user-1' };

jest.mock('../../src/contexts/AuthContext.jsx', () => ({
    useAuth: () => ({ user: mockUser }),
}));

jest.mock('../../src/contexts/EntitlementContext.jsx', () => ({
    useEntitlement: () => ({ isPro: false, loading: false }),
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
    TRADE_BINDER_ID: 'system:trade',
    COLLECTION_BINDER_ID: 'system:collection',
    gridOrderBinders: (binders) => {
        const live = (binders || []).filter((b) => !b.deletedAt);
        const trade = live.find((b) => b.role === 'trade');
        const collection = live.find((b) => b.clientId === 'system:collection');
        const rest = live.filter((b) => b !== trade && b !== collection);
        return [...(trade ? [trade] : []), ...(collection ? [collection] : []), ...rest];
    },
    getBinderEntries: (...args) => mockGetBinderEntries(...args),
    getBinders: (...args) => mockGetBinders(...args),
    upsertEntry: (...args) => mockUpsertEntry(...args),
    removeEntry: jest.fn(),
    ensureBinderShare: jest.fn(),
    regenerateBinderShare: jest.fn(),
    setBinderShareEnabled: jest.fn(),
    createBinder: (...args) => mockCreateBinder(...args),
    renameBinder: (...args) => mockRenameBinder(...args),
    deleteBinder: (...args) => mockDeleteBinder(...args),
    applyBinderMove: (...args) => mockApplyBinderMove(...args),
}));

jest.mock('../../src/components/search/index.js', () => ({
    SearchInput: () => <div data-testid="search-input" />,
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
        all: [
            { clientId: 'system:trade', name: 'Trade Binder', role: 'trade', deletedAt: null },
            { clientId: 'system:collection', name: 'Collection', role: 'standard', deletedAt: null },
        ],
    },
    error: null,
};

const renderCollection = (isWanted = false, { path = '/binder' } = {}) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <ThemeProvider theme={createTheme()}>
                <ThemeModeProvider>
                    <BinderCollection isWanted={isWanted} />
                </ThemeModeProvider>
            </ThemeProvider>
        </MemoryRouter>,
    );

describe('BinderGrid', () => {
    beforeEach(() => {
        mockUser = { id: 'user-1' };
        mockGetBinders.mockResolvedValue(defaultBinders);
        mockGetBinderEntries.mockResolvedValue({
            data: { binder: [], wants: [] },
            error: null,
        });
        mockCreateBinder.mockResolvedValue({
            data: { clientId: 'side', name: 'Side Event', role: 'standard', deletedAt: null },
            error: null,
        });
        mockRenameBinder.mockResolvedValue({ data: {}, error: { reason: 'duplicate' } });
        mockDeleteBinder.mockResolvedValue({ data: null, error: { reason: 'not-empty' } });
        mockApplyBinderMove.mockResolvedValue({ data: {}, error: null });
    });

    test('signed-in /binder shows two tiles and drill-in/back', async () => {
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
        renderCollection(false);
        expect(await screen.findByTestId('binder-grid')).toBeInTheDocument();
        expect(await screen.findByTestId('binder-tile-system:trade')).toBeInTheDocument();
        expect(screen.getByTestId('binder-tile-system:collection')).toBeInTheDocument();
        expect(screen.queryByTestId('binder-tile-want')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-tile-system:trade'));
        expect(await screen.findByTestId('binder-value-total')).toBeInTheDocument();
        expect(screen.queryByTestId('binder-grid')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-back'));
        expect(await screen.findByTestId('binder-grid')).toBeInTheDocument();
    });

    test('/wants is the Want List, not a Binder grid', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [],
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
        renderCollection(true, { path: '/wants' });
        await waitFor(() => screen.getByText('Want List'));
        expect(screen.queryByTestId('binder-grid')).not.toBeInTheDocument();
        expect(screen.queryByTestId('binder-move-' + pricedPrinting._uniqueId)).not.toBeInTheDocument();
    });

    test('does not render a local grid when signed out', async () => {
        mockUser = null;
        renderCollection(false);
        expect(await screen.findByText('Sign In Required')).toBeInTheDocument();
        expect(screen.queryByTestId('binder-grid')).not.toBeInTheDocument();
    });

    test('Header still links Want List in one step', () => {
        render(
            <MemoryRouter>
                <ThemeProvider theme={createTheme()}>
                    <ThemeModeProvider>
                        <Header />
                    </ThemeModeProvider>
                </ThemeProvider>
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByLabelText('open drawer'));
        expect(screen.getByRole('link', { name: /Want List/i })).toHaveAttribute('href', '/wants');
        expect(screen.getAllByRole('link', { name: /My Binder/i })[0]).toHaveAttribute('href', '/binder');
    });

    test('empty tiles show 0 and true-zero value; unpriced non-empty is a dash', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: unpricedPrinting._uniqueId,
                        quantity: 1,
                        isWanted: false,
                        binderId: 'system:collection',
                        card: unpricedPrinting,
                    },
                ],
                wants: [],
            },
            error: null,
        });
        renderCollection(false);
        expect(await screen.findByTestId('binder-tile-count-system:trade')).toHaveTextContent('0');
        expect(screen.getByTestId('binder-tile-value-system:trade')).toHaveTextContent('$0.00');
        expect(screen.queryByTestId('binder-tile-cover-system:trade')).not.toBeInTheDocument();
        expect(screen.getByTestId('binder-tile-count-system:collection')).toHaveTextContent('1');
        expect(screen.getByTestId('binder-tile-value-system:collection')).toHaveTextContent('—');
        expect(screen.getByTestId('binder-tile-cover-system:collection')).toBeInTheDocument();
    });

    test('moves copies from Trade Binder to Collection', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 3,
                        isWanted: false,
                        binderId: 'system:trade',
                        condition: 'NM',
                        card: pricedPrinting,
                    },
                ],
                wants: [],
            },
            error: null,
        });
        const prompt = jest.spyOn(window, 'prompt');
        prompt.mockReturnValueOnce('Collection').mockReturnValueOnce('2');
        renderCollection(false);
        fireEvent.click(await screen.findByTestId('binder-tile-system:trade'));
        fireEvent.click(await screen.findByTestId(`binder-move-${pricedPrinting._uniqueId}`));
        expect(mockApplyBinderMove).toHaveBeenCalledWith(expect.objectContaining({
            fromBinderId: 'system:trade',
            toBinderId: 'system:collection',
            quantity: 2,
            printingId: pricedPrinting._uniqueId,
        }));
        prompt.mockRestore();
    });

    test('create, rename collision, and Trade Binder delete is hidden', async () => {
        const prompt = jest.spyOn(window, 'prompt').mockReturnValue('Side Event');
        renderCollection(false);
        fireEvent.click(await screen.findByTestId('binder-create'));
        await waitFor(() => expect(mockCreateBinder).toHaveBeenCalled());
        expect(await screen.findByText('Side Event')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-tile-menu-system:collection'));
        fireEvent.click(screen.getByText('Rename'));
        expect(await screen.findByText('A Binder with that name already exists')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-tile-menu-system:collection'));
        fireEvent.click(screen.getByTestId('binder-delete-system:collection'));
        expect(await screen.findByText('Move or remove cards before deleting this Binder')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-tile-menu-system:trade'));
        expect(screen.queryByTestId('binder-delete-system:trade')).not.toBeInTheDocument();
        prompt.mockRestore();
    });

    test('5th Binder on free shows subscribe CTA and does not create', async () => {
        const four = [
            { clientId: 'system:trade', name: 'Trade Binder', role: 'trade', deletedAt: null },
            { clientId: 'system:collection', name: 'Collection', role: 'standard', deletedAt: null },
            { clientId: 'b3', name: 'Third', role: 'standard', deletedAt: null },
            { clientId: 'b4', name: 'Fourth', role: 'standard', deletedAt: null },
        ];
        mockGetBinders.mockResolvedValue({ data: { binders: four, all: four }, error: null });
        renderCollection(false);
        expect(await screen.findByText('Fourth')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('binder-create'));
        expect(await screen.findByText(/Subscribe in the FABTrades app/)).toBeInTheDocument();
        expect(mockCreateBinder).not.toHaveBeenCalled();
    });
});
