import { Box, List, ListItemButton, Typography } from '@mui/material';
import { useCardDetail } from '../../contexts/CardDetailContext.jsx';
import { usePriceType } from '../../contexts/PriceContext.jsx';
import { formatCurrency } from '../../utils/helpers.js';

/**
 * Catalog Printing results for Browse Sets. Selecting a row opens
 * the snapshot Printing via existing openDetail. Trends search uses
 * mover boxes instead — do not import this on `/trends`.
 */
const CatalogPrintingResults = ({ printings }) => {
    const { openDetail } = useCardDetail();
    const { priceSource } = usePriceType();
    const textColor = 'text.primary';
    const mutedColor = 'text.secondary';

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
        <List
            disablePadding
            sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: '14px',
                p: 0.75,
            }}
        >
            {printings.map((printing) => (
                <ListItemButton
                    key={printing._uniqueId}
                    onClick={() => openDetail(printing)}
                    sx={{ px: 1.5, py: 1 }}
                >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ color: textColor, fontWeight: 600 }}>
                            {printing.name}
                        </Typography>
                        <Typography variant="body2" noWrap sx={{ color: mutedColor }}>
                            {[printing._setName, printing.subTypeName].filter(Boolean).join(' · ')}
                        </Typography>
                    </Box>
                    <Typography sx={{ color: textColor, fontWeight: 700, ml: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {formatPrice(printing)}
                    </Typography>
                </ListItemButton>
            ))}
        </List>
    );
};

export default CatalogPrintingResults;
