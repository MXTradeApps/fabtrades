import { render, screen, waitFor } from '@testing-library/react';
import CardPriceAlerts, {
    alertConditionLabel,
    alertStatusLabel,
} from '../../src/components/cardDetail/CardPriceAlerts.jsx';

const mockList = jest.fn();

jest.mock('../../src/services/priceAlerts.js', () => ({
    listPriceAlertsForCard: (...args) => mockList(...args),
}));

const rise = {
    id: 'a1',
    card_id: 'card-1',
    direction: 'above',
    source: 'tcgplayer',
    target_price: 25,
    triggered_at: '2026-10-20T06:05:00Z',
    triggered_price: 26,
};
const drop = {
    id: 'a2',
    card_id: 'card-1',
    direction: 'below',
    source: 'cardmarket',
    target_price: 4,
    triggered_at: null,
    triggered_price: null,
};

describe('CardPriceAlerts', () => {
    beforeEach(() => {
        mockList.mockReset();
    });

    test('labels match the app wording and currency', () => {
        expect(alertConditionLabel(rise)).toBe('Rises to $25.00');
        expect(alertConditionLabel(drop)).toBe('Drops to €4.00');
        expect(alertStatusLabel(rise)).toBe('Hit Oct 20 at $26.00');
        expect(alertStatusLabel(drop)).toBe('Watching');
    });

    test('lists the signed-in user\'s alerts for the printing', async () => {
        mockList.mockResolvedValue({ data: [rise, drop], error: null });
        render(<CardPriceAlerts printingId="card-1" signedIn />);
        expect(await screen.findByText('Rises to $25.00')).toBeInTheDocument();
        expect(screen.getByText('Drops to €4.00')).toBeInTheDocument();
        expect(screen.getByText('Manage alerts in the FAB Trades app.')).toBeInTheDocument();
        expect(mockList).toHaveBeenCalledWith('card-1');
    });

    test('signed out, it does not query and renders nothing', async () => {
        const { container } = render(<CardPriceAlerts printingId="card-1" signedIn={false} />);
        await waitFor(() => expect(container).toBeEmptyDOMElement());
        expect(mockList).not.toHaveBeenCalled();
    });

    test('renders nothing when the user has no alerts on the card', async () => {
        mockList.mockResolvedValue({ data: [], error: null });
        const { container } = render(<CardPriceAlerts printingId="card-1" signedIn />);
        await waitFor(() => expect(mockList).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
