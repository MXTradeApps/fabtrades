/**
 * The trade balance panel: totals, the verdict, and confirming a trade.
 *
 * `confirmTrade` (the service) has its own tests. These cover what the user
 * sees around it: which options the dialog offers, what gets sent, and what
 * happens to the calculator after success, partial success and failure.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TradeSummary from '../../src/components/elements/TradeSummary.jsx';
import { confirmTrade } from '../../src/services/confirmTrade.js';

let mockUser = { id: 'user-1' };

jest.mock('../../src/contexts/AuthContext.jsx', () => ({
    useAuth: () => ({ user: mockUser }),
}));

jest.mock('../../src/services/confirmTrade.js', () => ({
    confirmTrade: jest.fn(),
}));

jest.mock('../../src/components/elements/ShareTradeDialog.jsx', () => ({
    __esModule: true,
    default: ({ items, wants, getLink, onClose }) => (
        <div data-testid="share-dialog">
            <span data-testid="share-items">{JSON.stringify(items)}</span>
            <span data-testid="share-wants">{JSON.stringify(wants)}</span>
            <span data-testid="share-link-wtt">{getLink('wtt')}</span>
            <span data-testid="share-link-wts">{getLink('wts')}</span>
            <button onClick={onClose}>close share</button>
        </div>
    ),
}));

const have = [
    { name: 'Sink Below (Red)', subTypeName: 'Normal', uniqueId: 'sink-normal', price: 4.5, lowPrice: 4, quantity: 2 },
];
const want = [
    { name: 'Enlightened Strike (Red)', subTypeName: 'Rainbow Foil', uniqueId: 'es-rf', price: 30, lowPrice: 25, quantity: 1 },
];

const renderSummary = (overrides = {}) => {
    const props = {
        haveList: have,
        wantList: want,
        haveTotal: 9,
        wantTotal: 30,
        haveLowTotal: 8,
        wantLowTotal: 25,
        diff: -21,
        lowDiff: -17,
        clearURLTradeData: jest.fn(),
        clearTrade: jest.fn(),
        urlTradeData: null,
        hasLoadedFromURL: false,
        ...overrides,
    };
    return { props, ...render(<TradeSummary {...props} />) };
};

const decodeTradeParam = (link) => JSON.parse(atob(new URL(link).searchParams.get('trade')));

const openConfirm = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Trade' }));
    return screen.getByRole('dialog');
};

beforeEach(() => {
    mockUser = { id: 'user-1' };
    confirmTrade.mockReset();
    confirmTrade.mockResolvedValue({ data: { id: 't1' }, error: null, trimmed: 0, binderReconciled: true });
});

describe('TradeSummary — the balance', () => {
    it('counts copies, not lines, on each side', () => {
        renderSummary();
        expect(screen.getByText('Give · 2 cards')).toBeInTheDocument();
        expect(screen.getByText('Get · 1 card')).toBeInTheDocument();
    });

    it('shows each side total with its Low value', () => {
        renderSummary();
        expect(screen.getByText('$9')).toBeInTheDocument();
        expect(screen.getByText('$30')).toBeInTheDocument();
        expect(screen.getByText('Low $8')).toBeInTheDocument();
        expect(screen.getByText('Low $25')).toBeInTheDocument();
    });

    it('always shows cents once an amount has any', () => {
        renderSummary({ haveTotal: 4.5, haveLowTotal: 0, wantLowTotal: 0, lowDiff: 0 });
        expect(screen.getByText('$4.50')).toBeInTheDocument();
    });

    it('says who is ahead in the wide layout', () => {
        const { rerender, props } = renderSummary({ isLandscape: true });
        expect(screen.getByText('You get $21 more')).toBeInTheDocument();

        rerender(<TradeSummary {...props} diff={12.25} />);
        expect(screen.getByText('You give $12.25 more')).toBeInTheDocument();
    });

    it('calls a trade within a cent even', () => {
        renderSummary({ isLandscape: true, diff: 0.004, lowDiff: 0, haveLowTotal: 0, wantLowTotal: 0 });
        expect(screen.getByText('Even trade')).toBeInTheDocument();
        expect(screen.queryByText(/Low difference/)).not.toBeInTheDocument();
    });

    it('signs the difference in the compact layout', () => {
        const { rerender, props } = renderSummary();
        expect(screen.getByText('−$21')).toBeInTheDocument();
        expect(screen.getByText('Low −$17')).toBeInTheDocument();

        rerender(<TradeSummary {...props} diff={5} lowDiff={3} />);
        expect(screen.getByText('+$5')).toBeInTheDocument();
        expect(screen.getByText('Low +$3')).toBeInTheDocument();
    });

    it('describes the split for screen readers', () => {
        renderSummary({ haveTotal: 25, wantTotal: 75 });
        expect(screen.getByRole('img', { name: 'You give 25% of the trade value' })).toBeInTheDocument();
    });

    it('handles an empty trade: zero totals and nothing to share or confirm', () => {
        renderSummary({
            haveList: [], wantList: [], haveTotal: 0, wantTotal: 0,
            haveLowTotal: 0, wantLowTotal: 0, diff: 0, lowDiff: 0,
        });
        expect(screen.getByText('Give · 0 cards')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'No cards in the trade yet' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Confirm Trade' })).toBeDisabled();
        expect(screen.getByTestId('share-trade-button')).toBeDisabled();
    });

    it('treats a line without a quantity as one copy', () => {
        renderSummary({ haveList: [{ name: 'Card', price: 1 }] });
        expect(screen.getByText('Give · 1 card')).toBeInTheDocument();
    });
});

describe('TradeSummary — a trade opened from a shared link', () => {
    const linked = (ageInDays) => ({
        hasLoadedFromURL: true,
        urlTradeData: { version: 1, have: [], want: [], ageInDays },
    });

    it.each([
        [8, '1 week'],
        [20, '3 weeks'],
        [45, '2 months'],
    ])('warns that prices are old after a week (%p days reads "%s")', (age, label) => {
        renderSummary(linked(age));
        expect(screen.getByText(`Shared trade prices are ${label} old`)).toBeInTheDocument();
    });

    it('does not warn about a recent link', () => {
        renderSummary(linked(2));
        expect(screen.queryByText(/Shared trade prices are/)).not.toBeInTheDocument();
    });

    it('unlinks the trade only after the visitor agrees', () => {
        const { props } = renderSummary(linked(1));

        fireEvent.click(screen.getByRole('button', { name: 'Clear loaded trade data from URL' }));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Clear Loaded Trade Data?')).toBeInTheDocument();
        expect(props.clearURLTradeData).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Clear' }));
        expect(props.clearURLTradeData).toHaveBeenCalledTimes(1);
    });

    it('keeps the link when the visitor cancels', () => {
        const { props } = renderSummary(linked(1));
        fireEvent.click(screen.getByRole('button', { name: 'Clear loaded trade data from URL' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
        expect(props.clearURLTradeData).not.toHaveBeenCalled();
    });

    it('offers no unlink button for a trade built by hand', () => {
        renderSummary();
        expect(screen.queryByRole('button', { name: 'Clear loaded trade data from URL' })).not.toBeInTheDocument();
    });
});

describe('TradeSummary — sharing', () => {
    it('hands the share dialog both sides with finish, quantity and price', () => {
        renderSummary();
        fireEvent.click(screen.getByTestId('share-trade-button'));

        expect(JSON.parse(screen.getByTestId('share-items').textContent)).toEqual([
            { name: 'Sink Below (Red)', finish: 'Normal', quantity: 2, price: 4.5 },
        ]);
        expect(JSON.parse(screen.getByTestId('share-wants').textContent)).toEqual([
            { name: 'Enlightened Strike (Red)', finish: 'Rainbow Foil', quantity: 1, price: 30 },
        ]);
    });

    it('builds a trade link with both sides, and a sale link without the wants', () => {
        renderSummary();
        fireEvent.click(screen.getByTestId('share-trade-button'));

        const wtt = decodeTradeParam(screen.getByTestId('share-link-wtt').textContent);
        expect(wtt.h).toEqual([['sink-normal', 4.5, 2]]);
        expect(wtt.w).toEqual([['es-rf', 30, 1]]);

        const wts = decodeTradeParam(screen.getByTestId('share-link-wts').textContent);
        expect(wts.h).toEqual([['sink-normal', 4.5, 2]]);
        expect(wts.w).toEqual([]);
    });

    it('closes the share dialog', () => {
        renderSummary();
        fireEvent.click(screen.getByTestId('share-trade-button'));
        fireEvent.click(screen.getByText('close share'));
        expect(screen.queryByTestId('share-dialog')).not.toBeInTheDocument();
    });

    it('lets a signed-out visitor share', () => {
        mockUser = null;
        renderSummary();
        expect(screen.getByTestId('share-trade-button')).toBeEnabled();
    });
});

describe('TradeSummary — confirming a trade', () => {
    it('is not offered to a signed-out visitor', () => {
        mockUser = null;
        renderSummary();
        expect(screen.queryByRole('button', { name: 'Confirm Trade' })).not.toBeInTheDocument();
    });

    it('summarises the trade and ticks both Binder options by default', () => {
        renderSummary();
        const dialog = openConfirm();

        expect(within(dialog).getByText(/Giving 2 cards · Receiving 1 card/)).toBeInTheDocument();
        expect(within(dialog).getByLabelText('Remove my 2 given cards from Binder')).toBeChecked();
        expect(within(dialog).getByLabelText(/Add their 1 card to my Binder/)).toBeChecked();
    });

    it('sends both lists, the totals and both Binder options', async () => {
        const { props } = renderSummary();
        const dialog = openConfirm();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => expect(confirmTrade).toHaveBeenCalledTimes(1));
        expect(confirmTrade).toHaveBeenCalledWith({
            haveList: have,
            wantList: want,
            totals: { haveTotal: 9, wantTotal: 30, diff: -21 },
            removeGivenFromBinder: true,
            addReceivedToBinder: true,
        });
        expect(await screen.findByText('Trade confirmed')).toBeInTheDocument();
        expect(props.clearTrade).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByText(/Giving 2 cards/)).not.toBeInTheDocument());
    });

    it.each([
        ['keeping given cards in the Binder', 'Remove my 2 given cards from Binder', { removeGivenFromBinder: false, addReceivedToBinder: true }],
        ['not adding received cards', /Add their 1 card to my Binder/, { removeGivenFromBinder: true, addReceivedToBinder: false }],
    ])('respects %s', async (_label, checkbox, expected) => {
        renderSummary();
        const dialog = openConfirm();
        fireEvent.click(within(dialog).getByLabelText(checkbox));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() => expect(confirmTrade).toHaveBeenCalledWith(expect.objectContaining(expected)));
    });

    it('can record the trade without touching the Binder at all', async () => {
        renderSummary();
        const dialog = openConfirm();
        fireEvent.click(within(dialog).getByLabelText('Remove my 2 given cards from Binder'));
        fireEvent.click(within(dialog).getByLabelText(/Add their 1 card to my Binder/));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        await waitFor(() =>
            expect(confirmTrade).toHaveBeenCalledWith(
                expect.objectContaining({ removeGivenFromBinder: false, addReceivedToBinder: false }),
            ),
        );
    });

    it('disables the option for a side with no cards and never sends it', async () => {
        renderSummary({ wantList: [], wantTotal: 0, wantLowTotal: 0, diff: 9 });
        const dialog = openConfirm();

        const addReceived = within(dialog).getByLabelText(/Add their 0 cards to my Binder/);
        expect(addReceived).toBeDisabled();
        expect(addReceived).not.toBeChecked();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
        await waitFor(() =>
            expect(confirmTrade).toHaveBeenCalledWith(
                expect.objectContaining({ removeGivenFromBinder: true, addReceivedToBinder: false }),
            ),
        );
    });

    it('re-ticks the options each time the dialog opens', async () => {
        renderSummary();
        let dialog = openConfirm();
        fireEvent.click(within(dialog).getByLabelText('Remove my 2 given cards from Binder'));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        dialog = openConfirm();
        expect(within(dialog).getByLabelText('Remove my 2 given cards from Binder')).toBeChecked();
    });

    it('changes nothing when cancelled', () => {
        const { props } = renderSummary();
        const dialog = openConfirm();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

        expect(confirmTrade).not.toHaveBeenCalled();
        expect(props.clearTrade).not.toHaveBeenCalled();
    });

    it('locks the dialog while saving so a second tap cannot save twice', async () => {
        let finish;
        confirmTrade.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
        renderSummary();
        const dialog = openConfirm();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        const saving = await within(dialog).findByRole('button', { name: 'Confirming…' });
        expect(saving).toBeDisabled();
        expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
        expect(within(dialog).getByLabelText('Remove my 2 given cards from Binder')).toBeDisabled();
        fireEvent.click(saving);
        expect(confirmTrade).toHaveBeenCalledTimes(1);

        finish({ data: { id: 't1' }, error: null, trimmed: 0 });
        expect(await screen.findByText('Trade confirmed')).toBeInTheDocument();
    });

    it('tells a free user when an older trade rolled off', async () => {
        confirmTrade.mockResolvedValue({ data: { id: 't1' }, error: null, trimmed: 1 });
        renderSummary();
        fireEvent.click(within(openConfirm()).getByRole('button', { name: 'Confirm' }));

        expect(await screen.findByText(/The free plan keeps your last \d+ trades\./)).toBeInTheDocument();
    });

    it('keeps the trade and the dialog when saving fails', async () => {
        confirmTrade.mockResolvedValue({ data: null, error: { message: 'Network down' }, trimmed: 0 });
        const { props } = renderSummary();
        const dialog = openConfirm();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

        expect(await screen.findByText('Network down')).toBeInTheDocument();
        expect(props.clearTrade).not.toHaveBeenCalled();
        expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeEnabled();
    });

    it('falls back to a plain message when the failure has none', async () => {
        confirmTrade.mockResolvedValue({ data: null, error: {}, trimmed: 0 });
        renderSummary();
        fireEvent.click(within(openConfirm()).getByRole('button', { name: 'Confirm' }));

        expect(await screen.findByText('Failed to confirm trade')).toBeInTheDocument();
    });

    it('clears the calculator when the trade saved but the Binder did not update', async () => {
        confirmTrade.mockResolvedValue({ data: { id: 't1' }, error: {}, trimmed: 0, binderReconciled: false });
        const { props } = renderSummary();
        fireEvent.click(within(openConfirm()).getByRole('button', { name: 'Confirm' }));

        // Otherwise a retry would write the same trade to history twice.
        expect(await screen.findByText('Trade saved, but binder could not be updated')).toBeInTheDocument();
        expect(props.clearTrade).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Trade confirmed')).not.toBeInTheDocument();
    });
});
