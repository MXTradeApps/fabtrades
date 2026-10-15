import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    TextField,
    InputAdornment,
    Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import Header from '../components/elements/Header.jsx';
import { Page, PageHeader } from '../components/layout/Page.jsx';
import RecentMoversSection from '../components/movers/RecentMoversSection.jsx';
import MoverBox from '../components/movers/MoverBox.jsx';
import { moverBoxGridSx } from '../components/movers/moverBoxStyles.js';
import { useCardData } from '../hooks/useCardData.jsx';
import { usePriceType } from '../contexts/PriceContext.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import { useDocumentHead } from '../utils/seo.js';
import { matchPrintings } from '../utils/searchUtils.js';
import { printingRecentChanges } from '../services/fabDb.js';

const catalogLow = (printing, priceSource) => (
    priceSource === 'cardmarket' ? printing.cardmarketLow : printing.lowPrice
);

const Trends = () => {
    const { cards, cardIdLookup, pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();
    const { priceSource } = usePriceType();
    const { openDetail } = useCardDetail();
    const [query, setQuery] = useState('');
    const [overlays, setOverlays] = useState([]);
    const [overlayError, setOverlayError] = useState(null);
    const overlayGen = useRef(0);

    useDocumentHead({
        title: 'Recent movers',
        description:
            'See recent Flesh and Blood card gainers and losers from observed catalog Lows.',
        canonicalPath: '/trends',
    });

    const searching = query.trim().length > 0;
    const printings = useMemo(
        () => (searching ? matchPrintings(cards, query) : []),
        [cards, query, searching],
    );
    const printingIds = useMemo(
        () => printings.map((p) => p._uniqueId),
        [printings],
    );

    const loadOverlays = (ids, source, gen) => {
        printingRecentChanges(source, ids)
            .then((rows) => {
                if (gen !== overlayGen.current) return;
                setOverlays(Array.isArray(rows) ? rows : []);
                setOverlayError(null);
            })
            .catch((error) => {
                if (gen !== overlayGen.current) return;
                setOverlays([]);
                setOverlayError(error);
            });
    };

    useEffect(() => {
        if (!searching || printingIds.length === 0) {
            overlayGen.current += 1;
            setOverlays([]);
            setOverlayError(null);
            return undefined;
        }
        const gen = ++overlayGen.current;
        setOverlayError(null);
        const timer = setTimeout(() => {
            loadOverlays(printingIds, priceSource, gen);
        }, 300);
        return () => {
            clearTimeout(timer);
            overlayGen.current += 1;
        };
    }, [searching, printingIds, priceSource]);

    const overlayById = useMemo(() => {
        const map = new Map();
        for (const row of overlays) {
            if (row?.card_id) map.set(row.card_id, row);
        }
        return map;
    }, [overlays]);

    const textColor = 'text.primary';
    const mutedColor = 'text.secondary';

    const openPrinting = (printing) => {
        const snapshot = cardIdLookup?.[printing._uniqueId] || printing;
        openDetail(snapshot);
    };

    const retryOverlays = () => {
        if (!printingIds.length) return;
        const gen = ++overlayGen.current;
        setOverlayError(null);
        loadOverlays(printingIds, priceSource, gen);
    };

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
            <Page>
                <PageHeader
                    title="Trends"
                    subtitle="Recent movers across the catalog, from observed Lows."
                />

                <TextField
                    fullWidth
                    placeholder="Search all cards…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    inputProps={{ 'aria-label': 'Search all cards' }}
                    sx={{ mb: 3, maxWidth: 640 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: mutedColor }} />
                            </InputAdornment>
                        ),
                    }}
                />

                <Box
                    aria-hidden={searching || undefined}
                    data-movers-hidden={searching ? 'true' : undefined}
                    sx={searching ? {
                        position: 'absolute',
                        visibility: 'hidden',
                        pointerEvents: 'none',
                        height: 0,
                        overflow: 'hidden',
                        width: '100%',
                    } : undefined}
                >
                    <RecentMoversSection />
                </Box>
                {searching ? (
                    printings.length === 0 ? (
                        <Typography variant="body2" sx={{ color: mutedColor, py: 2 }}>
                            No Printings match your search.
                        </Typography>
                    ) : (
                        <Box>
                            {overlayError ? (
                                <Box sx={{ textAlign: 'center', py: 1, mb: 1 }}>
                                    <Typography variant="body2" sx={{ color: textColor, mb: 0.5 }}>
                                        Couldn’t load recent changes.
                                    </Typography>
                                    <Button onClick={retryOverlays}>Retry</Button>
                                </Box>
                            ) : null}
                            <Box data-testid="search-trend-boxes" sx={moverBoxGridSx}>
                                {printings.map((printing) => {
                                    const overlay = overlayById.get(printing._uniqueId);
                                    return (
                                        <MoverBox
                                            key={printing._uniqueId}
                                            name={printing.name}
                                            setName={printing._setName}
                                            finish={printing.subTypeName}
                                            imageUrl={printing.imageUrl}
                                            fallbackUrl={printing.imageUrlFallback || printing.imageUrl}
                                            currentLow={catalogLow(printing, priceSource)}
                                            percentChange={overlay?.percent_change}
                                            amountChange={overlay?.amount_change}
                                            onSelect={() => openPrinting(printing)}
                                            priceSource={priceSource}
                                        />
                                    );
                                })}
                            </Box>
                        </Box>
                    )
                ) : null}
            </Page>
        </>
    );
};

export default Trends;
