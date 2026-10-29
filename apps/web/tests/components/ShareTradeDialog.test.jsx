import { fireEvent, render, screen } from '@testing-library/react';
import ShareTradeDialog from '../../src/components/elements/ShareTradeDialog.jsx';

const items = [{ name: 'Sink Below (Red)', finish: 'Normal', quantity: 1, price: 4.5 }];
const wants = [{ name: 'Enlightened Strike (Red)', finish: 'Rainbow Foil', quantity: 1, price: 3 }];
const getLink = (mode) => `https://fabtrades.net/?trade=${mode}`;

describe('ShareTradeDialog', () => {
    it('writes a WTT post ending in the trade link', () => {
        render(<ShareTradeDialog open onClose={jest.fn()} items={items} wants={wants} getLink={getLink} />);
        const preview = screen.getByTestId('share-trade-preview-0').textContent;
        expect(preview).toMatch(/^WTT - /);
        expect(preview).toContain('Looking for:\nRF Enlightened Strike (Red)');
        expect(preview).not.toContain('$');
        expect(preview.endsWith('See the trade: https://fabtrades.net/?trade=wtt')).toBe(true);
        expect(screen.queryByText('Asking price')).not.toBeInTheDocument();
        expect(screen.queryByText('Discord')).not.toBeInTheDocument();
    });

    it('switches to a priced WTS post with its own link', () => {
        render(<ShareTradeDialog open onClose={jest.fn()} items={items} wants={wants} getLink={getLink} />);
        fireEvent.click(screen.getByTestId('share-trade-mode-wts'));
        const preview = screen.getByTestId('share-trade-preview-0').textContent;
        expect(preview).toMatch(/^WTS - /);
        expect(preview).toContain('NF Sink Below (Red) $4.50');
        expect(preview).not.toContain('Enlightened Strike');
        expect(preview.endsWith('?trade=wts')).toBe(true);
        expect(screen.getByText('Asking price')).toBeInTheDocument();
    });

    it('opens on WTS when there are only cards to sell', () => {
        render(<ShareTradeDialog open onClose={jest.fn()} items={items} wants={[]} getLink={getLink} />);
        expect(screen.getByTestId('share-trade-preview-0').textContent).toMatch(/^WTS - /);
    });

    it('copies just the link', async () => {
        const writeText = jest.fn().mockResolvedValue();
        Object.assign(navigator, { clipboard: { writeText } });
        render(<ShareTradeDialog open onClose={jest.fn()} items={items} wants={wants} getLink={getLink} />);
        fireEvent.click(screen.getByTestId('share-trade-copy-link'));
        expect(writeText).toHaveBeenCalledWith('https://fabtrades.net/?trade=wtt');
        expect(await screen.findByText('Link copied')).toBeInTheDocument();
    });
});
