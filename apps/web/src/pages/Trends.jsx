import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    Container,
    TextField,
    InputAdornment,
    Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import Header from '../components/elements/Header.jsx';
import RecentMoversSection from '../components/movers/RecentMoversSection.jsx';
import MoverBox, { moverBoxGridSx } from '../components/movers/MoverBox.jsx';
import { useCardData } from '../hooks/useCardData.jsx';
import { useThemeMode } from '../contexts/ThemeContext.jsx';
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
    const { isDark } = useThemeMode();
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

    const bgGradient = isDark
        ? 'linear-gradient(135deg, #0d0806 0%, #1a0f0a 50%, #2c1810 100%)'
        : 'linear-gradient(135deg, #f5f1ed 0%, #e8dfd6 50%, #f0e6dc 100%)';
    const textColor = isDark ? '#f5f1ed' : '#2c1810';
    const mutedColor = isDark ? '#d4a574' : '#5d3a1a';

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
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            background: bgGradient,
            backgroundAttachment: 'fixed',
        }}>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
            <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, pb: 8 }}>
                <Box sx={{ mb: 3 }}>
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            color: textColor,
                            mb: 0.5,
                            fontSize: { xs: '1.5rem', md: '2rem' },
                        }}
                    >
                        Trends
                    </Typography>
                    <Typography variant="body2" sx={{ color: mutedColor }}>
                        Recent movers across the catalog, from observed Lows.
                    </Typography>
                </Box>

                <TextField
                    fullWidth
                    placeholder="Search all cards…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: isDark ? 'rgba(44, 24, 16, 0.6)' : '#ffffff',
                            '& fieldset': {
                                borderColor: isDark ? 'rgba(212, 165, 116, 0.3)' : 'rgba(139, 69, 19, 0.3)',
                            },
                        },
                        '& input': { color: textColor },
                    }}
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
                                            isDark={isDark}
                                            textColor={textColor}
                                            mutedColor={mutedColor}
                                            priceSource={priceSource}
                                        />
                                    );
                                })}
                            </Box>
                        </Box>
                    )
                ) : null}
            </Container>
        </Box>
    );
};

export default Trends;
