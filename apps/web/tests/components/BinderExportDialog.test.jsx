import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BinderExportDialog from '../../src/components/binder/BinderExportDialog.jsx';

const entries = [{
    cardId: 'sink-red',
    quantity: 2,
    condition: 'LP',
    card: { name: 'Sink Below (Red)', collectorNumber: 'MON291', subTypeName: 'Normal', tcgMarket: 0.5 },
}];

const renderDialog = (props = {}) => render(
    <BinderExportDialog open onClose={jest.fn()} title="Trade Binder" entries={entries} resolveCard={() => null} {...props} />,
);

describe('BinderExportDialog', () => {
    it('previews plain text with prices by default', () => {
        renderDialog();
        expect(screen.getByTestId('binder-export-preview').textContent)
            .toContain('2x Sink Below (Red) - $0.50 each - MON291');
        expect(screen.queryByTestId('binder-export-copy-binder')).not.toBeInTheDocument();
    });

    it('switches to Discord and adds condition', () => {
        renderDialog();
        fireEvent.click(within(screen.getByTestId('binder-export-format-discord')).getByRole('radio'));
        fireEvent.click(screen.getByTestId('binder-export-condition'));
        expect(screen.getByTestId('binder-export-preview').textContent)
            .toContain('**2x Sink Below (Red)** - $0.50 each - MON291 (LP)');
    });

    it('offers a personal copy when given one', async () => {
        const onCopyBinder = jest.fn().mockResolvedValue();
        renderDialog({ onCopyBinder });
        fireEvent.click(screen.getByTestId('binder-export-copy-binder'));
        await waitFor(() => expect(onCopyBinder).toHaveBeenCalled());
    });
});

describe('BinderExportDialog filters and limits', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
        cardId: `card-${i}`,
        quantity: 1,
        condition: 'NM',
        card: { name: `Some Long Card Name Number ${i}`, collectorNumber: `ABC${i}`, subTypeName: 'Rainbow Foil', tcgMarket: 1 },
    }));

    it('exports only the filtered cards unless told otherwise', () => {
        renderDialog({ entries: many, filteredEntries: many.slice(0, 2) });
        expect(screen.getByText('Only the cards shown (2 of 60)')).toBeInTheDocument();
        expect(screen.getByTestId('binder-export-preview').textContent).not.toContain('Number 5 ');
        fireEvent.click(screen.getByTestId('binder-export-only-filtered'));
        expect(screen.getByTestId('binder-export-preview').textContent).toContain('Number 59');
    });

    it('hides condition when every card is NM and warns past Discord’s limit', () => {
        renderDialog({ entries: many });
        expect(screen.queryByTestId('binder-export-condition')).not.toBeInTheDocument();
        fireEvent.click(within(screen.getByTestId('binder-export-format-discord')).getByRole('radio'));
        expect(screen.getByTestId('binder-export-discord-limit')).toBeInTheDocument();
    });
});
