import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, InsightsOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Header from '../components/elements/Header.jsx';
import { Page, PageHeader, Panel, EmptyState } from '../components/layout/Page.jsx';
import MoverBox from '../components/movers/MoverBox.jsx';
import { moverBoxGridSx } from '../components/movers/moverBoxStyles.js';
import SignInDialog from '../components/auth/SignInDialog.jsx';
import { useAuth } from '../contexts/AuthContext';
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

    const textColor = 'text.primary';
    const mutedColor = 'text.secondary';

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
            <>
                <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
                <Page maxWidth={720}>
                    <Panel sx={{ mt: { xs: 2, md: 6 } }}>
                        <EmptyState
                            icon={<InsightsOutlined />}
                            title="Sign In Required"
                            actions={(
                                <>
                                    <Button variant="contained" size="large" onClick={() => setSignInOpen(true)}>
                                        Sign in
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="inherit"
                                        size="large"
                                        startIcon={<ArrowBackIcon />}
                                        onClick={() => navigate('/')}
                                    >
                                        Back
                                    </Button>
                                </>
                            )}
                        >
                            Sign in to sync your binder across devices.
                        </EmptyState>
                    </Panel>
                </Page>
                <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
            </>
        );
    }

    const renderDirection = (kind, title, list, color, emptyCopy) => (
        <Box sx={{ '&:not(:first-of-type)': { mt: 3 } }}>
            <Typography
                variant="h5"
                component="h3"
                sx={{ color, mb: 1.25 }}
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
                            priceSource={priceSource}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );

    const valueSx = {
        fontFamily: (t) => t.typography.h1.fontFamily,
        fontWeight: 800,
        fontStretch: '112%',
        fontSize: { xs: '1.75rem', sm: '2.25rem' },
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        color: 'text.primary',
        fontVariantNumeric: 'tabular-nums',
    };

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
            <Page maxWidth={1080}>
                <Button
                    size="small"
                    color="inherit"
                    startIcon={<ArrowBackIcon sx={{ fontSize: '1rem !important' }} />}
                    onClick={goBack}
                    sx={{ mb: 2, ml: -1, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                >
                    Back
                </Button>
                <PageHeader title="Collection Stats" subtitle={binderName} />

                <Panel data-testid="collection-stats-headline" sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                    <Typography variant="overline" component="div" sx={{ color: mutedColor, mb: 1 }}>
                        Total Value
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, max-content)' },
                            columnGap: 6,
                            rowGap: 2,
                        }}
                    >
                        <Box>
                            <Typography sx={valueSx}>{formatCatalogPrice(usdAmount, 'USD')}</Typography>
                            <Typography variant="caption" sx={{ color: mutedColor }}>TCGplayer</Typography>
                        </Box>
                        <Box>
                            <Typography sx={valueSx}>{formatCatalogPrice(eurAmount, 'EUR')}</Typography>
                            <Typography variant="caption" sx={{ color: mutedColor }}>CardMarket</Typography>
                        </Box>
                    </Box>
                </Panel>

                <Box component="section">
                    <Typography variant="h3" component="h2" sx={{ color: textColor, mb: 2 }}>
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
                                'success.main',
                                'None of these Printings gained enough to rank.',
                            )}
                            {renderDirection(
                                'loser',
                                'Losers',
                                losers,
                                'error.main',
                                'None of these Printings lost enough to rank.',
                            )}
                        </Box>
                    )}
                </Box>
                <Typography variant="caption" sx={{ color: mutedColor, display: 'block', mt: 3 }}>
                    Observed catalog numbers, not an appraisal. Values follow {label}.
                </Typography>
            </Page>
        </>
    );
};

export default CollectionStats;
