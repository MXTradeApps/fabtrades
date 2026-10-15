import { useEffect, useRef } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useLocation } from 'react-router-dom';
import { useCardData } from "../hooks/useCardData.jsx";
import { useTradeState } from "../hooks/useTradeState.js";
import Header from "../components/elements/Header.jsx";
import CardPanel from "../components/ui/CardPanel.jsx";
import TradeSummary from "../components/elements/TradeSummary.jsx";
import { EmptyState } from "../components/layout/Page.jsx";
import { useCardDetail } from "../contexts/CardDetailContext.jsx";

const Home = () => {
    const location = useLocation();

    // Side-by-side layout needs a landscape window with room for both panels
    // next to the sidebar; everything else stacks the two sides vertically.
    const isLandscape = useMediaQuery('(min-aspect-ratio: 4/3) and (min-width: 1100px)');
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

    if (error) {
        return (
            <>
                <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
                <EmptyState
                    icon={<ErrorOutlineIcon />}
                    title="Couldn’t load card prices"
                    sx={{ minHeight: 'calc(100dvh - var(--shell-top) - var(--shell-bottom))', justifyContent: 'center' }}
                >
                    {error}
                </EmptyState>
            </>
        );
    }

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />

            <Box
                component="main"
                sx={{
                    display: 'flex',
                    flexDirection: isLandscape ? 'row' : 'column',
                    alignItems: 'stretch',
                    width: '100%',
                    // Fill the viewport between the shell bars so each side scrolls on its own.
                    height: isLandscape ? 'calc(100dvh - var(--shell-top) - var(--shell-bottom))' : 'auto',
                    minHeight: isLandscape ? 0 : 'calc(100dvh - var(--shell-top) - var(--shell-bottom))',
                    gap: isLandscape ? 2 : 0,
                    p: isLandscape ? { xs: 1.5, md: 2.5 } : 0,
                }}
            >
                <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    Trade Calculator
                </h1>
                <CardPanel
                    title="Cards I Have"
                    tone="have"
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
                    tone="want"
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
        </>
    );
};

export default Home;
