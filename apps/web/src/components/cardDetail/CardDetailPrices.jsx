import { Box, Typography } from '@mui/material';
import { formatTimestamp } from '../../utils/helpers.js';

const isUnpriced = (value) =>
    value === null || value === undefined || value === '' || Number(value) === 0 || Number.isNaN(Number(value));

/**
 * Format a catalog price. Missing and zero are unpriced (`—`), never `$0.00` / `€0.00`.
 */
export function formatCatalogPrice(value, currency = 'USD') {
    if (isUnpriced(value)) return '—';
    const n = Number(value);
    if (currency === 'EUR') return `€${n.toFixed(2)}`;
    return `$${n.toFixed(2)}`;
}

const isFoilFinish = (subTypeName) => {
    const sub = (subTypeName || '').toLowerCase();
    return sub.includes('foil');
};

const cardMarketValue = (printing, baseKey, foilKey) => {
    if (isFoilFinish(printing?.subTypeName)) {
        const foil = printing?.[foilKey];
        if (!isUnpriced(foil)) return foil;
    }
    return printing?.[baseKey];
};

const PriceRow = ({ label, value, currency, isDark }) => (
    <Box
        sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2,
            py: 0.25,
        }}
    >
        <Typography
            component="dt"
            sx={{
                fontSize: '0.8rem',
                color: isDark ? 'rgba(212, 165, 116, 0.75)' : 'rgba(93, 58, 26, 0.7)',
            }}
        >
            {label}
        </Typography>
        <Typography
            component="dd"
            sx={{
                fontSize: '0.8rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                m: 0,
                color: isDark ? '#f5f1ed' : '#2c1810',
            }}
        >
            {formatCatalogPrice(value, currency)}
        </Typography>
    </Box>
);

const PriceGroup = ({ title, currency, rows, isDark }) => (
    <Box sx={{ flex: 1, minWidth: 140 }}>
        <Typography
            variant="subtitle2"
            sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: isDark ? '#e4c09c' : '#8b4513',
                mb: 0.75,
            }}
        >
            {title}
        </Typography>
        <Box component="dl" sx={{ m: 0 }}>
            {rows.map(([label, value]) => (
                <PriceRow
                    key={label}
                    label={label}
                    value={value}
                    currency={currency}
                    isDark={isDark}
                />
            ))}
        </Box>
    </Box>
);

/**
 * Dual-marketplace Prices for the selected Printing. Unpriced is — never zero.
 */
const CardDetailPrices = ({ printing, pricesUpdatedAt, isDark = false }) => {
    const tcgRows = [
        ['Market', printing?.marketPrice],
        ['Low', printing?.lowPrice],
        ['Mid', printing?.midPrice],
        ['High', printing?.highPrice],
        ['Direct low', printing?.directLowPrice],
    ];
    const cmRows = [
        ['Trend', cardMarketValue(printing, 'cardmarketTrend', 'cardmarketTrendFoil')],
        ['Low', cardMarketValue(printing, 'cardmarketLow', 'cardmarketLowFoil')],
        ['Avg', cardMarketValue(printing, 'cardmarketAvg', 'cardmarketAvgFoil')],
    ];

    return (
        <Box>
            <Typography
                variant="subtitle1"
                sx={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: isDark ? '#f5f1ed' : '#2c1810',
                    mb: 1,
                }}
            >
                Prices
            </Typography>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 2, sm: 3 },
                }}
            >
                <PriceGroup title="TCGplayer" currency="USD" rows={tcgRows} isDark={isDark} />
                <PriceGroup title="CardMarket" currency="EUR" rows={cmRows} isDark={isDark} />
            </Box>
            <Typography
                sx={{
                    mt: 1.25,
                    fontSize: '0.7rem',
                    color: isDark ? 'rgba(212, 165, 116, 0.65)' : 'rgba(93, 58, 26, 0.55)',
                    lineHeight: 1.35,
                }}
            >
                Prices from the FAB Trades catalog (TCGplayer and CardMarket)
                {pricesUpdatedAt ? ` · Updated ${formatTimestamp(pricesUpdatedAt)}` : ''}.
            </Typography>
        </Box>
    );
};

export default CardDetailPrices;
