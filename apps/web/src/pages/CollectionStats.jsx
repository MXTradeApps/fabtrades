import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, InsightsOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Header from '../components/elements/Header.jsx';
import { Page, PageHeader, Panel, EmptyState } from '../components/layout/Page.jsx';
import ValueOverTime from '../components/binder/ValueOverTime.jsx';
import DirectionList from '../components/movers/DirectionList.jsx';
import { segmentSx, windowLabel } from '../components/movers/trendListUtils.js';
import { formatMoverAmount } from '../utils/moverFormat.js';
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
import { trendingMovers } from '../services/fabDb.js';

const DAY_OPTIONS = [7, 30];
/** Rows shown per list before "Show all". */
const LIST_PREVIEW = 10;

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
    const [days, setDays] = useState(7);
    const [sort, setSort] = useState('percent');
    const [phoneSide, setPhoneSide] = useState('gainer');
    const [showAll, setShowAll] = useState(false);

    const binderId = getOpenBinderId() || targetOwnedBinderId() || TRADE_BINDER_ID;

    useDocumentHead({
        title: 'Collection Stats',
        description: 'Current Binder value and how its cards moved in price.',
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
        const cacheKey = `${priceSource}:${days}:${idsKey}`;
        const cached = moversCache.current.get(cacheKey);
        if (cached) {
            setMoverRows(cached);
            setMoversError(null);
            setMoversLoading(false);
            return;
        }
        setMoversLoading(true);
        setMoversError(null);
        trendingMovers(priceSource, { days, sort: 'percent', minPrice: 0, cardIds: ids, limit: null })
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
    }, [ids, idsKey, priceSource, days]);

    useEffect(() => {
        loadMovers();
        return () => {
            moversGen.current += 1;
        };
    }, [loadMovers]);

    const openRow = (row) => {
        const printing = cardIdLookup?.[row.card_id] || catalogById.get(row.card_id);
        if (printing) openDetail(printing);
    };

    // Change across every copy held: one card at +$2 with 3 copies is +$6.
    const heldChange = (row) => Number(row.amount_change) * (copies[row.card_id] || 0);
    const visibleRows = moverRows
        .filter((row) => (copies[row.card_id] || 0) > 0)
        .sort((a, b) => (
            sort === 'amount'
                ? Math.abs(heldChange(b)) - Math.abs(heldChange(a))
                : Math.abs(b.percent_change) - Math.abs(a.percent_change)
        ));
    const { gainers, losers } = splitMoversByDirection(visibleRows);
    const net = visibleRows.reduce((sum, row) => sum + heldChange(row), 0);
    const when = windowLabel(days);
    const hasMore = gainers.length > LIST_PREVIEW || losers.length > LIST_PREVIEW;
    const shown = (list) => (showAll ? list : list.slice(0, LIST_PREVIEW));

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
            <Page>
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

                <ValueOverTime copies={copies} priceSource={priceSource} loading={loading} />

                <Box component="section">
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            columnGap: 2,
                            rowGap: 1,
                            mb: 2,
                        }}
                    >
                        <Typography variant="h3" component="h2" sx={{ color: textColor }}>
                            Price moves
                        </Typography>
                        <Box
                            data-testid="collection-stats-controls"
                            sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
                        >
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={days}
                                onChange={(_, v) => v != null && setDays(v)}
                                aria-label="Time window"
                                sx={segmentSx}
                            >
                                {DAY_OPTIONS.map((d) => (
                                    <ToggleButton key={d} value={d}>{`${d} days`}</ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={sort}
                                onChange={(_, v) => v != null && setSort(v)}
                                aria-label="Rank by"
                                sx={segmentSx}
                            >
                                <ToggleButton value="percent">By %</ToggleButton>
                                <ToggleButton value="amount">
                                    {priceSource === 'cardmarket' ? 'By €' : 'By $'}
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Box>
                    {moversLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : moversError ? (
                        <Box sx={{ textAlign: 'center', py: 1 }}>
                            <Typography variant="body2" sx={{ color: textColor, mb: 1 }}>
                                Couldn’t load price moves from {label}.
                            </Typography>
                            <Button onClick={loadMovers}>Retry</Button>
                        </Box>
                    ) : ids.length === 0 || visibleRows.length === 0 ? (
                        <Typography variant="body2" sx={{ color: mutedColor }}>
                            {ids.length === 0
                                ? 'No cards in this Binder to rank.'
                                : `None of the cards in this Binder moved ${when}.`}
                        </Typography>
                    ) : (
                        <>
                            <Typography
                                data-testid="collection-stats-net"
                                variant="body2"
                                sx={{ color: mutedColor, mb: 2, fontVariantNumeric: 'tabular-nums' }}
                            >
                                {visibleRows.length === 1 ? '1 card' : `${visibleRows.length} cards`} in this Binder
                                moved {when} · net{' '}
                                <Box
                                    component="span"
                                    sx={{ color: net >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}
                                >
                                    {formatMoverAmount(net, priceSource)}
                                </Box>
                            </Typography>
                            <ToggleButtonGroup
                                exclusive
                                fullWidth
                                size="small"
                                value={phoneSide}
                                onChange={(_, v) => v && setPhoneSide(v)}
                                aria-label="Rising or falling"
                                sx={{ ...segmentSx, display: { xs: 'flex', md: 'none' }, mb: 1.5 }}
                            >
                                <ToggleButton value="gainer">Rising</ToggleButton>
                                <ToggleButton value="loser">Falling</ToggleButton>
                            </ToggleButtonGroup>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                                    gap: { xs: 0, md: 3 },
                                }}
                            >
                                <DirectionList
                                    kind="gainer"
                                    title="Rising"
                                    rows={shown(gainers)}
                                    total={gainers.length}
                                    hiddenOnPhone={phoneSide !== 'gainer'}
                                    emptyCopy={`None of the cards in this Binder rose ${when}.`}
                                    priceSource={priceSource}
                                    cardIdLookup={cardIdLookup}
                                    onSelect={openRow}
                                    copies={copies}
                                />
                                <DirectionList
                                    kind="loser"
                                    title="Falling"
                                    rows={shown(losers)}
                                    total={losers.length}
                                    hiddenOnPhone={phoneSide !== 'loser'}
                                    emptyCopy={`None of the cards in this Binder fell ${when}.`}
                                    priceSource={priceSource}
                                    cardIdLookup={cardIdLookup}
                                    onSelect={openRow}
                                    copies={copies}
                                />
                            </Box>
                            {hasMore ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                    <Button
                                        onClick={() => setShowAll((v) => !v)}
                                        sx={{ textTransform: 'none', fontWeight: 700 }}
                                    >
                                        {showAll ? 'Show top 10' : `Show all ${visibleRows.length}`}
                                    </Button>
                                </Box>
                            ) : null}
                        </>
                    )}
                </Box>
                <Typography variant="caption" sx={{ color: mutedColor, display: 'block', mt: 3 }}>
                    Rising uses the {label} Low, the cheapest listed copy. Falling uses the {label}{' '}
                    {priceSource === 'cardmarket' ? 'Trend' : 'Market'} price. Net counts every copy you hold.
                    Observed catalog numbers, not an appraisal.
                </Typography>
            </Page>
        </>
    );
};

export default CollectionStats;
