import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CardDetailModal from '../../src/components/cardDetail/CardDetailModal.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { pricedPrinting, unpricedPrinting } from '../fixtures/printings.js';

const mockGetBinderEntries = jest.fn();
const mockUpsertEntry = jest.fn();

jest.mock('../../src/contexts/AuthContext.jsx', () => ({
    useAuth: () => ({ user: null }),
}));

jest.mock('../../src/contexts/EntitlementContext.jsx', () => ({
    useEntitlement: () => ({ isPro: false, loading: false }),
}));

jest.mock('../../src/hooks/useCardData.jsx', () => {
    const { catalogFixture } = require('../fixtures/printings.js');
    return {
        useCardData: () => ({
            cards: catalogFixture,
            pricesUpdatedAt: '2026-08-14T12:00:00Z',
            cardIdLookup: {},
        }),
    };
});

jest.mock('../../src/services/binder.js', () => ({
    TRADE_BINDER_ID: 'system:trade',
    targetOwnedBinderId: () => 'system:trade',
    getBinderEntries: (...args) => mockGetBinderEntries(...args),
    upsertEntry: (...args) => mockUpsertEntry(...args),
}));

jest.mock('../../src/components/auth/SignInDialog.jsx', () => ({
    __esModule: true,
    default: ({ open }) => (open ? <div data-testid="sign-in-dialog" /> : null),
}));

const renderModal = ({
    printing = pricedPrinting,
    path = '/',
    addWantCard = null,
    onClose = jest.fn(),
    open = true,
} = {}) => {
    const utils = render(
        <MemoryRouter initialEntries={[path]}>
            <ThemeProvider theme={createTheme()}>
                <ThemeModeProvider>
                    <div data-testid="parent-page">Trade piles</div>
                    <CardDetailModal
                        open={open}
                        printing={printing}
                        onClose={onClose}
                        addWantCard={addWantCard}
                    />
                </ThemeModeProvider>
            </ThemeProvider>
        </MemoryRouter>,
    );
    return { ...utils, onClose, addWantCard };
};

describe('CardDetailModal', () => {
    beforeEach(() => {
        mockGetBinderEntries.mockResolvedValue({
            data: { binder: [], wants: [] },
            error: null,
        });
        mockUpsertEntry.mockResolvedValue({ data: {}, error: null });
    });

    test('shows identity and Prices over the parent page', () => {
        renderModal();
        expect(screen.getByTestId('parent-page')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Lightning Press' })).toBeInTheDocument();
        expect(screen.getAllByText(/Super Slam/).length).toBeGreaterThan(0);
        expect(screen.getByText('Prices')).toBeInTheDocument();
        expect(screen.getByText('TCGplayer')).toBeInTheDocument();
        expect(screen.getByText('CardMarket')).toBeInTheDocument();
        expect(screen.getByText('$12.50')).toBeInTheDocument();
        expect(screen.getByText('€10.20')).toBeInTheDocument();
    });

    test('inspects signed out without requiring an account', () => {
        renderModal();
        expect(screen.getByRole('heading', { name: 'Lightning Press' })).toBeInTheDocument();
        expect(screen.queryByText(/^Own /)).not.toBeInTheDocument();
        expect(screen.queryByTestId('sign-in-dialog')).not.toBeInTheDocument();
    });

    test('missing art still shows name and Prices', () => {
        renderModal({ printing: unpricedPrinting });
        expect(screen.getByRole('heading', { name: 'New Promo' })).toBeInTheDocument();
        expect(screen.getByLabelText('No art')).toBeInTheDocument();
        expect(screen.getByText('Prices')).toBeInTheDocument();
        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
        expect(screen.queryByText('€0.00')).not.toBeInTheDocument();
    });

    test('dismiss via close control restores the parent', () => {
        const { onClose } = renderModal();
        fireEvent.click(screen.getByRole('button', { name: 'Close card details' }));
        expect(onClose).toHaveBeenCalled();
        expect(screen.getByTestId('parent-page')).toBeInTheDocument();
    });

    test('Add to trade is absent off the balancer', () => {
        renderModal({ path: '/sets/1', addWantCard: jest.fn() });
        expect(screen.queryByRole('button', { name: 'Add to trade' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Want List' })).toBeInTheDocument();
    });

    test('Add to trade is present on / and calls Want add without closing', () => {
        const addWantCard = jest.fn();
        renderModal({ path: '/', addWantCard });
        const dialog = screen.getByRole('dialog');
        fireEvent.click(screen.getByRole('button', { name: 'Add to trade' }));
        expect(addWantCard).toHaveBeenCalledWith({
            label: pricedPrinting.displayName,
            card: pricedPrinting,
        });
        expect(screen.getByRole('dialog')).toBe(dialog);
        expect(screen.getByText(/Added Lightning Press to Want/)).toBeInTheDocument();
    });

    test('failed Want List add does not toast success', async () => {
        mockGetBinderEntries.mockResolvedValueOnce({
            data: null,
            error: { message: 'You must be logged in to view your binder' },
        });
        // Signed-out path opens SignInDialog instead of upserting.
        renderModal({ path: '/sets/1' });
        fireEvent.click(screen.getByRole('button', { name: 'Want List' }));
        expect(await screen.findByTestId('sign-in-dialog')).toBeInTheDocument();
        expect(screen.queryByText(/Added .* to Want List/)).not.toBeInTheDocument();
        expect(mockUpsertEntry).not.toHaveBeenCalled();
    });

    test('switching Version updates art and Prices to that Printing only', () => {
        renderModal({ printing: pricedPrinting });
        expect(screen.getByText('$12.50')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Rainbow Foil/ }));
        expect(screen.getByText('$40.00')).toBeInTheDocument();
        expect(screen.queryByText('$12.50')).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Zoom art for Lightning Press/)).toBeInTheDocument();
    });
});
