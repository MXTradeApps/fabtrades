import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SharedBinder from '../../src/pages/SharedBinder.jsx';
import { sharedBinderTitle } from '../../src/utils/binderNames.js';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';

const mockGetPublicBinder = jest.fn();
const mockCreateBinder = jest.fn();
const mockUpsertEntries = jest.fn();
const mockGetBinderShare = jest.fn();
const mockDeleteBinder = jest.fn();
let mockUser = null;

jest.mock('../../src/contexts/AuthContext.jsx', () => ({
    useAuth: () => ({ user: mockUser }),
}));

jest.mock('../../src/contexts/EntitlementContext.jsx', () => ({
    useEntitlement: () => ({ isPro: false, loading: false }),
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
    getPublicBinder: (...args) => mockGetPublicBinder(...args),
    createBinder: (...args) => mockCreateBinder(...args),
    upsertEntries: (...args) => mockUpsertEntries(...args),
    getBinderShare: (...args) => mockGetBinderShare(...args),
    deleteBinder: (...args) => mockDeleteBinder(...args),
}));

jest.mock('../../src/components/search/index.js', () => ({
    SearchInput: () => <div data-testid="search-input" />,
    SearchDialog: () => null,
}));

jest.mock('../../src/components/auth/SignInDialog.jsx', () => ({
    __esModule: true,
    default: () => null,
}));

const renderShared = () =>
    render(
        <MemoryRouter initialEntries={[`/b/${'a'.repeat(32)}`]}>
            <ThemeProvider theme={createTheme()}>
                <ThemeModeProvider>
                    <Routes>
                        <Route path="/b/:token" element={<SharedBinder />} />
                    </Routes>
                </ThemeModeProvider>
            </ThemeProvider>
        </MemoryRouter>,
    );

const entry = {
    cardId: '123-Normal',
    quantity: 3,
    condition: 'NM',
    card: { name: 'Lightning Press' },
};

describe('SharedBinder', () => {
    test('titles the page with the owner name and shows a card grid', async () => {
        mockGetPublicBinder.mockResolvedValue({
            data: { ownerName: 'Max', entries: [entry] },
            error: null,
        });
        renderShared();

        expect(await screen.findByText('Max’s Binder')).toBeInTheDocument();
        expect(screen.queryByText('Shared Binder')).not.toBeInTheDocument();
        expect(screen.getByTestId('binder-card-grid')).toBeInTheDocument();
        const tile = screen.getByTestId('binder-card-tile-123-Normal');
        expect(tile).toHaveTextContent('Lightning Press');
        expect(tile).toHaveTextContent('3×');
        expect(tile.querySelector('img')).toHaveAttribute('src', expect.stringContaining('SUP001'));
    });

    test('falls back to the generic title without an owner name', async () => {
        mockGetPublicBinder.mockResolvedValue({
            data: { ownerName: null, entries: [entry] },
            error: null,
        });
        renderShared();
        expect(await screen.findByText('Shared Binder')).toBeInTheDocument();
    });

    test('sharedBinderTitle handles names ending in s', () => {
        expect(sharedBinderTitle('James')).toBe('James’ Binder');
        expect(sharedBinderTitle('  Max ')).toBe('Max’s Binder');
        expect(sharedBinderTitle('')).toBe('Shared Binder');
    });

    describe('export and copy', () => {
        const token = 'a'.repeat(32);

        beforeEach(() => {
            mockUser = null;
            window.sessionStorage.clear();
            mockGetPublicBinder.mockResolvedValue({ data: { ownerName: 'Max', entries: [entry] }, error: null });
            mockGetBinderShare.mockResolvedValue({ data: { token: 'b'.repeat(32) }, error: null });
            mockCreateBinder.mockResolvedValue({ data: { clientId: 'new-binder', name: 'Max’s Binder' }, error: null });
            mockUpsertEntries.mockResolvedValue({ data: { rows: [] }, error: null });
        });

        afterEach(() => {
            mockUser = null;
        });

        test('signed out, Copy asks to sign in and remembers the copy', async () => {
            renderShared();
            fireEvent.click(await screen.findByTestId('shared-binder-export'));
            const copy = await screen.findByTestId('binder-export-copy-binder');
            expect(copy).toHaveTextContent('Sign in to copy');
            fireEvent.click(copy);
            expect(window.sessionStorage.getItem('fabtrades.pendingBinderCopy')).toBe(token);
            expect(mockCreateBinder).not.toHaveBeenCalled();
        });

        test('signed in, a pending copy finishes on return', async () => {
            mockUser = { id: 'viewer' };
            window.sessionStorage.setItem('fabtrades.pendingBinderCopy', token);
            renderShared();
            expect(await screen.findByText('Copied to your Binders as "Max’s Binder"')).toBeInTheDocument();
            expect(mockCreateBinder).toHaveBeenCalledWith({ name: 'Max’s Binder' });
            expect(mockUpsertEntries).toHaveBeenCalledWith([
                expect.objectContaining({ cardId: '123-Normal', quantity: 3, binderId: 'new-binder' }),
            ]);
            expect(screen.getByTestId('shared-binder-open-copy')).toBeInTheDocument();
            expect(window.sessionStorage.getItem('fabtrades.pendingBinderCopy')).toBeNull();
        });

        test('a taken name gets a number', async () => {
            mockUser = { id: 'viewer' };
            mockCreateBinder
                .mockResolvedValueOnce({ data: null, error: { reason: 'duplicate' } })
                .mockResolvedValueOnce({ data: { clientId: 'new-binder', name: 'Max’s Binder (2)' }, error: null });
            renderShared();
            fireEvent.click(await screen.findByTestId('shared-binder-export'));
            fireEvent.click(await screen.findByTestId('binder-export-copy-binder'));
            expect(await screen.findByText('Copied to your Binders as "Max’s Binder (2)"')).toBeInTheDocument();
        });

        test('a failed copy removes the new Binder', async () => {
            mockUser = { id: 'viewer' };
            mockUpsertEntries.mockResolvedValue({ data: null, error: { message: 'Network down' } });
            mockDeleteBinder.mockResolvedValue({ data: {}, error: null });
            renderShared();
            fireEvent.click(await screen.findByTestId('shared-binder-export'));
            fireEvent.click(await screen.findByTestId('binder-export-copy-binder'));
            expect(await screen.findByText('Network down')).toBeInTheDocument();
            expect(mockDeleteBinder).toHaveBeenCalledWith({ clientId: 'new-binder' });
        });

        test('the owner does not get a Copy option', async () => {
            mockUser = { id: 'owner' };
            mockGetBinderShare.mockResolvedValue({ data: { token }, error: null });
            renderShared();
            await waitFor(() => expect(mockGetBinderShare).toHaveBeenCalled());
            fireEvent.click(await screen.findByTestId('shared-binder-export'));
            expect(await screen.findByTestId('binder-export-dialog')).toBeInTheDocument();
            await waitFor(() => expect(screen.queryByTestId('binder-export-copy-binder')).not.toBeInTheDocument());
        });
    });
});
