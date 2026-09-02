import { Box, List, ListItemButton, Typography } from '@mui/material';
import { useCardDetail } from '../../contexts/CardDetailContext.jsx';
import { useThemeMode } from '../../contexts/ThemeContext.jsx';
import { usePriceType } from '../../contexts/PriceContext.jsx';
import { formatCurrency } from '../../utils/helpers.js';

/**
 * Catalog Printing results for Browse Sets. Selecting a row opens
 * the snapshot Printing via existing openDetail. Trends search uses
 * mover boxes instead — do not import this on `/trends`.
 */
const CatalogPrintingResults = ({ printings }) => {
    const { openDetail } = useCardDetail();
    const { isDark } = useThemeMode();
    const { priceSource } = usePriceType();
    const textColor = isDark ? '#f5f1ed' : '#2c1810';
    const mutedColor = isDark ? '#d4a574' : '#5d3a1a';

    const formatPrice = (printing) => {
        const amount = priceSource === 'cardmarket'
            ? printing.cardmarketLow
            : printing.lowPrice;
        if (amount == null || amount === 0) return '—';
        if (priceSource === 'cardmarket') {
            return new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            }).format(amount);
        }
        return formatCurrency(amount);
    };

    if (!printings.length) {
        return (
            <Typography variant="body2" sx={{ color: mutedColor, py: 2 }}>
                No Printings match your search.
            </Typography>
        );
    }

    return (
        <List disablePadding>
            {printings.map((printing) => (
                <ListItemButton
                    key={printing._uniqueId}
                    onClick={() => openDetail(printing)}
                    sx={{ px: 0.5, py: 1 }}
                >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ color: textColor, fontWeight: 600 }}>
                            {printing.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: mutedColor }}>
                            {[printing._setName, printing.subTypeName].filter(Boolean).join(' · ')}
                        </Typography>
                    </Box>
                    <Typography sx={{ color: textColor, fontWeight: 700, ml: 1 }}>
                        {formatPrice(printing)}
                    </Typography>
                </ListItemButton>
            ))}
        </List>
    );
};

export default CatalogPrintingResults;
