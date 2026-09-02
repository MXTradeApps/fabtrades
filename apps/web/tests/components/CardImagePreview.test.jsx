import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ThemeModeProvider } from '../../src/contexts/ThemeContext.jsx';
import { CardThumbnail } from '../../src/components/ui/CardImagePreview.jsx';

const wrap = (ui) => render(
    <ThemeProvider theme={createTheme()}>
        <ThemeModeProvider>
            {ui}
        </ThemeModeProvider>
    </ThemeProvider>,
);

describe('CardThumbnail', () => {
    const completeDesc = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'complete',
    );
    const widthDesc = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'naturalWidth',
    );
    const decodeDesc = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'decode',
    );

    afterEach(() => {
        if (completeDesc) {
            Object.defineProperty(HTMLImageElement.prototype, 'complete', completeDesc);
        }
        if (widthDesc) {
            Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', widthDesc);
        }
        if (decodeDesc) {
            Object.defineProperty(HTMLImageElement.prototype, 'decode', decodeDesc);
        } else {
            delete HTMLImageElement.prototype.decode;
        }
    });

    test('reveals a cached image when onLoad does not fire', () => {
        Object.defineProperty(HTMLImageElement.prototype, 'complete', {
            configurable: true,
            get() { return true; },
        });
        Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
            configurable: true,
            get() { return 120; },
        });

        wrap(
            <CardThumbnail
                imageUrl="https://example.test/card.webp"
                alt="Cached card"
            />,
        );

        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Cached card' })).toHaveAttribute(
            'src',
            'https://example.test/card.webp',
        );
    });

    test('shows a loading overlay until a network image reports load', () => {
        Object.defineProperty(HTMLImageElement.prototype, 'complete', {
            configurable: true,
            get() { return false; },
        });
        Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
            configurable: true,
            get() { return 0; },
        });
        HTMLImageElement.prototype.decode = jest.fn(() => new Promise(() => {}));

        wrap(
            <CardThumbnail
                imageUrl="https://example.test/card.webp"
                alt="Pending card"
            />,
        );

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Pending card' })).toBeInTheDocument();
    });
});
