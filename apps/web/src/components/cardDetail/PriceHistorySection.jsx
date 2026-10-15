import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    useTheme,
} from '@mui/material';
import { tk } from '../../theme/tokens.js';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { useEntitlement } from '../../contexts/EntitlementContext.jsx';
import { usePriceType } from '../../contexts/PriceContext.jsx';
import { priceHistory } from '../../services/fabDb.js';
import {
    PRICE_HISTORY_WINDOW,
    changeLabel,
    emptyHistoryCopy,
    formatHistoryDate,
    formatObservedLow,
    priceHistorySeries,
} from '../../utils/priceHistorySeries.js';

const BASE_PLOT = { width: 320, height: 168, left: 8, right: 52, top: 16, bottom: 26 };

const tooltipShift = (x, width) => {
    if (x < 48) return 'translate(0, calc(-100% - 8px))';
    if (x > width - 48) return 'translate(-100%, calc(-100% - 8px))';
    return 'translate(-50%, calc(-100% - 8px))';
};

// Track the container width so the chart fills its column at 1:1 scale
// (labels stay legible instead of stretching with the viewBox).
const useMeasuredWidth = (fallback) => {
    const ref = useRef(null);
    const [width, setWidth] = useState(fallback);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const update = () => {
            const next = Math.round(el.getBoundingClientRect().width);
            if (next > 0) setWidth(next);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, width];
};

const LowChart = ({ series, source }) => {
    const theme = useTheme();
    const [containerRef, measuredWidth] = useMeasuredWidth(BASE_PLOT.width);
    const PLOT = { ...BASE_PLOT, width: measuredWidth };
    const [inspectIndex, setInspectIndex] = useState(null);
    const points = series.points;
    const lows = points.map((p) => p.low);
    const minLow = Math.min(...lows);
    const maxLow = Math.max(...lows);
    const span = maxLow - minLow;
    const pad = span === 0
        ? Math.min(Math.max(Math.abs(minLow) * 0.05, 0.05), 1)
        : span * 0.15;
    const minY = minLow - pad;
    const maxY = maxLow + pad;
    const plotW = PLOT.width - PLOT.left - PLOT.right;
    const plotH = PLOT.height - PLOT.top - PLOT.bottom;
    const xAt = (i) =>
        PLOT.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const yAt = (low) =>
        PLOT.top + (1 - (low - minY) / (maxY - minY)) * plotH;
    const line = points
        .map((p, i) => `${xAt(i)},${yAt(p.low)}`)
        .join(' ');
    const stroke = theme.palette.primary.main;
    const labelFill = theme.palette.text.secondary;
    const gridStroke = theme.palette.divider;
    const area = `${xAt(0)},${PLOT.top + plotH} ${line} ${xAt(points.length - 1)},${PLOT.top + plotH}`;
    const lastIdx = points.length - 1;
    const gradientId = `low-fill-${points[0].date}-${points.length}`;
    const inspect = inspectIndex == null ? null : points[inspectIndex];
    const inspectX = inspectIndex == null ? 0 : xAt(inspectIndex);
    const inspectY = inspect ? yAt(inspect.low) : 0;

    return (
        <Box ref={containerRef} sx={{ position: 'relative' }}>
            <Box
                component="svg"
                data-testid="price-history-chart"
                viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
                role="img"
                aria-label="Low price history"
                sx={{ width: '100%', height: 168, display: 'block' }}
                onMouseLeave={() => setInspectIndex(null)}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                    </linearGradient>
                </defs>
                {[maxLow, minLow].map((v, i) => (
                    <g key={i}>
                        <line
                            x1={PLOT.left}
                            x2={PLOT.width - PLOT.right}
                            y1={yAt(v)}
                            y2={yAt(v)}
                            stroke={gridStroke}
                            strokeDasharray="3 4"
                        />
                        <text
                            x={PLOT.width - PLOT.right + 6}
                            y={yAt(v) + 4}
                            fill={labelFill}
                            fontSize="10.5"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                            {formatObservedLow(v, source)}
                        </text>
                    </g>
                )).slice(0, span === 0 ? 1 : 2)}
                <polygon fill={`url(#${gradientId})`} points={area} />
                <polyline
                    fill="none"
                    stroke={stroke}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={line}
                />
                {points.map((p, i) => (
                    <g key={p.date}>
                        <circle
                            cx={xAt(i)}
                            cy={yAt(p.low)}
                            r="10"
                            fill="transparent"
                            data-testid={`price-history-point-${p.date}`}
                            onMouseEnter={() => setInspectIndex(i)}
                            onClick={() => setInspectIndex(i)}
                            style={{ cursor: 'pointer' }}
                        />
                        {(i === lastIdx || i === inspectIndex) && (
                            <circle
                                cx={xAt(i)}
                                cy={yAt(p.low)}
                                r="4"
                                fill={stroke}
                                stroke={theme.palette.background.paper}
                                strokeWidth="2"
                                pointerEvents="none"
                            />
                        )}
                    </g>
                ))}
                <text
                    x={xAt(0)}
                    y={PLOT.height - 6}
                    fill={labelFill}
                    fontSize="11"
                    textAnchor="start"
                >
                    {formatHistoryDate(points[0].date)}
                </text>
                <text
                    x={xAt(points.length - 1)}
                    y={PLOT.height - 6}
                    fill={labelFill}
                    fontSize="11"
                    textAnchor="end"
                >
                    {formatHistoryDate(points[points.length - 1].date)}
                </text>
            </Box>
            {inspect && (
                <Box
                    data-testid="price-history-inspect"
                    sx={{
                        position: 'absolute',
                        left: `${(inspectX / PLOT.width) * 100}%`,
                        top: `${(inspectY / PLOT.height) * 100}%`,
                        transform: tooltipShift(inspectX, PLOT.width),
                        pointerEvents: 'none',
                        px: 1,
                        py: 0.5,
                        borderRadius: '8px',
                        whiteSpace: 'nowrap',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.2,
                        color: 'text.primary',
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        boxShadow: (t) => tk(t).shadowMd,
                    }}
                >
                    {formatHistoryDate(inspect.date)}
                    {' · '}
                    {formatObservedLow(inspect.low, source)}
                </Box>
            )}
        </Box>
    );
};

// eslint-disable-next-line no-unused-vars
const HistoryHeader = ({ isDark, children }) => (
    <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <ShowChartIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography
                variant="h5"
                component="h3"
                sx={{ color: 'text.primary' }}
            >
                Price history
            </Typography>
        </Box>
        {children}
    </>
);

/**
 * Low-only history for one Printing, shown under the Prices box in the overlay.
 * Free/signed-out stay on 30 days with no upgrade CTA. Pro may switch to the
 * full recorded span when older snapshots exist.
 */
const PriceHistorySection = ({ printingId, isDark = false }) => {
    const { isPro } = useEntitlement();
    const { priceSource } = usePriceType();
    const source = priceSource === 'cardmarket' ? 'cardmarket' : 'tcgplayer';
    const [window, setWindow] = useState(PRICE_HISTORY_WINDOW.last30);
    const [snapshots, setSnapshots] = useState(null);
    const [error, setError] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        setWindow(PRICE_HISTORY_WINDOW.last30);
        setSnapshots(null);
        setError(false);
        if (!printingId) return undefined;
        const ac = new AbortController();
        priceHistory(printingId, { signal: ac.signal })
            .then((rows) => {
                if (ac.signal.aborted) return;
                setSnapshots(Array.isArray(rows) ? rows : []);
                setError(false);
            })
            .catch((err) => {
                if (err?.name === 'AbortError') return;
                if (ac.signal.aborted) return;
                setSnapshots(null);
                setError(true);
            });
        return () => ac.abort();
    }, [printingId, retryKey]);

    const series = useMemo(
        () =>
            snapshots
                ? priceHistorySeries({
                    snapshots,
                    source,
                    isPro,
                    window,
                })
                : null,
        [snapshots, source, isPro, window],
    );

    const textColor = 'text.primary';
    const muted = 'text.secondary';

    let body;
    if (error) {
        body = (
            <HistoryHeader isDark={isDark}>
                <Typography sx={{ fontSize: '0.85rem', color: textColor }}>
                    Couldn&apos;t load history
                </Typography>
                <Button
                    data-testid="price-history-retry"
                    size="small"
                    onClick={() => setRetryKey((k) => k + 1)}
                    sx={{ mt: 0.5, px: 0, minWidth: 0 }}
                >
                    Retry
                </Button>
            </HistoryHeader>
        );
    } else if (!series) {
        body = (
            <HistoryHeader isDark={isDark}>
                <Box
                    data-testid="price-history-loading"
                    sx={{ height: 36, display: 'flex', alignItems: 'center' }}
                >
                    <CircularProgress size={18} />
                </Box>
            </HistoryHeader>
        );
    } else if (!series.chartable) {
        body = (
            <HistoryHeader isDark={isDark}>
                <Typography sx={{ fontSize: '0.85rem', color: muted }}>
                    {emptyHistoryCopy(snapshots, source)}
                </Typography>
            </HistoryHeader>
        );
    } else {
        const delta = series.delta;
        const changeColor = delta > 0
            ? 'success.main'
            : delta < 0
                ? 'error.main'
                : muted;
        body = (
            <HistoryHeader isDark={isDark}>
                <Typography
                    sx={{
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: changeColor,
                        mb: 1.25,
                    }}
                >
                    {changeLabel(series, source)}
                </Typography>
                <LowChart
                    key={`${printingId}-${window}`}
                    series={series}
                    source={source}
                />
                <Typography
                    sx={{
                        mt: 1,
                        fontSize: '0.7rem',
                        color: 'text.secondary',
                        lineHeight: 1.4,
                    }}
                >
                    Observed catalog Low — the same source as today’s prices, not an appraisal.
                </Typography>
                {series.showSpanControl && (
                    <ToggleButtonGroup
                        data-testid="price-history-span-toggle"
                        exclusive
                        size="small"
                        value={window}
                        onChange={(_e, next) => {
                            if (!next) return;
                            setWindow(next);
                        }}
                        sx={{ mt: 1, flexWrap: 'wrap' }}
                    >
                        <ToggleButton value={PRICE_HISTORY_WINDOW.last30}>
                            30 days
                        </ToggleButton>
                        <ToggleButton value={PRICE_HISTORY_WINDOW.full}>
                            All recorded
                        </ToggleButton>
                    </ToggleButtonGroup>
                )}
            </HistoryHeader>
        );
    }

    return (
        <Box
            data-testid="price-history-section"
            sx={{
                pt: 2.5,
                borderTop: 1,
                borderColor: 'divider',
            }}
        >
            {body}
        </Box>
    );
};

export default PriceHistorySection;
