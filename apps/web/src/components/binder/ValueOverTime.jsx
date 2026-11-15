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
import { Panel } from '../layout/Page.jsx';
import { collectionValueHistory } from '../../services/fabDb.js';
import { segmentSx } from '../movers/trendListUtils.js';
import { formatMoverAmount, formatMoverMoney, formatMoverPercent } from '../../utils/moverFormat.js';
import { formatHistoryDate } from '../../utils/priceHistorySeries.js';
import { lastDays, spanDays, valueChange, valueHistoryPoints } from '../../utils/valueHistory.js';

const WINDOWS = [30, 90];
const FETCH_DAYS = 90;
const PLOT = { height: 220, left: 8, right: 68, top: 16, bottom: 28 };

const sourceLabel = (priceSource) =>
    priceSource === 'cardmarket' ? 'CardMarket' : 'TCGplayer';

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

const tooltipShift = (x, width) => {
    if (x < 70) return 'translate(0, calc(-100% - 10px))';
    if (x > width - 70) return 'translate(-100%, calc(-100% - 10px))';
    return 'translate(-50%, calc(-100% - 10px))';
};

/** Line chart of total value by day. Hover or tap to read a day's value. */
const ValueChart = ({ points, priceSource, color }) => {
    const theme = useTheme();
    const [containerRef, width] = useMeasuredWidth(640);
    const [inspectIndex, setInspectIndex] = useState(null);

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    const pad = span === 0 ? Math.max(Math.abs(min) * 0.05, 1) : span * 0.15;
    const minY = min - pad;
    const maxY = max + pad;
    const plotW = Math.max(width - PLOT.left - PLOT.right, 1);
    const plotH = PLOT.height - PLOT.top - PLOT.bottom;
    const xAt = (i) => PLOT.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const yAt = (v) => PLOT.top + (1 - (v - minY) / (maxY - minY)) * plotH;
    const line = points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(' ');
    const base = PLOT.top + plotH;
    const area = `${xAt(0)},${base} ${line} ${xAt(points.length - 1)},${base}`;
    const lastIdx = points.length - 1;
    const shown = inspectIndex == null ? lastIdx : Math.min(inspectIndex, lastIdx);
    const inspect = inspectIndex == null ? null : points[shown];
    const stroke = theme.palette[color].main;
    const labelFill = theme.palette.text.secondary;
    const gridValues = span === 0 ? [max] : [max, (max + min) / 2, min];

    const inspectAt = (clientX, target) => {
        const rect = target.getBoundingClientRect();
        if (!rect.width || points.length < 2) return;
        const x = ((clientX - rect.left) / rect.width) * width;
        const i = Math.round(((x - PLOT.left) / plotW) * (points.length - 1));
        setInspectIndex(Math.max(0, Math.min(points.length - 1, i)));
    };

    return (
        <Box ref={containerRef} sx={{ position: 'relative' }}>
            <Box
                component="svg"
                data-testid="value-history-chart"
                viewBox={`0 0 ${width} ${PLOT.height}`}
                role="img"
                aria-label={`Total value from ${formatHistoryDate(points[0].date)} to ${formatHistoryDate(points[lastIdx].date)}`}
                sx={{ width: '100%', height: PLOT.height, display: 'block', touchAction: 'pan-y' }}
                onMouseMove={(e) => inspectAt(e.clientX, e.currentTarget)}
                onMouseLeave={() => setInspectIndex(null)}
                onTouchStart={(e) => inspectAt(e.touches[0].clientX, e.currentTarget)}
                onTouchMove={(e) => inspectAt(e.touches[0].clientX, e.currentTarget)}
            >
                <defs>
                    <linearGradient id="value-history-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                    </linearGradient>
                </defs>
                {gridValues.map((v) => (
                    <g key={v}>
                        <line
                            x1={PLOT.left}
                            x2={width - PLOT.right}
                            y1={yAt(v)}
                            y2={yAt(v)}
                            stroke={theme.palette.divider}
                            strokeDasharray="3 4"
                        />
                        <text
                            x={width - PLOT.right + 8}
                            y={yAt(v) + 4}
                            fill={labelFill}
                            fontSize="11"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                            {formatMoverMoney(v, priceSource)}
                        </text>
                    </g>
                ))}
                <polygon fill="url(#value-history-fill)" points={area} />
                <polyline
                    fill="none"
                    stroke={stroke}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={line}
                />
                {inspect ? (
                    <line
                        x1={xAt(shown)}
                        x2={xAt(shown)}
                        y1={PLOT.top}
                        y2={base}
                        stroke={theme.palette.divider}
                    />
                ) : null}
                <circle
                    cx={xAt(shown)}
                    cy={yAt(points[shown].value)}
                    r="4"
                    fill={stroke}
                    stroke={theme.palette.background.paper}
                    strokeWidth="2"
                />
                <text x={xAt(0)} y={PLOT.height - 6} fill={labelFill} fontSize="11" textAnchor="start">
                    {formatHistoryDate(points[0].date)}
                </text>
                <text x={xAt(lastIdx)} y={PLOT.height - 6} fill={labelFill} fontSize="11" textAnchor="end">
                    {formatHistoryDate(points[lastIdx].date)}
                </text>
            </Box>
            {inspect ? (
                <Box
                    data-testid="value-history-inspect"
                    sx={{
                        position: 'absolute',
                        left: xAt(shown),
                        top: yAt(inspect.value),
                        transform: tooltipShift(xAt(shown), width),
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
                    {formatMoverMoney(inspect.value, priceSource)}
                </Box>
            ) : null}
        </Box>
    );
};

/**
 * Collection Stats "Value over time": what the cards held today were worth on
 * each of the last 30 or 90 days, in the selected price source. [copies] maps
 * printing id to copies held; [loading] is true while the Binder is still loading.
 */
const ValueOverTime = ({ copies, priceSource, loading = false }) => {
    const [days, setDays] = useState(30);
    const [rows, setRows] = useState(null);
    const [error, setError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const copiesKey = useMemo(
        () => Object.keys(copies || {}).sort().map((id) => `${id}:${copies[id]}`).join(','),
        [copies],
    );

    useEffect(() => {
        if (!copiesKey) {
            setRows([]);
            setError(false);
            return undefined;
        }
        let cancelled = false;
        setRows(null);
        setError(false);
        collectionValueHistory(priceSource, copies, { days: FETCH_DAYS })
            .then((fetched) => {
                if (!cancelled) setRows(Array.isArray(fetched) ? fetched : []);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });
        return () => {
            cancelled = true;
        };
        // copiesKey stands in for the copies object, which is rebuilt each render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [copiesKey, priceSource, reloadKey]);

    const allPoints = useMemo(() => valueHistoryPoints(rows), [rows]);
    const points = useMemo(() => lastDays(allPoints, days), [allPoints, days]);
    const change = valueChange(points);
    const label = sourceLabel(priceSource);
    const up = !change || change.amount >= 0;
    const color = up ? 'success' : 'error';
    const covered = spanDays(points);

    return (
        <Box component="section" data-testid="value-over-time" sx={{ mb: 4 }}>
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
                <Typography variant="h3" component="h2" sx={{ color: 'text.primary' }}>
                    Value over time
                </Typography>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={days}
                    onChange={(_, v) => v != null && setDays(v)}
                    aria-label="Value history window"
                    sx={segmentSx}
                >
                    {WINDOWS.map((d) => (
                        <ToggleButton key={d} value={d}>{`${d} days`}</ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>
            <Panel sx={{ p: { xs: 2, sm: 3 } }}>
                {error ? (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" sx={{ color: 'text.primary', mb: 1 }}>
                            Couldn’t load the value history from {label}.
                        </Typography>
                        <Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>
                    </Box>
                ) : loading || rows === null ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={28} />
                    </Box>
                ) : points.length < 2 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Not enough {label} price history for these cards yet.
                    </Typography>
                ) : (
                    <>
                        <Typography
                            data-testid="value-over-time-change"
                            sx={{ color: 'text.secondary', mb: 1.5, fontVariantNumeric: 'tabular-nums' }}
                        >
                            <Box component="span" sx={{ color: `${color}.main`, fontWeight: 800, fontSize: '1.15rem' }}>
                                {formatMoverAmount(change.amount, priceSource)}
                                {change.ratio == null ? '' : ` (${formatMoverPercent(change.ratio)})`}
                            </Box>
                            {' '}over {covered === 1 ? '1 day' : `${covered} days`} · was{' '}
                            {formatMoverMoney(change.start, priceSource)} →{' '}
                            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
                                {formatMoverMoney(change.latest, priceSource)}
                            </Box>
                        </Typography>
                        <ValueChart points={points} priceSource={priceSource} color={color} />
                    </>
                )}
            </Panel>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5, maxWidth: 760 }}>
                The cards in this Binder today, valued at each day’s {label}{' '}
                {priceSource === 'cardmarket' ? 'Trend' : 'Market'} price. Cards you added or removed along the
                way are not reflected.
            </Typography>
        </Box>
    );
};

export default ValueOverTime;
