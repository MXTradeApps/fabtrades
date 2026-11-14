import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './index.css'
import App from './App.jsx'
import { CardDataProvider } from "./hooks/useCardData.jsx";
import { PriceProvider } from "./contexts/PriceContext.jsx";
import { ThemeModeProvider, useThemeMode } from "./contexts/ThemeContext.jsx";
import { landingPath } from "./utils/analytics.js";

// Remember the page this visit started on before any navigation happens.
landingPath();

// Wrapper component that applies the dynamic theme
const ThemedApp = () => {
    const { theme } = useThemeMode();
    
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <PriceProvider>
                <CardDataProvider>
                    <App />
                </CardDataProvider>
            </PriceProvider>
        </ThemeProvider>
    );
};

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ThemeModeProvider>
            <ThemedApp />
        </ThemeModeProvider>
    </StrictMode>,
)

// Build-time SEO prerendering injects a static, crawlable copy of the page into
// #seo-prerender. Once the interactive app has mounted we remove it so real
// users don't see duplicated content.
const seoNode = document.getElementById('seo-prerender');
if (seoNode) seoNode.remove();
