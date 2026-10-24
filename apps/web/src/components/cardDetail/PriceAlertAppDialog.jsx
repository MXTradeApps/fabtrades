import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material';
import { Apple, Android } from '@mui/icons-material';
import { APP_STORE_URL, PLAY_STORE_URL } from '../../utils/appLinks.js';

/**
 * Price alerts are set in the mobile app, which can send the push when a
 * price moves. The web points people there instead of creating one.
 */
export default function PriceAlertAppDialog({ open, onClose, cardName }) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="price-alert-app-title">
            <DialogTitle id="price-alert-app-title">Set price alerts in the app</DialogTitle>
            <DialogContent>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
                    {cardName
                        ? `Open ${cardName} in the FAB Trades app and tap the bell to get a notification when it rises to or drops to your price.`
                        : 'Open a card in the FAB Trades app and tap the bell to get a notification when it rises to or drops to your price.'}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2.5 }}>
                    <Button
                        variant="contained"
                        startIcon={<Apple />}
                        href={APP_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        fullWidth
                    >
                        Get it on the App Store
                    </Button>
                    <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<Android />}
                        href={PLAY_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        fullWidth
                    >
                        Get it on Google Play
                    </Button>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Not now</Button>
            </DialogActions>
        </Dialog>
    );
}
