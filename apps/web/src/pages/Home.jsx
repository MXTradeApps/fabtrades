import { useEffect, useRef } from 'react';
import { Box, Typography, useMediaQuery } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useCardData } from "../hooks/useCardData.jsx";
import { useTradeState } from "../hooks/useTradeState.js";
import Header from "../components/elements/Header.jsx";
import CardPanel from "../components/ui/CardPanel.jsx";
import TradeSummary from "../components/elements/TradeSummary.jsx";
import { useThemeMode } from "../contexts/ThemeContext.jsx";
import { useCardDetail } from "../contexts/CardDetailContext.jsx";

const Home = () => {
    const location = useLocation();
    const { isDark } = useThemeMode();

    // Detect landscape vs portrait orientation using aspect ratio
    const isLandscape = useMediaQuery('(min-aspect-ratio: 4/3)');
    // Stacked mobile layout uses the denser list; desktop/landscape gets the card grid.
    const panelView = isLandscape ? 'grid' : 'list';

    const {
        cardGroups,
        cardIdLookup,
        cards,
        dataReady,
        error,
        pricesUpdatedAt: lastUpdatedTimestamp
    } = useCardData();
    
    // Create unique card options that include all editions
    const cardOptions = cards.map(card => ({
        label: card.displayName,
        value: card._uniqueDisplayId,
        subTypeName: card.subTypeName,
        setName: card._setName || '',
        card: card
    }));

    const tradeState = useTradeState(cardGroups, cardIdLookup);
    const { registerAddWant } = useCardDetail();
    const addWantRef = useRef(tradeState.addWantCard);
    addWantRef.current = tradeState.addWantCard;

    useEffect(() => {
        return registerAddWant((payload) => addWantRef.current(payload));
    }, [registerAddWant]);

    // Load trade from navigation state (when coming from history page)
    useEffect(() => {
        if (location.state?.loadTrade && tradeState.loadTradeFromHistory && dataReady) {
            tradeState.loadTradeFromHistory(location.state.loadTrade);
            // Clear the state to prevent reloading on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state?.loadTrade, dataReady]);

    // Background gradients based on theme - FAB brown/cream
    const bgGradient = isDark 
        ? 'linear-gradient(135deg, #0d0806 0%, #1a0f0a 50%, #2c1810 100%)'
        : 'linear-gradient(135deg, #f5f1ed 0%, #e8dfd6 50%, #f0e6dc 100%)';

    if (error) {
        return (
            <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100vh', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: bgGradient
            }}>
                <Typography variant="h6" color="error" sx={{ mb: 2 }}>
                    Error loading card data
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {error}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: 'calc(100vh - 28px)', 
            width: '100%',
            background: bgGradient,
            backgroundAttachment: 'fixed'
        }}>
            <Header 
                lastUpdatedTimestamp={lastUpdatedTimestamp}
            />

            {/* Content */}
            <Box sx={{ 
                display: 'flex', 
                flexGrow: 1, 
                flexDirection: isLandscape ? 'row' : 'column',
                alignItems: isLandscape ? 'stretch' : 'stretch',
                width: '100%',
                minHeight: 0,
                gap: isLandscape ? 1.25 : 0,
                p: isLandscape ? 1.25 : 0
            }}>
                <CardPanel
                    title="Cards I Have"
                    cards={tradeState.haveList}
                    cardOptions={cardOptions}
                    inputValue={tradeState.haveInput}
                    onInputChange={(e, v) => tradeState.setHaveInput(v || "")}
                    onAddCard={tradeState.addHaveCard}
                    onRemoveCard={tradeState.removeHaveCard}
                    onUpdateQuantity={tradeState.updateHaveCardQuantity}
                    disabled={!dataReady}
                    isLandscape={isLandscape}
                    viewMode={panelView}
                />

                <TradeSummary
                    haveList={tradeState.haveList}
                    wantList={tradeState.wantList}
                    haveTotal={tradeState.haveTotal}
                    wantTotal={tradeState.wantTotal}
                    haveLowTotal={tradeState.haveLowTotal}
                    wantLowTotal={tradeState.wantLowTotal}
                    diff={tradeState.diff}
                    lowDiff={tradeState.lowDiff}
                    isLandscape={isLandscape}
                    clearURLTradeData={tradeState.clearURLTradeData}
                    clearTrade={tradeState.clearTrade}
                    urlTradeData={tradeState.urlTradeData}
                    hasLoadedFromURL={tradeState.hasLoadedFromURL}
                />

                <CardPanel
                    title="Cards I Want"
                    cards={tradeState.wantList}
                    cardOptions={cardOptions}
                    inputValue={tradeState.wantInput}
                    onInputChange={(e, v) => tradeState.setWantInput(v || "")}
                    onAddCard={tradeState.addWantCard}
                    onRemoveCard={tradeState.removeWantCard}
                    onUpdateQuantity={tradeState.updateWantCardQuantity}
                    disabled={!dataReady}
                    isLandscape={isLandscape}
                    viewMode={panelView}
                />
            </Box>
        </Box>
    );
};

export default Home;
