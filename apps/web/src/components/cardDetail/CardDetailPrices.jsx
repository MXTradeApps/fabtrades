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

const PriceRow = ({ label, value, currency, lead = false }) => (
    <Box
        sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 2,
            py: 0.6,
            '& + &': { borderTop: 1, borderColor: 'divider' },
        }}
    >
        <Typography
            component="dt"
            sx={{
                fontSize: '0.8125rem',
                color: 'text.secondary',
            }}
        >
            {label}
        </Typography>
        <Typography
            component="dd"
            sx={{
                fontSize: lead ? '1rem' : '0.84375rem',
                fontWeight: lead ? 750 : 600,
                fontVariantNumeric: 'tabular-nums',
                m: 0,
                color: 'text.primary',
            }}
        >
            {formatCatalogPrice(value, currency)}
        </Typography>
    </Box>
);

const PriceGroup = ({ title, currency, rows }) => (
    <Box
        sx={{
            flex: 1,
            minWidth: 0,
            px: 1.75,
            py: 1.25,
            borderRadius: '12px',
            bgcolor: 'surface.sunken',
        }}
    >
        <Typography
            variant="overline"
            component="h4"
            sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}
        >
            {title}
        </Typography>
        <Box component="dl" sx={{ m: 0 }}>
            {rows.map(([label, value], idx) => (
                <PriceRow
                    key={label}
                    label={label}
                    value={value}
                    currency={currency}
                    lead={idx === 0}
                />
            ))}
        </Box>
    </Box>
);

/**
 * Dual-marketplace Prices for the selected Printing. Unpriced is — never zero.
 */
// eslint-disable-next-line no-unused-vars
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
                variant="h5"
                component="h3"
                sx={{ color: 'text.primary', mb: 1.25 }}
            >
                Prices
            </Typography>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.25,
                    alignItems: 'start',
                }}
            >
                <PriceGroup title="TCGplayer" currency="USD" rows={tcgRows} />
                <PriceGroup title="CardMarket" currency="EUR" rows={cmRows} />
            </Box>
            <Typography
                sx={{
                    mt: 1.25,
                    fontSize: '0.72rem',
                    color: 'text.secondary',
                    lineHeight: 1.4,
                }}
            >
                Prices from the FAB Trades catalog (TCGplayer and CardMarket)
                {pricesUpdatedAt ? ` · Updated ${formatTimestamp(pricesUpdatedAt)}` : ''}.
            </Typography>
        </Box>
    );
};

export default CardDetailPrices;
