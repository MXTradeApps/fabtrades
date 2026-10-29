import { fireEvent, render, screen } from '@testing-library/react';
import SalePostDialog from '../../src/components/binder/SalePostDialog.jsx';

const items = [{ name: 'Sink Below (Red)', finish: 'Normal', quantity: 1, price: 4.5 }];

describe('SalePostDialog', () => {
    it('writes a WTS post for Discord by default', () => {
        render(<SalePostDialog open onClose={jest.fn()} items={items} />);
        expect(screen.getByText('Post for sale')).toBeInTheDocument();
        expect(screen.getByTestId('sale-post-preview-0').textContent).toMatch(/^\*\*WTS\*\*/);
    });

    it('switches to the Facebook format', () => {
        render(<SalePostDialog open onClose={jest.fn()} items={items} />);
        fireEvent.click(screen.getByTestId('sale-post-facebook'));
        expect(screen.getByTestId('sale-post-preview-0').textContent).toMatch(/^WTS - Flesh and Blood singles/);
    });
});
