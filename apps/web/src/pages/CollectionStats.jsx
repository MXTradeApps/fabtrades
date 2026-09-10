import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Container,
    Paper,
    Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Header from '../components/elements/Header.jsx';
import MoverBox from '../components/movers/MoverBox.jsx';
import { moverBoxGridSx } from '../components/movers/moverBoxStyles.js';
import SignInDialog from '../components/auth/SignInDialog.jsx';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext.jsx';
import { usePriceType } from '../contexts/PriceContext.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import { useCardData } from '../hooks/useCardData.jsx';
import { useDocumentHead } from '../utils/seo.js';
import { getOpenBinderId, targetOwnedBinderId } from '../utils/openBinder.js';
import {
    chosenSourceHeadlineAmount,
    snapshotEntryFromBinder,
} from '../utils/binderValueSnapshot.js';
import { copiesByPrintingId, ownedPrintingIds, splitMoversByDirection } from '../utils/recentMovers.js';
import { formatCatalogPrice } from '../components/cardDetail/CardDetailPrices.jsx';
import { getBinderEntries, getBinders, TRADE_BINDER_ID } from '../services/binder.js';
import { recentMovers } from '../services/fabDb.js';

const sourceLabel = (priceSource) =>
    priceSource === 'cardmarket' ? 'CardMarket' : 'TCGplayer';

const CollectionStats = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isDark } = useThemeMode();
    const { priceSource } = usePriceType();
    const { openDetail } = useCardDetail();
    const { cards, cardIdLookup, pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();
    const [signInOpen, setSignInOpen] = useState(false);
    const [entries, setEntries] = useState([]);
    const [binders, setBinders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [moverRows, setMoverRows] = useState([]);
    const [moversLoading, setMoversLoading] = useState(false);
    const [moversError, setMoversError] = useState(null);
    const moversGen = useRef(0);
    const moversCache = useRef(new Map());

    const binderId = getOpenBinderId() || targetOwnedBinderId() || TRADE_BINDER_ID;

    useDocumentHead({
        title: 'Collection Stats',
        description: 'Current Binder value, recent movers, and snapshot stats.',
        canonicalPath: '/binder',
    });

    const bgGradient = isDark
        ? 'linear-gradient(135deg, #0d0806 0%, #1a0f0a 50%, #2c1810 100%)'
        : 'linear-gradient(135deg, #f5f1ed 0%, #e8dfd6 50%, #f0e6dc 100%)';
    const textColor = isDark ? '#f5f1ed' : '#2c1810';
    const mutedColor = isDark ? '#d4a574' : '#5d3a1a';
    const accentColor = isDark ? '#e4c09c' : '#8b4513';
    const paperBg = isDark ? 'rgba(44, 24, 16, 0.6)' : '#ffffff';
    const paperBorder = isDark ? 'rgba(212, 165, 116, 0.2)' : 'rgba(139, 69, 19, 0.15)';

    const catalogById = useMemo(() => {
        const map = new Map();
        for (const card of cards || []) {
            if (card._uniqueId) map.set(card._uniqueId, card);
        }
        return map;
    }, [cards]);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            setEntries([]);
            return undefined;
        }
        let cancelled = false;
        setLoading(true);
        Promise.all([getBinderEntries(), getBinders()]).then(([entryRes, binderRes]) => {
            if (cancelled) return;
            const owned = (entryRes.data?.binder || []).filter(
                (e) => (e.binderId || TRADE_BINDER_ID) === binderId,
            );
            setEntries(owned);
            setBinders(binderRes.data?.binders || []);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [user, binderId]);

    useEffect(() => {
        if (!user || loading) return;
        if (entries.length === 0) {
            navigate('/binder', { replace: true });
        }
    }, [user, loading, entries.length, navigate]);

    const rows = useMemo(
        () =>
            entries.map((entry) =>
                snapshotEntryFromBinder(
                    entry,
                    catalogById instanceof Map ? catalogById.get(entry.cardId) : catalogById?.[entry.cardId],
                ),
            ),
        [entries, catalogById],
    );

    const usdAmount = useMemo(
        () => chosenSourceHeadlineAmount(rows, { source: 'tcgplayer', headline: 'pricingValue' }),
        [rows],
    );
    const eurAmount = useMemo(
        () => chosenSourceHeadlineAmount(rows, { source: 'cardmarket', headline: 'pricingValue' }),
        [rows],
    );

    const ids = useMemo(() => ownedPrintingIds(entries), [entries]);
    const copies = useMemo(() => copiesByPrintingId(entries), [entries]);
    const idsKey = useMemo(() => [...ids].sort().join(','), [ids]);
    const label = sourceLabel(priceSource);
    const sectionSx = {
        p: 2.5,
        mb: 2,
        backgroundColor: paperBg,
        border: `1px solid ${paperBorder}`,
        borderRadius: 3,
    };
    const binderName =
        binders.find((b) => b.clientId === binderId && !b.deletedAt)?.name || 'Binder';

    const loadMovers = useCallback(() => {
        const gen = ++moversGen.current;
        if (!ids.length) {
            setMoverRows([]);
            setMoversError(null);
            setMoversLoading(false);
            return;
        }
        const cacheKey = `${priceSource}:${idsKey}`;
        const cached = moversCache.current.get(cacheKey);
        if (cached) {
            setMoverRows(cached);
            setMoversError(null);
            setMoversLoading(false);
            return;
        }
        setMoversLoading(true);
        setMoversError(null);
        recentMovers(priceSource, ids)
            .then((fetched) => {
                if (gen !== moversGen.current) return;
                const list = Array.isArray(fetched) ? fetched : [];
                moversCache.current.set(cacheKey, list);
                setMoverRows(list);
            })
            .catch((error) => {
                if (gen !== moversGen.current) return;
                setMoversError(error);
            })
            .finally(() => {
                if (gen !== moversGen.current) return;
                setMoversLoading(false);
            });
    }, [ids, idsKey, priceSource]);

    useEffect(() => {
        loadMovers();
        return () => {
            moversGen.current += 1;
        };
    }, [loadMovers]);

    const openPrinting = (cardId) => {
        const printing = cardIdLookup?.[cardId] || catalogById.get(cardId);
        if (printing) openDetail(printing);
    };

    const visibleRows = moverRows.filter((row) => (copies[row.card_id] || 0) > 0);
    const { gainers, losers } = splitMoversByDirection(visibleRows);

    const goBack = () => {
        navigate(`/binder?b=${encodeURIComponent(binderId)}`);
    };

    if (!user) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100vh',
                    background: bgGradient,
                    backgroundAttachment: 'fixed',
                }}
            >
                <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
                <Container maxWidth="sm" sx={{ mt: 8 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            backgroundColor: paperBg,
                            border: `1px solid ${paperBorder}`,
                            borderRadius: 3,
                        }}
                    >
                        <Typography variant="h5" sx={{ mb: 2, color: accentColor, fontWeight: 700 }}>
                            Sign In Required
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 3, color: mutedColor }}>
                            Sign in to sync your binder across devices.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button variant="contained" onClick={() => setSignInOpen(true)}>
                                Sign in
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<ArrowBackIcon />}
                                onClick={() => navigate('/')}
                            >
                                Back
                            </Button>
                        </Box>
                    </Paper>
                </Container>
                <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
            </Box>
        );
    }

    const renderDirection = (kind, title, list, color, emptyCopy) => (
        <Box
            sx={{
                '&:not(:first-of-type)': {
                    mt: 2.5,
                    pt: 2.5,
                    borderTop: `1px solid ${paperBorder}`,
                },
            }}
        >
            <Typography
                variant="subtitle1"
                sx={{ color, fontWeight: 700, mb: 1 }}
            >
                {title}
            </Typography>
            {list.length === 0 ? (
                <Typography variant="body2" sx={{ color: mutedColor }}>
                    {emptyCopy}
                </Typography>
            ) : (
                <Box data-testid={`collection-stats-movers-${kind}`} sx={moverBoxGridSx}>
                    {list.map((row) => (
                        <MoverBox
                            key={`${row.direction}-${row.card_id}`}
                            name={row.name}
                            setName={row.set_name}
                            finish={row.finish}
                            imageUrl={cardIdLookup?.[row.card_id]?.imageUrl || row.image_url}
                            fallbackUrl={cardIdLookup?.[row.card_id]?.imageUrlFallback || row.image_url}
                            currentLow={row.latest_low}
                            percentChange={row.percent_change}
                            amountChange={row.amount_change}
                            copies={copies[row.card_id]}
                            onSelect={() => openPrinting(row.card_id)}
                            isDark={isDark}
                            textColor={textColor}
                            mutedColor={mutedColor}
                            priceSource={priceSource}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                background: bgGradient,
                backgroundAttachment: 'fixed',
            }}
        >
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
            <Container maxWidth="md" sx={{ py: 3, flexGrow: 1 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={goBack}
                    sx={{ color: accentColor, mb: 2 }}
                >
                    Back
                </Button>
                <Typography variant="h4" sx={{ color: textColor, fontWeight: 800 }}>
                    Collection Stats
                </Typography>
                <Typography sx={{ color: mutedColor, mt: 0.5, mb: 2.5 }}>{binderName}</Typography>

                <Paper elevation={0} data-testid="collection-stats-headline" sx={sectionSx}>
                    <Typography
                        sx={{
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            letterSpacing: 0.4,
                            textTransform: 'uppercase',
                            color: accentColor,
                            mb: 1,
                        }}
                    >
                        Total Value
                    </Typography>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 3,
                            flexWrap: 'wrap',
                        }}
                    >
                        <Typography
                            sx={{
                                fontWeight: 800,
                                fontSize: '1.8rem',
                                color: '#2e7d32',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {formatCatalogPrice(usdAmount, 'USD')}
                        </Typography>
                        <Typography
                            sx={{
                                fontWeight: 800,
                                fontSize: '1.8rem',
                                color: '#2e7d32',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {formatCatalogPrice(eurAmount, 'EUR')}
                        </Typography>
                    </Box>
                </Paper>

                <Paper elevation={0} sx={sectionSx}>
                    <Typography variant="h6" sx={{ color: textColor, fontWeight: 700, mb: 1.5 }}>
                        Recent movers
                    </Typography>
                    {moversLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : moversError ? (
                        <Box sx={{ textAlign: 'center', py: 1 }}>
                            <Typography variant="body2" sx={{ color: textColor, mb: 1 }}>
                                Couldn’t load recent movers from {label}.
                            </Typography>
                            <Button onClick={loadMovers}>Retry</Button>
                        </Box>
                    ) : ids.length === 0 || visibleRows.length === 0 ? (
                        <Typography variant="body2" sx={{ color: mutedColor }}>
                            {ids.length === 0
                                ? 'No Printings in this Binder to rank.'
                                : 'None of these Printings gained or lost enough to rank.'}
                        </Typography>
                    ) : (
                        <Box>
                            {renderDirection(
                                'gainer',
                                'Gainers',
                                gainers,
                                '#2E7D32',
                                'None of these Printings gained enough to rank.',
                            )}
                            {renderDirection(
                                'loser',
                                'Losers',
                                losers,
                                '#C62828',
                                'None of these Printings lost enough to rank.',
                            )}
                        </Box>
                    )}
                </Paper>
                <Typography variant="caption" sx={{ color: mutedColor, display: 'block', mt: 0.5 }}>
                    Observed catalog numbers, not an appraisal. Values follow {label}.
                </Typography>
            </Container>
        </Box>
    );
};

export default CollectionStats;
