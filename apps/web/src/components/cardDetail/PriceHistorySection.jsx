import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
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

const PLOT = { width: 320, height: 168, left: 8, right: 8, top: 28, bottom: 26 };

const tooltipShift = (x) => {
    if (x < 48) return 'translate(0, calc(-100% - 8px))';
    if (x > PLOT.width - 48) return 'translate(-100%, calc(-100% - 8px))';
    return 'translate(-50%, calc(-100% - 8px))';
};

const LowChart = ({ series, source, isDark, muted }) => {
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
    const stroke = isDark ? '#e4c09c' : '#8b4513';
    const labelFill = muted;
    const inspect = inspectIndex == null ? null : points[inspectIndex];
    const inspectX = inspectIndex == null ? 0 : xAt(inspectIndex);
    const inspectY = inspect ? yAt(inspect.low) : 0;

    return (
        <Box sx={{ position: 'relative' }}>
            <Box
                component="svg"
                data-testid="price-history-chart"
                viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
                role="img"
                aria-label="Low price history"
                sx={{ width: '100%', height: 168, display: 'block' }}
                onMouseLeave={() => setInspectIndex(null)}
            >
                <polyline
                    fill="none"
                    stroke={stroke}
                    strokeWidth="2"
                    strokeLinejoin="round"
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
                        <circle
                            cx={xAt(i)}
                            cy={yAt(p.low)}
                            r="3.2"
                            fill={stroke}
                            pointerEvents="none"
                        />
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
                        transform: tooltipShift(inspectX),
                        pointerEvents: 'none',
                        px: 0.75,
                        py: 0.35,
                        borderRadius: 1,
                        whiteSpace: 'nowrap',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.2,
                        color: isDark ? '#f5f1ed' : '#2c1810',
                        backgroundColor: isDark ? '#2c1810' : '#f5f1ed',
                        border: isDark
                            ? '1px solid rgba(212, 165, 116, 0.45)'
                            : '1px solid rgba(139, 69, 19, 0.28)',
                        boxShadow: isDark
                            ? '0 2px 8px rgba(0, 0, 0, 0.45)'
                            : '0 2px 8px rgba(44, 24, 16, 0.12)',
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

const HistoryHeader = ({ isDark, children }) => {
    const title = isDark ? '#f5f1ed' : '#2c1810';
    const accent = isDark ? '#e4c09c' : '#8b4513';
    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <ShowChartIcon sx={{ fontSize: 18, color: accent }} />
                <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, fontSize: '0.95rem', color: title }}
                >
                    Price history
                </Typography>
            </Box>
            {children}
        </>
    );
};

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

    const textColor = isDark ? '#f5f1ed' : '#2c1810';
    const muted = isDark ? 'rgba(212, 165, 116, 0.75)' : 'rgba(93, 58, 26, 0.7)';

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
            ? '#2E7D32'
            : delta < 0
                ? '#C62828'
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
                    isDark={isDark}
                    muted={muted}
                />
                <Typography
                    sx={{
                        mt: 1,
                        fontSize: '0.7rem',
                        color: isDark ? 'rgba(212, 165, 116, 0.65)' : 'rgba(93, 58, 26, 0.55)',
                        lineHeight: 1.35,
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
                mt: 2,
                pt: 1.5,
                borderTop: isDark
                    ? '1px solid rgba(212, 165, 116, 0.18)'
                    : '1px solid rgba(139, 69, 19, 0.12)',
            }}
        >
            {body}
        </Box>
    );
};

export default PriceHistorySection;
