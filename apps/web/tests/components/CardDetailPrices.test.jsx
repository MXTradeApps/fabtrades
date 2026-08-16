import { formatCatalogPrice } from '../../src/components/cardDetail/CardDetailPrices.jsx';
import { pricedPrinting, unpricedPrinting } from '../fixtures/printings.js';

describe('formatCatalogPrice', () => {
    test('renders null and 0 as an em dash, never $0.00 or €0.00', () => {
        expect(formatCatalogPrice(null, 'USD')).toBe('—');
        expect(formatCatalogPrice(0, 'USD')).toBe('—');
        expect(formatCatalogPrice(undefined, 'USD')).toBe('—');
        expect(formatCatalogPrice(null, 'EUR')).toBe('—');
        expect(formatCatalogPrice(0, 'EUR')).toBe('—');
        expect(formatCatalogPrice(unpricedPrinting.marketPrice, 'USD')).toBe('—');
        expect(formatCatalogPrice(unpricedPrinting.cardmarketTrend, 'EUR')).toBe('—');
        expect(formatCatalogPrice(unpricedPrinting.cardmarketLow, 'EUR')).toBe('—');

        expect(formatCatalogPrice(null, 'USD')).not.toBe('$0.00');
        expect(formatCatalogPrice(0, 'USD')).not.toBe('$0.00');
        expect(formatCatalogPrice(null, 'EUR')).not.toBe('€0.00');
        expect(formatCatalogPrice(0, 'EUR')).not.toBe('€0.00');
    });

    test('formats observed catalog values with the marketplace currency', () => {
        expect(formatCatalogPrice(pricedPrinting.marketPrice, 'USD')).toBe('$12.50');
        expect(formatCatalogPrice(pricedPrinting.cardmarketTrend, 'EUR')).toBe('€10.20');
    });
});
