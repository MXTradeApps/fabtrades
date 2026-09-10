import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BinderSettings from '../../src/pages/BinderSettings.jsx';
import BinderCollection from '../../src/pages/BinderCollection.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import Header from '../../src/components/elements/Header.jsx';
import { pricedPrinting } from '../fixtures/printings.js';

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
    const { pricedPrinting: priced } = require('../fixtures/printings.js');
    return {
        useCardData: () => ({
            cards: [priced],
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

const headers = 'Identifier,Name,Pitch,Set,Set number,Edition,Foiling,Treatment,Have,Want in trade,Want to buy,Extra for trade,Extra to sell';
const ownedCsv = `${headers}\n1,Lightning Press,,Super Slam,SUP001,,,,2,9,,8,\n2,Unknown Junk,,Nowhere,ZZZ999,,,,1,,,,\n`;
const wantOnlyCsv = `${headers}\n1,Lightning Press,,Super Slam,SUP001,,,,0,5,,3,\n`;

function makeFile(text, name = 'export.csv', delayMs = 0) {
    const file = new File([text], name, { type: 'text/csv' });
    file.text = () => new Promise((resolve) => {
        setTimeout(() => resolve(text), delayMs);
    });
    return file;
}

const renderImport = (path = '/binder/import') =>
    render(
        <ThemeProvider theme={createTheme()}>
            <ThemeModeProvider>
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route path="/binder" element={<BinderCollection isWanted={false} />} />
                        <Route path="/wants" element={<BinderCollection isWanted />} />
                        <Route path="/binder/import" element={<BinderSettings />} />
                        <Route path="/binder/settings" element={<BinderSettings />} />
                    </Routes>
                </MemoryRouter>
            </ThemeModeProvider>
        </ThemeProvider>,
    );

describe('Fabrary import', () => {
    beforeEach(() => {
        mockUser = { id: 'user-1' };
        mockIsPro = true;
        mockGetBinders.mockResolvedValue(defaultBinders);
        mockGetBinderEntries.mockResolvedValue(emptyEntries);
        mockUpsertEntries.mockResolvedValue({ data: { rows: [] }, error: null });
        mockEnsureCollectionBinder.mockResolvedValue({
            data: { clientId: 'system:collection', name: 'Collection' },
            error: null,
        });
    });

    test('grid shows Import from Fabrary next to New Binder, not on a Binder', async () => {
        renderImport('/binder');
        expect(await screen.findByTestId('import-fabrary')).toBeInTheDocument();
        expect(screen.getByTestId('binder-create')).toBeInTheDocument();
        fireEvent.click(await screen.findByTestId('binder-tile-system:collection'));
        expect(screen.queryByTestId('binder-settings')).not.toBeInTheDocument();
        expect(screen.queryByTestId('import-fabrary')).not.toBeInTheDocument();
    });

    test('tile menu has no Settings; Import opens the import page', async () => {
        renderImport('/binder');
        fireEvent.click(await screen.findByTestId('binder-tile-menu-system:trade'));
        expect(screen.queryByTestId('binder-tile-settings-system:trade')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('import-fabrary'));
        expect(await screen.findByText('Import from Fabrary')).toBeInTheDocument();
        const importBack = screen.getByTestId('binder-settings-back');
        const importTitle = screen.getByText('Import from Fabrary');
        expect(importBack.compareDocumentPosition(importTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByTestId('fabrary-file')).toBeInTheDocument();
    });

    test('/wants has no import; Header has no Fabrary item', async () => {
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
        await waitFor(() => screen.getByText('Want List'));
        expect(screen.queryByTestId('binder-settings')).not.toBeInTheDocument();
        expect(screen.queryByTestId('import-fabrary')).not.toBeInTheDocument();

        render(
            <MemoryRouter>
                <ThemeProvider theme={createTheme()}>
                    <ThemeModeProvider>
                        <Header />
                    </ThemeModeProvider>
                </ThemeProvider>
            </MemoryRouter>,
        );
        fireEvent.click(screen.getAllByLabelText('open drawer')[0]);
        expect(screen.queryByText('Import from Fabrary')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Settings/i })).not.toBeInTheDocument();
    });

    test('signed-out /binder/import uses the Binder sign-in gate', async () => {
        mockUser = null;
        renderImport();
        expect(await screen.findByText('Sign In Required')).toBeInTheDocument();
        expect(screen.queryByTestId('fabrary-file')).not.toBeInTheDocument();
    });

    test('import page is available with an empty Collection', async () => {
        renderImport();
        expect(await screen.findByTestId('import-fabrary')).toBeInTheDocument();
        expect(screen.getByText('Import from Fabrary')).toBeInTheDocument();
    });

    test('preview shows unmatched names; cancel does not write', async () => {
        renderImport();
        await screen.findByTestId('import-fabrary');
        const file = makeFile(ownedCsv, 'export.csv', 30);
        fireEvent.change(screen.getByTestId('fabrary-file'), { target: { files: [file] } });
        expect(await screen.findByTestId('fabrary-working')).toBeInTheDocument();
        expect(await screen.findByTestId('fabrary-preview')).toBeInTheDocument();
        expect(screen.getByText(/Rows with quantities: 2/)).toBeInTheDocument();
        expect(screen.getByText(/Collection: 2/)).toBeInTheDocument();
        expect(screen.getByText(/Want List: 9/)).toBeInTheDocument();
        expect(screen.getByText(/Trade Binder: 8/)).toBeInTheDocument();
        expect(screen.getByText(/Matched: 3/)).toBeInTheDocument();
        expect(screen.getByText(/Unmatched: 1/)).toBeInTheDocument();
        expect(screen.getByText(/Copies to add: 19/)).toBeInTheDocument();
        expect(screen.getByText(/Unknown Junk/)).toBeInTheDocument();
        expect(screen.getByText(/adds Have copies to Collection/)).toBeInTheDocument();
        expect(screen.getByTestId('fabrary-confirm')).not.toBeDisabled();

        fireEvent.click(screen.getByTestId('fabrary-cancel'));
        expect(screen.queryByTestId('fabrary-preview')).not.toBeInTheDocument();
        expect(mockUpsertEntries).not.toHaveBeenCalled();
    });

    test('Want and Extra preview into Want List and Trade Binder', async () => {
        renderImport();
        await screen.findByTestId('import-fabrary');
        fireEvent.change(screen.getByTestId('fabrary-file'), {
            target: { files: [makeFile(wantOnlyCsv)] },
        });
        expect(await screen.findByTestId('fabrary-preview')).toBeInTheDocument();
        expect(screen.getByText(/Want List: 5/)).toBeInTheDocument();
        expect(screen.getByText(/Trade Binder: 3/)).toBeInTheDocument();
        expect(screen.queryByTestId('fabrary-refuse')).not.toBeInTheDocument();
        expect(mockUpsertEntries).not.toHaveBeenCalled();
    });

    test('confirm upserts Collection, Want List, and Trade; second confirm adds again', async () => {
        let stored = [];
        mockGetBinderEntries.mockImplementation(async () => ({
            data: { binder: stored.filter((r) => !r.isWanted), wants: stored.filter((r) => r.isWanted), all: stored },
            error: null,
        }));
        mockUpsertEntries.mockImplementation(async (rows) => {
            stored = rows.map((row) => ({
                cardId: row.cardId,
                quantity: row.quantity,
                isWanted: Boolean(row.isWanted),
                binderId: row.binderId ?? null,
                condition: 'NM',
                card: row.card,
            }));
            return { data: { rows: stored }, error: null };
        });
        renderImport();
        await screen.findByTestId('import-fabrary');
        fireEvent.change(screen.getByTestId('fabrary-file'), {
            target: { files: [makeFile(ownedCsv)] },
        });
        await screen.findByTestId('fabrary-preview');
        fireEvent.click(screen.getByTestId('fabrary-confirm'));
        await waitFor(() => expect(mockUpsertEntries).toHaveBeenCalledTimes(1));
        expect(mockEnsureCollectionBinder).toHaveBeenCalled();
        const first = mockUpsertEntries.mock.calls[0][0];
        expect(first).toEqual(expect.arrayContaining([
            expect.objectContaining({
                cardId: pricedPrinting._uniqueId,
                quantity: 2,
                binderId: 'system:collection',
                isWanted: false,
            }),
            expect.objectContaining({
                cardId: pricedPrinting._uniqueId,
                quantity: 9,
                binderId: null,
                isWanted: true,
            }),
            expect.objectContaining({
                cardId: pricedPrinting._uniqueId,
                quantity: 8,
                binderId: 'system:trade',
                isWanted: false,
            }),
        ]));
        expect(await screen.findByText(/Unknown Junk/)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('fabrary-confirm'));
        await waitFor(() => expect(mockUpsertEntries).toHaveBeenCalledTimes(2));
        const second = mockUpsertEntries.mock.calls[1][0];
        expect(second.find((row) => row.binderId === 'system:collection').quantity).toBe(4);
        expect(second.find((row) => row.isWanted).quantity).toBe(18);
        expect(second.find((row) => row.binderId === 'system:trade').quantity).toBe(16);
    });

    test('refuse reasons do not call upsertEntries', async () => {
        renderImport();
        await screen.findByTestId('import-fabrary');
        fireEvent.change(screen.getByTestId('fabrary-file'), {
            target: { files: [makeFile('nope\n1\n')] },
        });
        expect(await screen.findByTestId('fabrary-refuse')).toHaveTextContent(
            'This is not a Fabrary collection export',
        );

        fireEvent.change(screen.getByTestId('fabrary-file'), {
            target: { files: [makeFile(`${headers}\n1,Unknown Junk,,Nowhere,ZZZ999,,,,1,,,,\n`)] },
        });
        expect(await screen.findByTestId('fabrary-refuse')).toHaveTextContent(
            'None of those cards were found in the catalog',
        );
        expect(mockUpsertEntries).not.toHaveBeenCalled();
    });

    test('a large existing Binder still previews with no Upgrade to Pro', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: Array.from({ length: 50 }, (_, i) => ({
                    cardId: `owned-${i}`,
                    quantity: 1,
                    isWanted: false,
                    binderId: 'system:trade',
                })),
                wants: [],
                all: Array.from({ length: 50 }, (_, i) => ({
                    cardId: `owned-${i}`,
                    quantity: 1,
                    isWanted: false,
                    binderId: 'system:trade',
                })),
            },
            error: null,
        });
        renderImport();
        await screen.findByTestId('import-fabrary');
        fireEvent.change(screen.getByTestId('fabrary-file'), {
            target: { files: [makeFile(ownedCsv)] },
        });
        expect(await screen.findByTestId('fabrary-preview')).toBeInTheDocument();
        expect(screen.getByText(/Copies to add: 19/)).toBeInTheDocument();
        expect(screen.queryByText(/Upgrade to Pro/i)).not.toBeInTheDocument();
        expect(screen.queryByTestId('fabrary-upgrade')).not.toBeInTheDocument();
        expect(mockUpsertEntries).not.toHaveBeenCalled();
    });
});
