import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SearchOption from '../../src/components/search/SearchOption.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { PriceProvider } from '../../src/contexts/PriceContext.jsx';
import { pricedPrinting } from '../fixtures/printings.js';

const mockOpenDetail = jest.fn();

jest.mock('../../src/contexts/CardDetailContext.jsx', () => ({
    useCardDetail: () => ({ openDetail: mockOpenDetail }),
}));

jest.mock('../../src/components/ui/CardImagePreview.jsx', () => ({
    CardThumbnail: ({ alt, onClick }) => (
        <button type="button" onClick={onClick} aria-label={`Thumbnail ${alt}`}>
            thumb
        </button>
    ),
}));

const option = {
    label: pricedPrinting.displayName,
    subTypeName: pricedPrinting.subTypeName,
    setName: pricedPrinting._setName,
    card: pricedPrinting,
};

const renderOption = (props = {}) => {
    const onClick = jest.fn();
    render(
        <ThemeProvider theme={createTheme()}>
            <ThemeModeProvider>
                <PriceProvider>
                    <SearchOption
                        option={option}
                        searchTerm=""
                        onClick={onClick}
                        {...props}
                    />
                </PriceProvider>
            </ThemeModeProvider>
        </ThemeProvider>,
    );
    return { onClick };
};

describe('SearchOption', () => {
    beforeEach(() => {
        mockOpenDetail.mockClear();
    });

    test('activating the name opens details and does not add', () => {
        const { onClick } = renderOption();
        fireEvent.click(screen.getByRole('button', { name: /View details for Lightning Press/ }));
        expect(mockOpenDetail).toHaveBeenCalledWith(pricedPrinting);
        expect(onClick).not.toHaveBeenCalled();
    });

    test('activating the thumbnail opens details and does not add', () => {
        const { onClick } = renderOption();
        fireEvent.click(screen.getByRole('button', { name: /Thumbnail/ }));
        expect(mockOpenDetail).toHaveBeenCalledWith(pricedPrinting);
        expect(onClick).not.toHaveBeenCalled();
    });

    test('the remaining add control still selects', () => {
        const { onClick } = renderOption();
        fireEvent.click(screen.getByRole('button', { name: 'Add Lightning Press (SUP001)' }));
        expect(onClick).toHaveBeenCalled();
        expect(mockOpenDetail).not.toHaveBeenCalled();
    });
});
