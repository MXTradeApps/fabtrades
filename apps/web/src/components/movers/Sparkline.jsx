import { Box } from '@mui/material';

/**
 * Small price line for a mover row. [values] are daily Lows oldest first;
 * fewer than two points draws nothing. Purely decorative (aria-hidden): the
 * row already states was → now in text.
 */
const Sparkline = ({ values, color = 'text.secondary', width = 84, height = 30 }) => {
    const points = (values || []).map(Number).filter((v) => Number.isFinite(v));
    if (points.length < 2) return <Box sx={{ width, height, flexShrink: 0 }} />;

    const pad = 3;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const xy = points.map((v, i) => [
        pad + (i * (width - 2 * pad)) / (points.length - 1),
        height - pad - ((v - min) / range) * (height - 2 * pad),
    ]);
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const [lastX, lastY] = xy[xy.length - 1];
    const area = `${line} L${lastX.toFixed(1)} ${height} L${pad} ${height} Z`;

    return (
        <Box
            component="svg"
            data-testid="mover-sparkline"
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            sx={{ width, height, flexShrink: 0, color, display: 'block' }}
        >
            <path d={area} fill="currentColor" opacity={0.12} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
            <circle cx={lastX} cy={lastY} r={2.4} fill="currentColor" />
        </Box>
    );
};

export default Sparkline;
