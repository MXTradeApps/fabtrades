import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { listPriceAlertsForCard } from '../../services/priceAlerts.js';
import { formatCatalogPrice } from './CardDetailPrices.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const currencyFor = (alert) => (alert.source === 'cardmarket' ? 'EUR' : 'USD');

/** "Rises to $25.00" / "Drops to €4.00", matching the app's wording. */
export function alertConditionLabel(alert) {
    const verb = alert.direction === 'below' ? 'Drops to' : 'Rises to';
    return `${verb} ${formatCatalogPrice(alert.target_price, currencyFor(alert))}`;
}

/** "Hit Oct 20 at $26.00" once fired, otherwise "Watching". */
export function alertStatusLabel(alert) {
    if (!alert.triggered_at) return 'Watching';
    const at = new Date(alert.triggered_at);
    const day = `${MONTHS[at.getUTCMonth()]} ${at.getUTCDate()}`;
    const price = alert.triggered_price == null
        ? ''
        : ` at ${formatCatalogPrice(alert.triggered_price, currencyFor(alert))}`;
    return `Hit ${day}${price}`;
}

/**
 * The signed-in user's alerts on this printing, read-only. Nothing renders
 * when there are none; the "Price alert" action covers setting one.
 */
export default function CardPriceAlerts({ printingId, signedIn }) {
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        if (!signedIn || !printingId) {
            setAlerts([]);
            return undefined;
        }
        let cancelled = false;
        listPriceAlertsForCard(printingId).then(({ data }) => {
            if (!cancelled) setAlerts(data || []);
        });
        return () => {
            cancelled = true;
        };
    }, [printingId, signedIn]);

    if (alerts.length === 0) return null;

    return (
        <Box>
            <Typography variant="overline" component="h3" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Your price alerts
            </Typography>
            <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {alerts.map((alert) => (
                    <Box
                        component="li"
                        key={alert.id}
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            gap: 2,
                            py: 0.6,
                            '& + &': { borderTop: 1, borderColor: 'divider' },
                        }}
                    >
                        <Typography sx={{ fontSize: '0.84375rem', fontWeight: 600, color: 'text.primary' }}>
                            {alertConditionLabel(alert)}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: '0.8125rem',
                                color: alert.triggered_at ? 'primary.main' : 'text.secondary',
                                fontWeight: alert.triggered_at ? 700 : 400,
                            }}
                        >
                            {alertStatusLabel(alert)}
                        </Typography>
                    </Box>
                ))}
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.75 }}>
                Manage alerts in the FAB Trades app.
            </Typography>
        </Box>
    );
}
