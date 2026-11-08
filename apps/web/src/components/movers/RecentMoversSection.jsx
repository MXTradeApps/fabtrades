import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Box,
    Button,
    CircularProgress,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { usePriceType } from '../../contexts/PriceContext.jsx';
import { useCardDetail } from '../../contexts/CardDetailContext.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { useCardData } from '../../hooks/useCardData.jsx';
import { trendingMovers } from '../../services/fabDb.js';
import { getBinderEntries } from '../../services/binder.js';
import { copiesByPrintingId, ownedPrintingIds, splitMoversByDirection } from '../../utils/recentMovers.js';
import { formatMoverAmount } from '../../utils/moverFormat.js';
import TrendRow from './TrendRow.jsx';

const DAY_OPTIONS = [7, 30];
const SORT_OPTIONS = [
    { value: 'percent', label: 'By %' },
    { value: 'amount', label: 'By $' },
];
const FLOOR_OPTIONS = [0, 2, 10, 50];

const sourceLabel = (priceSource) =>
    priceSource === 'cardmarket' ? 'CardMarket' : 'TCGplayer';

/** Which price each list ranks by: Low for rising, Market (CM: Trend) for falling. */
const measureLabel = (kind, priceSource) => {
    if (kind === 'gainer') return 'by Low';
    return priceSource === 'cardmarket' ? 'by Trend' : 'by Market';
};

const pickNumber = (raw, allowed, fallback) => {
    const n = Number(raw);
    return allowed.includes(n) ? n : fallback;
};

const windowLabel = (days) => (days === 7 ? 'this week' : `in the last ${days} days`);

const floorLabel = (floor, priceSource) => {
    if (!floor) return 'Any price';
    return priceSource === 'cardmarket' ? `${floor} €+` : `$${floor}+`;
};

const artForRow = (row, cardIdLookup) => {
    const printing = cardIdLookup?.[row.card_id];
    return {
        imageUrl: printing?.imageUrl || row.image_url || '',
        fallbackUrl: printing?.imageUrlFallback || row.image_url || '',
    };
};

/** Trending filters live in the URL so a filtered view can be shared. */
const useTrendFilters = () => {
    const [params, setParams] = useSearchParams();
    const days = pickNumber(params.get('days'), DAY_OPTIONS, 7);
    const sort = params.get('sort') === 'amount' ? 'amount' : 'percent';
    const floor = pickNumber(params.get('min'), FLOOR_OPTIONS, 0);
    const update = (key, value, fallback) => {
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value === fallback) next.delete(key);
            else next.set(key, String(value));
            return next;
        }, { replace: true });
    };
    return {
        days,
        sort,
        floor,
        setDays: (v) => update('days', v, 7),
        setSort: (v) => update('sort', v, 'percent'),
        setFloor: (v) => update('min', v, 0),
    };
};

const segmentSx = {
    '& .MuiToggleButton-root': {
        px: 1.5,
        py: 0.5,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.84rem',
    },
};

/**
 * Trending: catalog-wide Rising (by Low) and Falling (by Market / Trend) lists, with
 * window / sort / price-floor controls and, when signed in, a strip showing
 * how the user's own cards moved.
 */
const RecentMoversSection = () => {
    const { priceSource } = usePriceType();
    const { openDetail } = useCardDetail();
    const { cardIdLookup } = useCardData();
    const { user } = useAuth();
    const { days, sort, floor, setDays, setSort, setFloor } = useTrendFilters();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [phoneSide, setPhoneSide] = useState('gainer');
    const [reloadKey, setReloadKey] = useState(0);
    const cache = useRef(new Map());

    const label = sourceLabel(priceSource);
    const key = `${priceSource}:${days}:${sort}:${floor}`;

    useEffect(() => {
        let cancelled = false;
        const cached = cache.current.get(key);
        if (cached) {
            setRows(cached);
            setLoading(false);
            setError(null);
            return undefined;
        }
        setLoading(true);
        setError(null);
        trendingMovers(priceSource, { days, sort, minPrice: floor, limit: 10 })
            .then((fetched) => {
                if (cancelled) return;
                const list = Array.isArray(fetched) ? fetched : [];
                cache.current.set(key, list);
                setRows(list);
            })
            .catch((err) => {
                if (!cancelled) setError(err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [key, priceSource, days, sort, floor, reloadKey]);

    const openRow = (row) => {
        const printing = cardIdLookup?.[row.card_id];
        if (printing) openDetail(printing);
    };

    const { gainers, losers } = splitMoversByDirection(rows);
    const totalFor = (list) => list[0]?.direction_total ?? list.length;

    return (
        <Box>
            <Box
                data-testid="trend-controls"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2.5 }}
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
                    {SORT_OPTIONS.map((o) => (
                        <ToggleButton key={o.value} value={o.value}>
                            {o.value === 'amount' && priceSource === 'cardmarket' ? 'By €' : o.label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={floor}
                    onChange={(_, v) => v != null && setFloor(v)}
                    aria-label="Minimum price"
                    sx={segmentSx}
                >
                    {FLOOR_OPTIONS.map((f) => (
                        <ToggleButton key={f} value={f}>{floorLabel(f, priceSource)}</ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>

            {user ? (
                <YourMovers
                    days={days}
                    sort={sort}
                    priceSource={priceSource}
                    cardIdLookup={cardIdLookup}
                    onSelect={openRow}
                />
            ) : null}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={28} />
                </Box>
            ) : error ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body2" sx={{ color: 'text.primary', mb: 1 }}>
                        Couldn’t load trending cards from {label}.
                    </Typography>
                    <Button onClick={() => { cache.current.delete(key); setReloadKey((k) => k + 1); }}>
                        Retry
                    </Button>
                </Box>
            ) : (
                <>
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
                            rows={gainers}
                            total={totalFor(gainers)}
                            hiddenOnPhone={phoneSide !== 'gainer'}
                            emptyCopy={`No cards rose ${windowLabel(days)} on ${label}.`}
                            priceSource={priceSource}
                            cardIdLookup={cardIdLookup}
                            onSelect={openRow}
                        />
                        <DirectionList
                            kind="loser"
                            title="Falling"
                            rows={losers}
                            total={totalFor(losers)}
                            hiddenOnPhone={phoneSide !== 'loser'}
                            emptyCopy={`No cards fell ${windowLabel(days)} on ${label}.`}
                            priceSource={priceSource}
                            cardIdLookup={cardIdLookup}
                            onSelect={openRow}
                        />
                    </Box>
                </>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2, maxWidth: 760 }}>
                Rising uses the {label} Low, the cheapest listed copy, which jumps first when the cheap copies sell out.
                Falling uses the {label} {priceSource === 'cardmarket' ? 'Trend' : 'Market'} price, so one cheap listing
                can’t make a card look like it crashed.
            </Typography>
        </Box>
    );
};

const DirectionList = ({
    kind,
    title,
    rows,
    total,
    hiddenOnPhone,
    emptyCopy,
    priceSource,
    cardIdLookup,
    onSelect,
}) => (
    <Box
        data-testid={`movers-list-${kind}`}
        sx={{ display: { xs: hiddenOnPhone ? 'none' : 'block', md: 'block' }, minWidth: 0 }}
    >
        <Typography
            variant="caption"
            sx={{ display: { xs: 'block', md: 'none' }, color: 'text.secondary', mb: 1, fontVariantNumeric: 'tabular-nums' }}
        >
            {total === 1 ? '1 card' : `${total} cards`} · {measureLabel(kind, priceSource)}
        </Typography>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'baseline', gap: 1, mb: 1 }}>
            <Typography
                variant="h4"
                component="h2"
                sx={{ color: kind === 'gainer' ? 'success.main' : 'error.main' }}
            >
                {title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {total === 1 ? '1 card' : `${total} cards`} · {measureLabel(kind, priceSource)}
            </Typography>
        </Box>
        {rows.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
                {emptyCopy}
            </Typography>
        ) : (
            <Box
                sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: '12px',
                    bgcolor: 'background.paper',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {rows.map((row) => {
                    const { imageUrl, fallbackUrl } = artForRow(row, cardIdLookup);
                    return (
                        <TrendRow
                            key={`${row.direction}-${row.card_id}`}
                            rank={row.rank}
                            name={row.name}
                            setName={row.set_name}
                            finish={row.finish}
                            imageUrl={imageUrl}
                            fallbackUrl={fallbackUrl}
                            startLow={Number(row.start_price)}
                            latestLow={Number(row.latest_price)}
                            percentChange={Number(row.percent_change)}
                            amountChange={Number(row.amount_change)}
                            history={row.history}
                            priceSource={priceSource}
                            onSelect={() => onSelect(row)}
                        />
                    );
                })}
            </Box>
        )}
    </Box>
);

/**
 * Signed-in strip: how many of the user's cards (any Binder, not Want List)
 * moved in the window, the net change across their copies, and the list.
 */
const YourMovers = ({ days, sort, priceSource, cardIdLookup, onSelect }) => {
    const [entries, setEntries] = useState(null);
    const [rows, setRows] = useState([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getBinderEntries()
            .then((res) => {
                if (!cancelled) setEntries(res?.data?.binder || []);
            })
            .catch(() => {
                if (!cancelled) setEntries([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const ids = useMemo(() => (entries ? ownedPrintingIds(entries) : []), [entries]);
    const copies = useMemo(() => (entries ? copiesByPrintingId(entries) : {}), [entries]);

    useEffect(() => {
        if (!ids.length) {
            setRows([]);
            return undefined;
        }
        let cancelled = false;
        trendingMovers(priceSource, { days, sort, minPrice: 0, cardIds: ids, limit: null })
            .then((fetched) => {
                if (!cancelled) setRows(Array.isArray(fetched) ? fetched : []);
            })
            .catch(() => {
                if (!cancelled) setRows([]);
            });
        return () => {
            cancelled = true;
        };
    }, [ids, priceSource, days, sort]);

    if (!entries || ids.length === 0) return null;

    const moved = rows
        .filter((r) => (copies[r.card_id] || 0) > 0)
        .sort((a, b) => (
            sort === 'amount'
                ? Math.abs(b.amount_change * (copies[b.card_id] || 1)) - Math.abs(a.amount_change * (copies[a.card_id] || 1))
                : Math.abs(b.percent_change) - Math.abs(a.percent_change)
        ));
    const net = moved.reduce((sum, r) => sum + Number(r.amount_change) * (copies[r.card_id] || 0), 0);
    const when = windowLabel(days);

    return (
        <Box
            data-testid="your-movers"
            sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: '12px',
                bgcolor: 'background.paper',
                mb: 3,
                overflow: 'hidden',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, px: 1.75, py: 1.25 }}>
                <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Your binders</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                    {moved.length === 0 ? (
                        `None of your cards moved ${when}.`
                    ) : (
                        <>
                            {moved.length === 1 ? '1 of your cards' : `${moved.length} of your cards`} moved {when} · net{' '}
                            <Box
                                component="span"
                                sx={{ color: net >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}
                            >
                                {formatMoverAmount(net, priceSource)}
                            </Box>
                        </>
                    )}
                </Typography>
                {moved.length > 0 ? (
                    <Button
                        size="small"
                        onClick={() => setOpen((o) => !o)}
                        sx={{ ml: 'auto', textTransform: 'none', fontWeight: 700 }}
                        aria-expanded={open}
                    >
                        {open ? 'Hide' : 'See them'}
                    </Button>
                ) : null}
            </Box>
            {open && moved.length > 0 ? (
                <Box sx={{ borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
                    {moved.map((row, i) => {
                        const { imageUrl, fallbackUrl } = artForRow(row, cardIdLookup);
                        return (
                            <TrendRow
                                key={`yours-${row.card_id}`}
                                rank={i + 1}
                                name={row.name}
                                setName={row.set_name}
                                finish={row.finish}
                                imageUrl={imageUrl}
                                fallbackUrl={fallbackUrl}
                                startLow={Number(row.start_price)}
                                latestLow={Number(row.latest_price)}
                                percentChange={Number(row.percent_change)}
                                amountChange={Number(row.amount_change)}
                                history={row.history}
                                copies={copies[row.card_id]}
                                priceSource={priceSource}
                                onSelect={() => onSelect(row)}
                            />
                        );
                    })}
                </Box>
            ) : null}
        </Box>
    );
};

export default RecentMoversSection;
