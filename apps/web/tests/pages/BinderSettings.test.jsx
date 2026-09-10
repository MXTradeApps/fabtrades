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
    data: { binder: [], wants: [] },
    error: null,
};

const headers = 'Identifier,Name,Pitch,Set,Set number,Edition,Foiling,Treatment,Have,Want,Extra';
const ownedCsv = `${headers}\n1,Lightning Press,,Super Slam,SUP001,,,,2,9,8\n2,Unknown Junk,,Nowhere,ZZZ999,,,,1,,\n`;
const wantOnlyCsv = `${headers}\n1,Lightning Press,,Super Slam,SUP001,,,,0,5,3\n`;

function makeFile(text, name = 'export.csv', delayMs = 0) {
    const file = new File([text], name, { type: 'text/csv' });
    file.text = () => new Promise((resolve) => {
        setTimeout(() => resolve(text), delayMs);
    });
    return file;
}

const renderSettings = (path = '/binder/settings?b=system:collection') =>
    render(
        <ThemeProvider theme={createTheme()}>
            <ThemeModeProvider>
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route path="/binder" element={<BinderCollection isWanted={false} />} />
                        <Route path="/wants" element={<BinderCollection isWanted />} />
                        <Route path="/binder/settings" element={<BinderSettings />} />
                    </Routes>
                </MemoryRouter>
            </ThemeModeProvider>
        </ThemeProvider>,
    );

describe('BinderSettings', () => {
    beforeEach(() => {
        mockUser = { id: 'user-1' };
        mockIsPro = true;
        mockGetBinders.mockResolvedValue(defaultBinders);
        mockGetBinderEntries.mockResolvedValue(emptyEntries);
        mockUpsertEntries.mockResolvedValue({ data: { rows: [] }, error: null });
    });

    test('open Binder header Settings and tile Settings go to this Binder', async () => {
        mockGetBinderEntries.mockResolvedValue({
            data: {
                binder: [{
                    cardId: pricedPrinting._uniqueId,
                    quantity: 1,
                    isWanted: false,
                    binderId: 'system:collection',
                    card: pricedPrinting,
                }],
                wants: [],
            },
            error: null,
        });
        render(
            <ThemeProvider theme={createTheme()}>
                <ThemeModeProvider>
                    <MemoryRouter initialEntries={['/binder']}>
                        <Routes>
                            <Route path="/binder" element={<BinderCollection isWanted={false} />} />
                            <Route path="/binder/settings" element={<BinderSettings />} />
                        </Routes>
                    </MemoryRouter>
                </ThemeModeProvider>
            </ThemeProvider>,
        );
        fireEvent.click(await screen.findByTestId('binder-tile-system:collection'));
        expect(await screen.findByTestId('binder-settings')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('binder-settings'));
        expect(await screen.findByTestId('import-fabrary')).toBeInTheDocument();
        expect(screen.getByText('Collection')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    test('tile menu Settings navigates to /binder/settings', async () => {
        render(
            <ThemeProvider theme={createTheme()}>
                <ThemeModeProvider>
                    <MemoryRouter initialEntries={['/binder']}>
                        <Routes>
                            <Route path="/binder" element={<BinderCollection isWanted={false} />} />
                            <Route path="/binder/settings" element={<BinderSettings />} />
                        </Routes>
                    </MemoryRouter>
                </ThemeModeProvider>
            </ThemeProvider>,
        );
        fireEvent.click(await screen.findByTestId('binder-tile-menu-system:trade'));
        fireEvent.click(await screen.findByTestId('binder-tile-settings-system:trade'));
        expect(await screen.findByTestId('import-fabrary')).toBeInTheDocument();
        expect(screen.getByText('Trade Binder')).toBeInTheDocument();
    });

    test('/wants has no Binder Settings; Header has no settings import', async () => {
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

    test('signed-out /binder/settings uses the Binder sign-in gate', async () => {
        mockUser = null;
        renderSettings();
        expect(await screen.findByText('Sign In Required')).toBeInTheDocument();
        expect(screen.queryByTestId('import-fabrary')).not.toBeInTheDocument();
    });

    test('empty Binder still shows Import from Fabrary', async () => {
        renderSettings();
        expect(await screen.findByTestId('import-fabrary')).toBeInTheDocument();
        expect(await screen.findByText('Collection')).toBeInTheDocument();
    });

    test('preview shows unmatched names; cancel does not write', async () => {
        renderSettings();
        await screen.findByTestId('import-fabrary');
        const file = makeFile(ownedCsv, 'export.csv', 30);
        fireEvent.change(screen.getByTestId('fabrary-file'), { target: { files: [file] } });
        expect(await screen.findByTestId('fabrary-working')).toBeInTheDocument();
        expect(await screen.findByTestId('fabrary-preview')).toBeInTheDocument();
        expect(screen.getByText(/Owned cards: 2/)).toBeInTheDocument();
        expect(screen.getByText(/Matched: 1/)).toBeInTheDocument();
        expect(screen.getByText(/Unmatched: 1/)).toBeInTheDocument();
        expect(screen.getByText(/Copies to add: 2/)).toBeInTheDocument();
        expect(screen.getByText(/Unknown Junk/)).toBeInTheDocument();
        expect(screen.getByText(/adds Near Mint/)).toBeInTheDocument();
        expect(screen.getByTestId('fabrary-confirm')).not.toBeDisabled();

        fireEvent.click(screen.getByTestId('fabrary-cancel'));
        expect(screen.queryByTestId('fabrary-preview')).not.toBeInTheDocument();
        expect(mockUpsertEntries).not.toHaveBeenCalled();
    });

    test('Want and Extra do not increase copies to add', async () => {
        renderSettings();
        await screen.findByTestId('import-fabrary');
        fireEvent.change(screen.getByTestId('fabrary-file'), {
            target: { files: [makeFile(wantOnlyCsv)] },
        });
        expect(await screen.findByTestId('fabrary-refuse')).toHaveTextContent(
            'No owned cards (Have) were found',
        );
        expect(mockUpsertEntries).not.toHaveBeenCalled();
    });

    test('confirm upserts this Binder only and a second confirm adds again', async () => {
        let stored = [];
        mockGetBinderEntries.mockImplementation(async () => ({
            data: { binder: stored, wants: [] },
            error: null,
        }));
        mockUpsertEntries.mockImplementation(async (rows) => {
            stored = rows.map((row) => ({
                cardId: row.cardId,
                quantity: row.quantity,
                isWanted: false,
                binderId: row.binderId,
                condition: 'NM',
                card: row.card,
            }));
            return { data: { rows: stored }, error: null };
        });
        renderSettings();
        await screen.findByTestId('import-fabrary');
        fireEvent.change(screen.getByTestId('fabrary-file'), {
            target: { files: [makeFile(ownedCsv)] },
        });
        await screen.findByTestId('fabrary-preview');
        fireEvent.click(screen.getByTestId('fabrary-confirm'));
        await waitFor(() => expect(mockUpsertEntries).toHaveBeenCalledTimes(1));
        const first = mockUpsertEntries.mock.calls[0][0];
        expect(first).toEqual([
            expect.objectContaining({
                cardId: pricedPrinting._uniqueId,
                quantity: 2,
                binderId: 'system:collection',
            }),
        ]);
        expect(await screen.findByText(/Unknown Junk/)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('fabrary-confirm'));
        await waitFor(() => expect(mockUpsertEntries).toHaveBeenCalledTimes(2));
        expect(mockUpsertEntries.mock.calls[1][0][0].quantity).toBe(4);
    });

    test('refuse reasons do not call upsertEntries', async () => {
        renderSettings();
        await screen.findByTestId('import-fabrary');
        fireEvent.change(screen.getByTestId('fabrary-file'), {
            target: { files: [makeFile('nope\n1\n')] },
        });
        expect(await screen.findByTestId('fabrary-refuse')).toHaveTextContent(
            'This is not a Fabrary collection export',
        );

        fireEvent.change(screen.getByTestId('fabrary-file'), {
            target: { files: [makeFile(`${headers}\n1,Unknown Junk,,Nowhere,ZZZ999,,,,1,,\n`)] },
        });
        expect(await screen.findByTestId('fabrary-refuse')).toHaveTextContent(
            'None of the owned cards were found in the catalog',
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
            },
            error: null,
        });
        renderSettings();
        await screen.findByTestId('import-fabrary');
        fireEvent.change(screen.getByTestId('fabrary-file'), {
            target: { files: [makeFile(ownedCsv)] },
        });
        expect(await screen.findByTestId('fabrary-preview')).toBeInTheDocument();
        expect(screen.getByText(/Copies to add: 2/)).toBeInTheDocument();
        expect(screen.queryByText(/Upgrade to Pro/i)).not.toBeInTheDocument();
        expect(screen.queryByTestId('fabrary-upgrade')).not.toBeInTheDocument();
        expect(mockUpsertEntries).not.toHaveBeenCalled();
    });
});
