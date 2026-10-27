import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BinderCollection from '../../src/pages/BinderCollection.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import Header from '../../src/components/elements/Header.jsx';
import { pricedPrinting, reprintSibling } from '../fixtures/printings.js';

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

const defaultBinders = {
    data: {
        binders: [
            { clientId: 'system:trade', name: 'Trade Binder', role: 'trade', deletedAt: null },
            { clientId: 'system:collection', name: 'Collection', role: 'standard', deletedAt: null },
        ],
    },
    error: null,
};

const emptyEntries = {
    data: { binder: [], wants: [], all: [] },
    error: null,
};

const fabraryHeaders = 'Identifier,Name,Pitch,Set,Set number,Edition,Foiling,Treatment,Have,Want in trade,Want to buy,Extra for trade,Extra to sell';
const fabraryCsv = `${fabraryHeaders}\n1,Lightning Press,,Super Slam,SUP001,,,,2,9,,8,\n2,Unknown Junk,,Nowhere,ZZZ999,,,,1,,,,\n`;
// Row 1 is exact by code; row 2 has printings $7.50 apart (review); row 3 is unknown.
const genericCsv = 'Name,Set,Foiling,Quantity\nLightning Press SUP001,,,2\nLightning Press,,,3\nUnknown Junk,,,1\n';

function makeFile(text, name = 'export.csv', delayMs = 0) {
    const file = new File([text], name, { type: 'text/csv' });
    file.text = () => new Promise((resolve) => {
        setTimeout(() => resolve(text), delayMs);
    });
    return file;
}

const renderImport = (path = '/binder') =>
    render(
        <ThemeProvider theme={createTheme()}>
            <ThemeModeProvider>
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route path="/binder" element={<BinderCollection isWanted={false} />} />
                        <Route path="/wants" element={<BinderCollection isWanted />} />
                        <Route path="/binder/import" element={<Navigate to="/binder" replace />} />
                    </Routes>
                </MemoryRouter>
            </ThemeModeProvider>
        </ThemeProvider>,
    );

async function openImportDialog(binderId = 'system:collection') {
    // Already inside the Binder after an earlier import → skip the grid.
    if (!screen.queryByTestId('binder-open-menu')) {
        fireEvent.click(await screen.findByTestId(`binder-tile-${binderId}`));
    }
    fireEvent.click(await screen.findByTestId('binder-open-menu'));
    fireEvent.click(await screen.findByTestId('binder-import'));
    return screen.findByRole('dialog');
}

async function pick(dialog, text, delayMs = 0) {
    fireEvent.change(within(dialog).getByTestId('import-file'), {
        target: { files: [makeFile(text, 'cards.csv', delayMs)] },
    });
    return screen.findByTestId('import-preview');
}

describe('Binder CSV import', () => {
    beforeEach(() => {
        mockUser = { id: 'user-1' };
        mockIsPro = true;
        mockGetBinders.mockResolvedValue(defaultBinders);
        mockGetBinderEntries.mockResolvedValue(emptyEntries);
        mockUpsertEntries.mockResolvedValue({ data: { rows: [] }, error: null });
    });

    test('import lives in the open Binder ⋯ menu, not on the My Binders page', async () => {
        renderImport('/binder');
        expect(await screen.findByTestId('binder-create')).toBeInTheDocument();
        expect(screen.queryByTestId('binder-open-menu')).not.toBeInTheDocument();
        fireEvent.click(await screen.findByTestId('binder-tile-menu-system:collection'));
        expect(screen.queryByText('Import cards')).not.toBeInTheDocument();
        fireEvent.keyDown(document.activeElement, { key: 'Escape' });
        fireEvent.click(await screen.findByTestId('binder-tile-system:collection'));
        fireEvent.click(await screen.findByTestId('binder-open-menu'));
        expect(await screen.findByTestId('binder-import')).toHaveTextContent('Import cards');
    });

    test('Want List has no ⋯ import menu', async () => {
        renderImport('/binder');
        fireEvent.click(await screen.findByTestId('binder-tile-system:want'));
        await waitFor(() => screen.getByRole('heading', { name: 'Want List' }));
        expect(screen.queryByTestId('binder-open-menu')).not.toBeInTheDocument();
    });

    test('/wants and the Header have no import', async () => {
        render(
            <ThemeProvider theme={createTheme()}>
                <ThemeModeProvider>
                    <MemoryRouter initialEntries={['/wants']}>
                        <Routes>
                            <Route path="/wants" element={<BinderCollection isWanted />} />
                        </Routes>
                    </MemoryRouter>
                </ThemeModeProvider>
            </ThemeProvider>,
        );
        await waitFor(() => screen.getByRole('heading', { name: 'Want List' }));
        expect(screen.queryByText('Import cards')).not.toBeInTheDocument();

        render(
            <MemoryRouter>
                <ThemeProvider theme={createTheme()}>
                    <ThemeModeProvider>
                        <Header />
                    </ThemeModeProvider>
                </ThemeProvider>
            </MemoryRouter>,
        );
        expect(screen.queryByText('Import cards')).not.toBeInTheDocument();
    });

    test('signed-out /binder/import uses the Binder sign-in gate', async () => {
        mockUser = null;
        renderImport('/binder/import');
        expect(await screen.findByText('Sign In Required')).toBeInTheDocument();
        expect(screen.queryByTestId('import-file')).not.toBeInTheDocument();
    });

    test('the modal names the Binder it imports into', async () => {
        renderImport();
        const dialog = await openImportDialog('system:trade');
        expect(within(dialog).getByText('into Trade Binder')).toBeInTheDocument();
        expect(within(dialog).getByTestId('import-choose')).toBeInTheDocument();
    });

    test('preview splits matched, review, and unmatched rows; cancel writes nothing', async () => {
        renderImport();
        const dialog = await openImportDialog();
        fireEvent.change(within(dialog).getByTestId('import-file'), {
            target: { files: [makeFile(genericCsv, 'cards.csv', 30)] },
        });
        expect(await screen.findByTestId('import-working')).toBeInTheDocument();
        await screen.findByTestId('import-preview');
        expect(screen.getByText('Rows read: 3')).toBeInTheDocument();
        expect(screen.getByText('Matched automatically: 1')).toBeInTheDocument();
        expect(screen.getByText('Needs review: 1')).toBeInTheDocument();
        expect(screen.getByText("Couldn't match: 1")).toBeInTheDocument();
        expect(screen.getByText('Copies to add: 2')).toBeInTheDocument();
        expect(within(screen.getByTestId('import-unmatched')).getByText('Unknown Junk')).toBeInTheDocument();
        expect(screen.getByTestId('import-review-row')).toHaveTextContent('3 × Lightning Press');
        expect(screen.getByTestId(`import-candidate-${pricedPrinting._uniqueId}`)).toBeInTheDocument();
        expect(screen.getByTestId(`import-candidate-${reprintSibling._uniqueId}`)).toBeInTheDocument();
        expect(screen.getByTestId('import-unreviewed')).toHaveTextContent('1 unreviewed row will be skipped');

        fireEvent.click(screen.getByTestId('import-cancel'));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(mockUpsertEntries).not.toHaveBeenCalled();
    });

    test('a review pick is added; unreviewed rows are skipped', async () => {
        renderImport();
        let dialog = await openImportDialog();
        await pick(dialog, genericCsv);
        fireEvent.click(screen.getByTestId(`import-candidate-${reprintSibling._uniqueId}`));
        expect(screen.getByTestId('import-review-progress')).toHaveTextContent('1 of 1 reviewed');
        expect(screen.getByText('Copies to add: 5')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('import-confirm'));
        await waitFor(() => expect(mockUpsertEntries).toHaveBeenCalledTimes(1));
        expect(mockUpsertEntries.mock.calls[0][0]).toEqual([
            expect.objectContaining({ cardId: pricedPrinting._uniqueId, quantity: 2, binderId: 'system:collection', isWanted: false }),
            expect.objectContaining({ cardId: reprintSibling._uniqueId, quantity: 3, binderId: 'system:collection', isWanted: false }),
        ]);
        expect(await screen.findByTestId('import-success')).toHaveTextContent('Added 5 Near Mint copies to Collection');
        expect(screen.getByTestId('import-confirm')).toBeDisabled();

        fireEvent.click(screen.getByTestId('import-cancel'));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        dialog = await openImportDialog();
        await pick(dialog, genericCsv);
        fireEvent.click(screen.getByTestId('import-review-skip'));
        fireEvent.click(screen.getByTestId('import-confirm'));
        await waitFor(() => expect(mockUpsertEntries).toHaveBeenCalledTimes(2));
        expect(mockUpsertEntries.mock.calls[1][0]).toEqual([
            expect.objectContaining({ cardId: pricedPrinting._uniqueId, quantity: 2 }),
        ]);
    });

    test('imports into the Binder whose menu opened it, adding onto existing NM copies', async () => {
        mockGetBinders.mockResolvedValue({
            data: {
                binders: [
                    ...defaultBinders.data.binders,
                    { clientId: 'custom-1', name: 'Blitz Deck', role: 'standard', deletedAt: null },
                ],
            },
            error: null,
        });
        const existing = [{ cardId: pricedPrinting._uniqueId, quantity: 4, isWanted: false, binderId: 'custom-1', condition: 'NM' }];
        mockGetBinderEntries.mockResolvedValue({ data: { binder: existing, wants: [], all: existing }, error: null });
        renderImport();
        const dialog = await openImportDialog('custom-1');
        await pick(dialog, 'Name,Quantity\nLightning Press SUP001,2\n');
        fireEvent.click(screen.getByTestId('import-confirm'));
        await waitFor(() => expect(mockUpsertEntries).toHaveBeenCalledTimes(1));
        expect(mockUpsertEntries.mock.calls[0][0]).toEqual([
            expect.objectContaining({ cardId: pricedPrinting._uniqueId, quantity: 6, binderId: 'custom-1' }),
        ]);
    });

    test('a Fabrary export imports only Have, into this Binder', async () => {
        renderImport();
        const dialog = await openImportDialog('system:trade');
        await pick(dialog, fabraryCsv);
        expect(screen.getByText('Rows read: 2')).toBeInTheDocument();
        expect(screen.getByText('Copies to add: 2')).toBeInTheDocument();
        expect(screen.queryByTestId('import-review')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('import-confirm'));
        await waitFor(() => expect(mockUpsertEntries).toHaveBeenCalledTimes(1));
        expect(mockUpsertEntries.mock.calls[0][0]).toEqual([
            expect.objectContaining({ cardId: pricedPrinting._uniqueId, quantity: 2, binderId: 'system:trade', isWanted: false }),
        ]);
    });

    test('confirm shows a spinner while the import is in progress', async () => {
        let finish;
        mockUpsertEntries.mockImplementation(() => new Promise((resolve) => {
            finish = () => resolve({ data: { rows: [] }, error: null });
        }));
        renderImport();
        const dialog = await openImportDialog();
        await pick(dialog, 'Name\nLightning Press SUP001\n');
        fireEvent.click(screen.getByTestId('import-confirm'));
        expect(await screen.findByTestId('import-confirm-spinner')).toBeInTheDocument();
        expect(screen.getByTestId('import-confirm')).toBeDisabled();
        finish();
        await waitFor(() => expect(screen.queryByTestId('import-confirm-spinner')).not.toBeInTheDocument());
    });

    test('refusals do not write', async () => {
        renderImport();
        const dialog = await openImportDialog();
        fireEvent.change(within(dialog).getByTestId('import-file'), { target: { files: [makeFile('nope\n1\n')] } });
        expect(await screen.findByTestId('import-refuse')).toHaveTextContent('This file needs a Name column');

        fireEvent.change(within(dialog).getByTestId('import-file'), { target: { files: [makeFile('Name,Quantity\nUnknown Junk,1\n')] } });
        await waitFor(() => expect(screen.getByTestId('import-refuse')).toHaveTextContent('None of those cards were found'));

        fireEvent.change(within(dialog).getByTestId('import-file'), { target: { files: [makeFile('Name,Quantity\nLightning Press,0\n')] } });
        await waitFor(() => expect(screen.getByTestId('import-refuse')).toHaveTextContent('No cards with a quantity'));
        expect(mockUpsertEntries).not.toHaveBeenCalled();
    });
});
