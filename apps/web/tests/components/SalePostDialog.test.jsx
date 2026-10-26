import { fireEvent, render, screen } from '@testing-library/react';
import SalePostDialog from '../../src/components/binder/SalePostDialog.jsx';

const items = [{ name: 'Sink Below (Red)', finish: 'Normal', quantity: 1, price: 4.5 }];
const wants = [{ name: 'Enlightened Strike (Red)', finish: 'Rainbow Foil', quantity: 1, price: 3 }];

describe('SalePostDialog', () => {
    it('stays a plain sale post without wants', () => {
        render(<SalePostDialog open onClose={jest.fn()} items={items} />);
        expect(screen.getByText('Post for sale')).toBeInTheDocument();
        expect(screen.queryByTestId('sale-post-mode-wtt')).not.toBeInTheDocument();
        expect(screen.getByTestId('sale-post-preview-0').textContent).toMatch(/^\*\*WTS\*\*/);
    });

    it('writes a WTT/WTS post from wants and haves', () => {
        render(<SalePostDialog open onClose={jest.fn()} items={items} wants={wants} />);
        expect(screen.getByText('Trade post')).toBeInTheDocument();
        const preview = screen.getByTestId('sale-post-preview-0').textContent;
        expect(preview).toMatch(/^\*\*WTT\/WTS\*\*/);
        expect(preview).toContain('**Looking for**\nRF Enlightened Strike (Red)');
        expect(preview).toContain('**Have**\nNF Sink Below (Red) $4.50');
    });

    it('hides prices and the price picker in WTT mode', () => {
        render(<SalePostDialog open onClose={jest.fn()} items={items} wants={wants} />);
        fireEvent.click(screen.getByTestId('sale-post-mode-wtt'));
        expect(screen.queryByText('Asking price')).not.toBeInTheDocument();
        expect(screen.getByTestId('sale-post-preview-0').textContent).not.toContain('$');
    });

    it('explains an empty WTS post when the trade has no haves', () => {
        render(<SalePostDialog open onClose={jest.fn()} items={[]} wants={wants} />);
        fireEvent.click(screen.getByTestId('sale-post-mode-wts'));
        expect(screen.getByText('Add cards you have to the trade to post them for sale.')).toBeInTheDocument();
        expect(screen.queryByTestId('sale-post-preview-0')).not.toBeInTheDocument();
    });
});
