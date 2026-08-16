import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CardList from '../../src/components/ui/CardList.jsx';
import { PriceProvider } from '../../src/contexts/PriceContext.jsx';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';

const mockOpenDetail = jest.fn();

jest.mock('../../src/contexts/CardDetailContext.jsx', () => ({
  useCardDetail: () => ({ openDetail: mockOpenDetail }),
}));

jest.mock('../../src/hooks/useCardData.jsx', () => ({
  useCardData: () => ({
    cardIdLookup: {
      'a-normal': { _uniqueId: 'a-normal', name: 'Card A' },
      'b-rf': { _uniqueId: 'b-rf', name: 'Card B' },
    },
  }),
}));

jest.mock('../../src/components/ui/CardImagePreview.jsx', () => ({
  CardThumbnail: ({ alt, onClick }) => (
    <button type="button" onClick={onClick} aria-label={`Thumbnail ${alt}`}>
      thumb
    </button>
  ),
  CardImageModal: () => <div data-testid="art-only-modal" />,
}));

const cards = [
  { name: 'Card A', price: 10, quantity: 1, subTypeName: 'Normal', uniqueId: 'a-normal' },
  { name: 'Card B', price: 25, quantity: 2, subTypeName: 'Rainbow Foil', uniqueId: 'b-rf' },
];

const renderList = (props = {}) => {
  const merged = {
    cards,
    onRemoveCard: jest.fn(),
    onUpdateQuantity: jest.fn(),
    ...props,
  };
  const utils = render(
    <ThemeProvider theme={createTheme()}>
      <ThemeModeProvider>
        <PriceProvider>
          <CardList {...merged} />
        </PriceProvider>
      </ThemeModeProvider>
    </ThemeProvider>
  );
  return { ...utils, props: merged };
};

describe('CardList', () => {
  beforeEach(() => {
    mockOpenDetail.mockClear();
  });

  test('renders each card name', () => {
    renderList();
    expect(screen.getByText('Card A')).toBeInTheDocument();
    expect(screen.getByText('Card B')).toBeInTheDocument();
  });

  test('renders formatted prices for cards', () => {
    renderList();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$25')).toBeInTheDocument();
  });

  test('calls onRemoveCard with the card index when delete is clicked', () => {
    const { props } = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Card B' }));
    expect(props.onRemoveCard).toHaveBeenCalledWith(1);
  });

  test('renders an empty list without cards', () => {
    renderList({ cards: [] });
    expect(screen.queryByText('Card A')).not.toBeInTheDocument();
    expect(screen.getByText(/Search above to add cards/i)).toBeInTheDocument();
  });

  test('name and thumbnail open details, not an art-only overlay', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'View details for Card A' }));
    expect(mockOpenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ _uniqueId: 'a-normal', name: 'Card A' }),
    );
    expect(screen.queryByTestId('art-only-modal')).not.toBeInTheDocument();

    mockOpenDetail.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Thumbnail Card A' }));
    expect(mockOpenDetail).toHaveBeenCalled();
  });

  test('renders grid tiles that open details from the thumbnail', () => {
    renderList({ viewMode: 'grid' });
    expect(screen.getByText('Card A')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'View details for Card A' })[0]);
    expect(mockOpenDetail).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete Card B' })).toBeInTheDocument();
    expect(screen.queryByTestId('art-only-modal')).not.toBeInTheDocument();
  });
});
