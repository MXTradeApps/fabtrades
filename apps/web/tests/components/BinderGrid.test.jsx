import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BinderCollection from '../../src/pages/BinderCollection.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { pricedPrinting, unpricedPrinting, otherCard } from '../fixtures/printings.js';
import Header from '../../src/components/elements/Header.jsx';

const mockGetBinderEntries = jest.fn();
const mockGetBinders = jest.fn();
const mockUpsertEntry = jest.fn();
const mockCreateBinder = jest.fn();
const mockRenameBinder = jest.fn();
const mockDeleteBinder = jest.fn();
const mockClearBinder = jest.fn();
const mockApplyBinderMove = jest.fn();

let mockUser = { id: 'user-1' };

jest.mock('../../src/contexts/AuthContext.jsx', () => ({
    useAuth: () => ({ user: mockUser }),
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
    upsertEntry: (...args) => mockUpsertEntry(...args),
    removeEntry: jest.fn(),
    ensureBinderShare: jest.fn(),
    regenerateBinderShare: jest.fn(),
    setBinderShareEnabled: jest.fn(),
    createBinder: (...args) => mockCreateBinder(...args),
    renameBinder: (...args) => mockRenameBinder(...args),
    deleteBinder: (...args) => mockDeleteBinder(...args),
    clearBinder: (...args) => mockClearBinder(...args),
    applyBinderMove: (...args) => mockApplyBinderMove(...args),
    upsertEntries: jest.fn(),
    ensureCollectionBinder: jest.fn(),
}));

jest.mock('../../src/components/search/index.js', () => ({
    SearchInput: () => <div data-testid="search-input" />,
    SearchDialog: ({ open, title }) => (
        open ? <div data-testid="add-card-dialog">{title}</div> : null
    ),
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
        mockDeleteBinder.mockResolvedValue({ data: { success: true }, error: null });
        mockClearBinder.mockResolvedValue({ data: { success: true }, error: null });
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
        expect(screen.getByTestId('binder-tile-system:want')).toBeInTheDocument();
        expect(screen.getByTestId('binder-tile-system:collection')).toBeInTheDocument();
        expect(screen.queryByTestId('binder-count-chip')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-tile-system:trade'));
        expect(await screen.findByTestId('collection-stats')).toBeInTheDocument();
        const back = screen.getByTestId('binder-back');
        const title = screen.getByTestId('binder-home-title');
        expect(back.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(mockGetBinderEntries).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('binder-grid')).not.toBeInTheDocument();
        expect(screen.getByTestId('binder-home-title')).toHaveTextContent('My Binders');
        expect(screen.getByTestId('binder-open-name')).toHaveTextContent('Trade Binder');

        fireEvent.click(screen.getByTestId('binder-back'));
        expect(await screen.findByTestId('binder-grid')).toBeInTheDocument();
        expect(mockGetBinderEntries).toHaveBeenCalledTimes(1);
    });

    test('opening a binder filters in memory and does not refetch', async () => {
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
                    {
                        cardId: unpricedPrinting._uniqueId,
                        quantity: 2,
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
        fireEvent.click(await screen.findByTestId('binder-tile-system:trade'));
        expect(await screen.findByTestId(`binder-entry-row-${pricedPrinting._uniqueId}`)).toBeInTheDocument();
        expect(screen.queryByTestId(`binder-entry-row-${unpricedPrinting._uniqueId}`)).not.toBeInTheDocument();
        expect(mockGetBinderEntries).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('binder-entry-list')).toBeInTheDocument();
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
        expect(screen.getAllByRole('link', { name: /My Binders/i })[0]).toHaveAttribute('href', '/binder');
    });

    test('My Binders heading and nav return to the grid from a drill-in', async () => {
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
        expect(await screen.findByTestId('binder-home-title')).toHaveTextContent('My Binders');
        fireEvent.click(await screen.findByTestId('binder-tile-system:trade'));
        expect(await screen.findByTestId('collection-stats')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-home-title'));
        expect(await screen.findByTestId('binder-grid')).toBeInTheDocument();

        fireEvent.click(await screen.findByTestId('binder-tile-system:trade'));
        expect(await screen.findByTestId('collection-stats')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('link', { name: /My Binders/i })[0]);
        expect(await screen.findByTestId('binder-grid')).toBeInTheDocument();
    });

    test('non-empty tile cover uses catalog art and falls back when the CDN 404s', async () => {
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
        const cover = await screen.findByTestId('binder-tile-cover-system:trade');
        expect(cover.tagName).toBe('IMG');
        expect(cover).toHaveAttribute(
            'src',
            'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/SUP001.webp',
        );
        fireEvent.error(cover);
        expect(cover).toHaveAttribute('src', pricedPrinting.imageUrlFallback);
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
        expect(await screen.findByText('Delete Collection?')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('binder-delete-cancel'));
        expect(screen.queryByText('Delete Collection?')).not.toBeInTheDocument();
        expect(mockDeleteBinder).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('binder-tile-menu-system:trade'));
        expect(screen.queryByTestId('binder-delete-system:trade')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('binder-tile-menu-system:want'));
        expect(screen.queryByTestId('binder-delete-system:want')).not.toBeInTheDocument();
        prompt.mockRestore();
    });

    test('confirming delete removes the binder and its cards from the collection', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 2,
                        isWanted: false,
                        binderId: 'system:collection',
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
        renderCollection(false);
        expect(await screen.findByTestId('binder-tile-count-system:collection')).toHaveTextContent('2');
        expect(screen.getByTestId('binder-tile-count-system:trade')).toHaveTextContent('1');

        fireEvent.click(screen.getByTestId('binder-tile-menu-system:collection'));
        fireEvent.click(screen.getByTestId('binder-delete-system:collection'));
        expect(await screen.findByText('Delete Collection?')).toBeInTheDocument();
        expect(screen.getByTestId('binder-delete-copy')).toHaveTextContent(
            'This will also remove 2 cards from your collection. This cannot be undone.',
        );

        fireEvent.click(screen.getByTestId('binder-delete-confirm'));
        await waitFor(() => expect(mockDeleteBinder).toHaveBeenCalledWith({
            clientId: 'system:collection',
        }));
        expect(screen.queryByTestId('binder-tile-system:collection')).not.toBeInTheDocument();
        expect(screen.getByTestId('binder-tile-system:trade')).toBeInTheDocument();
        expect(screen.getByTestId('binder-tile-count-system:trade')).toHaveTextContent('1');
    });

    test('5th Binder creates without a subscribe CTA', async () => {
        const four = [
            { clientId: 'system:trade', name: 'Trade Binder', role: 'trade', deletedAt: null },
            { clientId: 'system:collection', name: 'Collection', role: 'standard', deletedAt: null },
            { clientId: 'b3', name: 'Third', role: 'standard', deletedAt: null },
            { clientId: 'b4', name: 'Fourth', role: 'standard', deletedAt: null },
        ];
        mockGetBinders.mockResolvedValue({ data: { binders: four, all: four }, error: null });
        mockCreateBinder.mockResolvedValue({
            data: { clientId: 'b5', name: 'Fifth', role: 'standard', deletedAt: null },
            error: null,
        });
        const prompt = jest.spyOn(window, 'prompt').mockReturnValue('Fifth');
        renderCollection(false);
        expect(await screen.findByText('Fourth')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('binder-create'));
        await waitFor(() => expect(mockCreateBinder).toHaveBeenCalled());
        expect(screen.queryByText(/Subscribe in the FABTrades app/)).not.toBeInTheDocument();
        prompt.mockRestore();
    });

    test('grid shows Import from Fabrary next to New Binder, not Binder Settings', async () => {
        renderCollection(false);
        expect(await screen.findByTestId('import-fabrary')).toBeInTheDocument();
        expect(screen.getByTestId('binder-create')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('binder-tile-menu-system:collection'));
        expect(screen.queryByTestId('binder-tile-settings-system:collection')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('import-fabrary'));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.queryByTestId('binder-settings')).not.toBeInTheDocument();
    });

    test('/wants has no Binder Settings control', async () => {
        renderCollection(true, { path: '/wants' });
        await waitFor(() => screen.getByText('Want List'));
        expect(screen.queryByTestId('binder-settings')).not.toBeInTheDocument();
        expect(screen.queryByTestId('import-fabrary')).not.toBeInTheDocument();
    });

    test('search filters the open binder instead of adding from the catalog', async () => {
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
                    {
                        cardId: otherCard._uniqueId,
                        quantity: 1,
                        isWanted: false,
                        binderId: 'system:trade',
                        card: otherCard,
                    },
                ],
                wants: [],
            },
            error: null,
        });
        renderCollection(false);
        fireEvent.click(await screen.findByTestId('binder-tile-system:trade'));
        expect(await screen.findByTestId(`binder-entry-row-${pricedPrinting._uniqueId}`)).toBeInTheDocument();
        expect(screen.getByTestId(`binder-entry-row-${otherCard._uniqueId}`)).toBeInTheDocument();

        fireEvent.change(screen.getByTestId('collection-search').querySelector('input'), {
            target: { value: 'Lightning' },
        });
        expect(screen.getByTestId(`binder-entry-row-${pricedPrinting._uniqueId}`)).toBeInTheDocument();
        expect(screen.queryByTestId(`binder-entry-row-${otherCard._uniqueId}`)).not.toBeInTheDocument();
        expect(mockUpsertEntry).not.toHaveBeenCalled();
        expect(screen.queryByTestId('add-card-dialog')).not.toBeInTheDocument();
    });

    test('Add Card opens catalog search and default sort is price high to low', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: otherCard._uniqueId,
                        quantity: 1,
                        isWanted: false,
                        binderId: 'system:trade',
                        card: otherCard,
                    },
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
        fireEvent.click(await screen.findByTestId('binder-tile-system:trade'));
        expect(await screen.findByTestId('add-card')).toBeInTheDocument();
        expect(screen.getByLabelText('Sort binder')).toHaveTextContent('Price (high → low)');

        const rows = screen.getAllByTestId(/binder-entry-row-/);
        expect(rows[0]).toHaveAttribute('data-testid', `binder-entry-row-${pricedPrinting._uniqueId}`);
        expect(rows[1]).toHaveAttribute('data-testid', `binder-entry-row-${otherCard._uniqueId}`);

        fireEvent.click(screen.getByTestId('add-card'));
        expect(screen.getByTestId('add-card-dialog')).toHaveTextContent('Add to Binder');
    });

    test('open binder shows a compact paginated list, not a card grid', async () => {
        const binder = Array.from({ length: 60 }, (_, i) => {
            const n = String(i).padStart(3, '0');
            return {
                cardId: `c${n}-Normal`,
                quantity: 1,
                isWanted: false,
                binderId: 'system:trade',
                card: { name: `Card ${n}`, tcgMarket: 1 },
            };
        });
        mockGetBinderEntries.mockResolvedValue({
            data: { binder, wants: [] },
            error: null,
        });
        renderCollection(false);
        fireEvent.click(await screen.findByTestId('binder-tile-system:trade'));
        expect(await screen.findByTestId('binder-entry-list')).toBeInTheDocument();
        expect(screen.getByTestId('binder-entry-row-c000-Normal')).toBeInTheDocument();
        expect(screen.queryByTestId('binder-entry-row-c050-Normal')).not.toBeInTheDocument();
        expect(screen.getByTestId('binder-pagination')).toBeInTheDocument();
        expect(screen.getAllByTestId(/binder-entry-row-/)).toHaveLength(50);

        fireEvent.click(screen.getByRole('button', { name: /Go to next page/i }));
        expect(await screen.findByTestId('binder-entry-row-c050-Normal')).toBeInTheDocument();
        expect(screen.queryByTestId('binder-entry-row-c000-Normal')).not.toBeInTheDocument();
        expect(screen.getAllByTestId(/binder-entry-row-/)).toHaveLength(10);
    });

    test('Want List tile is undeletable and opens wants', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [],
                wants: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 2,
                        isWanted: true,
                        card: pricedPrinting,
                    },
                ],
            },
            error: null,
        });
        renderCollection(false);
        expect(await screen.findByTestId('binder-tile-name-system:want')).toHaveTextContent('Want List');
        await waitFor(() => {
            expect(screen.getByTestId('binder-tile-count-system:want')).toHaveTextContent('2');
        });
        expect(screen.queryByTestId('binder-count-chip')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-tile-menu-system:want'));
        expect(screen.queryByTestId('binder-delete-system:want')).not.toBeInTheDocument();
        expect(screen.getByTestId('binder-clear-system:want')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-tile-system:want'));
        expect(await screen.findByTestId(`binder-entry-row-${pricedPrinting._uniqueId}`)).toBeInTheDocument();
        expect(screen.getByTestId('binder-open-name')).toHaveTextContent('Want List');
        expect(screen.queryByTestId(`binder-move-${pricedPrinting._uniqueId}`)).not.toBeInTheDocument();
        expect(screen.queryByTestId('collection-stats')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('add-card'));
        expect(screen.getByTestId('add-card-dialog')).toHaveTextContent('Add to Want List');
    });

    test('Clear Binder asks to confirm then empties the open Binder', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [
                    {
                        cardId: pricedPrinting._uniqueId,
                        quantity: 3,
                        isWanted: false,
                        binderId: 'system:trade',
                        card: pricedPrinting,
                    },
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
        fireEvent.click(await screen.findByTestId('binder-tile-system:trade'));
        expect(await screen.findByTestId(`binder-entry-row-${pricedPrinting._uniqueId}`)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('binder-clear'));
        expect(await screen.findByText('Clear Trade Binder?')).toBeInTheDocument();
        expect(screen.getByTestId('binder-clear-copy')).toHaveTextContent(
            'This will remove 3 cards from Trade Binder. The binder stays. This cannot be undone.',
        );

        fireEvent.click(screen.getByTestId('binder-clear-cancel'));
        expect(screen.queryByText('Clear Trade Binder?')).not.toBeInTheDocument();
        expect(screen.getByTestId(`binder-entry-row-${pricedPrinting._uniqueId}`)).toBeInTheDocument();
        expect(mockClearBinder).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('binder-clear'));
        fireEvent.click(await screen.findByTestId('binder-clear-confirm'));
        await waitFor(() => expect(mockClearBinder).toHaveBeenCalledWith({
            clientId: 'system:trade',
            isWanted: false,
        }));
        expect(screen.queryByTestId(`binder-entry-row-${pricedPrinting._uniqueId}`)).not.toBeInTheDocument();
        expect(screen.getByTestId('binder-home-title')).toHaveTextContent('My Binders');
        expect(screen.getByTestId('binder-open-name')).toHaveTextContent('Trade Binder');
    });
});
