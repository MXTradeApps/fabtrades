import React, { useMemo, useState } from 'react';
import { 
    Box, 
    Typography, 
    Button, 
    Tooltip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Snackbar,
    Alert,
    FormControlLabel,
    Checkbox,
} from '@mui/material';
import { 
    Warning as WarningIcon,
    Clear as ClearIcon,
    ContentCopy as ContentCopyIcon,
    Forum as ForumIcon,
    CheckCircle as CheckCircleIcon,
    Campaign as CampaignIcon,
} from '@mui/icons-material';
import SalePostDialog from "../binder/SalePostDialog.jsx";
import { generateTradeOffer } from "../../utils/tradeOffer.js";
import { confirmTrade } from "../../services/confirmTrade.js";
import { FreeLimits } from "../../utils/freeLimits.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { fonts, tk } from "../../theme/tokens.js";

// Copy text to the clipboard with a fallback for non-secure contexts.
const copyTextToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
};

// Whole amounts stay short ($12); anything with cents always shows both digits.
const money = (value) => {
    const amount = Math.round(Number(value || 0) * 100) / 100;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

// One side of the trade: label, card count, market total and observed Low.
const SideTotal = ({ label, count, market, low, tone, align = 'left', compact }) => (
    <Box sx={{ minWidth: 0, textAlign: align }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
            <Box aria-hidden sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: tone, flexShrink: 0 }} />
            <Typography
                component="span"
                sx={{ fontSize: compact ? '0.6875rem' : '0.75rem', fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}
            >
                {label} · {count} {count === 1 ? 'card' : 'cards'}
            </Typography>
        </Box>
        <Typography
            component="div"
            sx={{
                fontFamily: (t) => t.typography.h1.fontFamily,
                fontWeight: 750,
                fontStretch: '108%',
                fontSize: compact ? '1.125rem' : '1.375rem',
                lineHeight: 1.2,
                mt: 0.25,
                color: 'text.primary',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
            }}
        >
            {money(market)}
        </Typography>
        {low != null && Number(low) > 0 && (
            <Typography
                component="div"
                sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
            >
                Low {money(low)}
            </Typography>
        )}
    </Box>
);

// Two-sided bar: how the market value splits between what you give and get.
const BalanceBar = ({ give, get, height = 6 }) => {
    const total = Number(give || 0) + Number(get || 0);
    const givePct = total > 0 ? (Number(give || 0) / total) * 100 : 50;
    return (
        <Box
            role="img"
            aria-label={total > 0 ? `You give ${Math.round(givePct)}% of the trade value` : 'No cards in the trade yet'}
            sx={{ display: 'flex', gap: '3px', height, width: '100%' }}
        >
            <Box sx={{ width: `${givePct}%`, minWidth: 3, borderRadius: 999, bgcolor: total > 0 ? 'primary.main' : 'action.hover', transition: 'width 240ms ease' }} />
            <Box sx={{ flex: 1, minWidth: 3, borderRadius: 999, bgcolor: total > 0 ? 'success.main' : 'action.hover', transition: 'width 240ms ease' }} />
        </Box>
    );
};

const TradeSummary = ({ 
    haveList, 
    wantList, 
    haveTotal, 
    wantTotal,
    haveLowTotal = 0,
    wantLowTotal = 0,
    diff,
    lowDiff = 0,
    isLandscape = false,
    clearURLTradeData,
    clearTrade,
    urlTradeData,
    hasLoadedFromURL,
}) => {
    const { user } = useAuth();
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showTradeOffer, setShowTradeOffer] = useState(false);
    const [showTradePost, setShowTradePost] = useState(false);
    const [tradeOfferText, setTradeOfferText] = useState('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [removeGiven, setRemoveGiven] = useState(true);
    const [addReceived, setAddReceived] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Calculate total card count including quantities
    const getTotalCardCount = (cardList) => {
        return cardList.reduce((sum, card) => sum + (card.quantity || 1), 0);
    };

    const haveCardCount = getTotalCardCount(haveList);
    const wantCardCount = getTotalCardCount(wantList);
    const canGenerateTradeOffer = haveList.length > 0 || wantList.length > 0;

    // The trade post reads "Cards I Want" as Looking for and "Cards I Have" as Have.
    const toPostItems = (list) =>
        list.map((card) => ({
            name: card.name,
            finish: card.subTypeName,
            quantity: card.quantity || 1,
            price: card.price || null,
        }));
    const postHave = useMemo(() => toPostItems(haveList), [haveList]);
    const postWant = useMemo(() => toPostItems(wantList), [wantList]);

    const handleClearTradeData = () => {
        clearURLTradeData();
        setShowClearConfirm(false);
    };

    const handleGenerateTradeOffer = () => {
        const text = generateTradeOffer({
            haveList,
            wantList,
            haveTotal,
            wantTotal,
            diff,
            pricedAsOf: new Date(),
        });
        setTradeOfferText(text);
        setShowTradeOffer(true);
    };

    const handleCopyTradeOffer = async () => {
        try {
            await copyTextToClipboard(tradeOfferText);
            setSnackbar({ open: true, message: 'Copied — send it to the trade poster', severity: 'success' });
        } catch (err) {
            console.error('Failed to copy trade offer:', err);
            setSnackbar({ open: true, message: 'Could not copy — select the text and copy it manually', severity: 'error' });
        }
    };

    const handleOpenConfirmDialog = () => {
        setRemoveGiven(haveCardCount > 0);
        setAddReceived(wantCardCount > 0);
        setShowConfirmDialog(true);
    };

    const handleConfirmTrade = async () => {
        setConfirming(true);
        const { data, error, trimmed } = await confirmTrade({
            haveList,
            wantList,
            totals: { haveTotal, wantTotal, diff },
            removeGivenFromBinder: removeGiven && haveCardCount > 0,
            addReceivedToBinder: addReceived && wantCardCount > 0,
        });
        setConfirming(false);

        // History is written before binder reconcile. If that succeeded, always
        // clear the calculator so a retry cannot create a duplicate history row.
        if (data) {
            setShowConfirmDialog(false);
            if (typeof clearTrade === 'function') {
                clearTrade();
            }
        }

        if (error) {
            setSnackbar({
                open: true,
                message:
                    error.message
                    || (data
                        ? 'Trade saved, but binder could not be updated'
                        : 'Failed to confirm trade'),
                severity: data ? 'warning' : 'error',
            });
            return;
        }

        setSnackbar(
            trimmed > 0
                ? {
                    open: true,
                    message: `Trade confirmed. The free plan keeps your last ${FreeLimits.savedTrades} trades.`,
                    severity: 'info',
                }
                : { open: true, message: 'Trade confirmed', severity: 'success' },
        );
    };

    const formatAge = (ageInDays) => {
        if (ageInDays < 1) return 'less than a day';
        if (ageInDays < 7) return `${Math.round(ageInDays)} day${Math.round(ageInDays) !== 1 ? 's' : ''}`;
        if (ageInDays < 30) return `${Math.round(ageInDays / 7)} week${Math.round(ageInDays / 7) !== 1 ? 's' : ''}`;
        return `${Math.round(ageInDays / 30)} month${Math.round(ageInDays / 30) !== 1 ? 's' : ''}`;
    };

    const marketDiffLabel = money(Math.abs(diff));
    const lowDiffLabel = `${lowDiff > 0 ? '+' : lowDiff < 0 ? '−' : ''}${money(Math.abs(lowDiff))}`;
    const showLowDiff = Math.abs(lowDiff) >= 0.01 || haveLowTotal > 0 || wantLowTotal > 0;
    const even = Math.abs(diff) < 0.01;
    const verdict = even
        ? 'Even trade'
        : diff > 0
            ? `You give ${marketDiffLabel} more`
            : `You get ${marketDiffLabel} more`;
    const verdictColor = even ? 'text.secondary' : diff > 0 ? 'primary.main' : 'success.main';

    const clearUrlButton = hasLoadedFromURL && urlTradeData && (
        <Tooltip title="Clear loaded trade data from URL">
            <IconButton
                size="small"
                onClick={() => setShowClearConfirm(true)}
                aria-label="Clear loaded trade data from URL"
                sx={{ color: 'warning.main', p: 0.5 }}
            >
                <ClearIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );

    const ageWarning = urlTradeData && urlTradeData.ageInDays > 7 && (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.75,
            borderRadius: '10px',
            bgcolor: 'action.hover',
            color: 'warning.main',
        }}>
            <WarningIcon sx={{ fontSize: '1rem' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Shared trade prices are {formatAge(urlTradeData.ageInDays)} old
            </Typography>
        </Box>
    );

    const confirmButton = user && (
        <Tooltip title="Record the trade and update your Binder">
            <span style={{ display: 'block' }}>
                <Button
                    variant="contained"
                    size={isLandscape ? 'large' : 'small'}
                    fullWidth={isLandscape}
                    startIcon={<CheckCircleIcon />}
                    onClick={handleOpenConfirmDialog}
                    disabled={!canGenerateTradeOffer}
                >
                    Confirm Trade
                </Button>
            </span>
        </Tooltip>
    );

    const tradePostButton = (
        <Button
            variant="outlined"
            color="inherit"
            size={isLandscape ? 'medium' : 'small'}
            startIcon={<CampaignIcon sx={{ fontSize: '1rem !important' }} />}
            onClick={() => setShowTradePost(true)}
            disabled={!canGenerateTradeOffer}
            fullWidth={isLandscape}
            sx={{ color: 'text.primary' }}
            data-testid="trade-post-button"
        >
            Post WTT/WTS
        </Button>
    );

    return (
        <>
        {isLandscape ? (
            <Box
                component="section"
                aria-label="Trade balance"
                sx={{
                    alignSelf: 'flex-start',
                    width: 312,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    p: 2.5,
                    borderRadius: '16px',
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    boxShadow: (t) => tk(t).shadowSm,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
                        Trade balance
                    </Typography>
                    {clearUrlButton}
                </Box>

                <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        Difference
                    </Typography>
                    <Typography
                        component="div"
                        sx={{
                            fontFamily: (t) => t.typography.h1.fontFamily,
                            fontWeight: 800,
                            fontStretch: '112%',
                            fontSize: '2.25rem',
                            lineHeight: 1.1,
                            letterSpacing: '-0.02em',
                            color: 'text.primary',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {even ? money(0) : marketDiffLabel}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 650, color: verdictColor, mt: 0.25 }}>
                        {verdict}
                    </Typography>
                    {showLowDiff && (
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
                            Low difference {lowDiffLabel}
                        </Typography>
                    )}
                </Box>

                <BalanceBar give={haveTotal} get={wantTotal} />

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    <SideTotal label="You give" count={haveCardCount} market={haveTotal} low={haveLowTotal} tone="primary.main" />
                    <SideTotal label="You get" count={wantCardCount} market={wantTotal} low={wantLowTotal} tone="success.main" align="right" />
                </Box>

                {ageWarning}

                {confirmButton}

                <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Replying to a Purple Discord trade?
                    </Typography>
                    <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<ForumIcon sx={{ fontSize: '1rem !important' }} />}
                        onClick={handleGenerateTradeOffer}
                        disabled={!canGenerateTradeOffer}
                        fullWidth
                        sx={{ color: 'text.primary' }}
                    >
                        Generate Trade Offer
                    </Button>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Posting your own WTT/WTS?
                    </Typography>
                    {tradePostButton}
                </Box>
            </Box>
        ) : (
            <Box
                component="section"
                aria-label="Trade balance"
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    px: 2,
                    py: 1.5,
                    bgcolor: 'background.paper',
                    borderTop: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                }}
            >
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 1 }}>
                    <SideTotal label="Give" count={haveCardCount} market={haveTotal} low={haveLowTotal} tone="primary.main" compact />
                    <Box sx={{ textAlign: 'center', minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'text.secondary' }}>
                            Difference
                        </Typography>
                        <Typography
                            sx={{
                                fontFamily: (t) => t.typography.h1.fontFamily,
                                fontWeight: 800,
                                fontStretch: '110%',
                                fontSize: '1.125rem',
                                lineHeight: 1.2,
                                color: verdictColor,
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {even ? money(0) : `${diff > 0 ? '+' : '−'}${marketDiffLabel}`}
                        </Typography>
                        {showLowDiff && (
                            <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                Low {lowDiffLabel}
                            </Typography>
                        )}
                    </Box>
                    <SideTotal label="Get" count={wantCardCount} market={wantTotal} low={wantLowTotal} tone="success.main" align="right" compact />
                </Box>
                <BalanceBar give={haveTotal} get={wantTotal} height={4} />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
                    {ageWarning}
                    {confirmButton}
                    {tradePostButton}
                    {clearUrlButton}
                </Box>
            </Box>
        )}

        {/* Clear Confirmation Dialog */}
        <Dialog open={showClearConfirm} onClose={() => setShowClearConfirm(false)}>
            <DialogTitle>Clear Loaded Trade Data?</DialogTitle>
            <DialogContent>
                <Typography>
                    This will clear the trade data that was loaded from the URL and remove the URL parameters.
                    Your current trade will remain but won't be linked to the shared URL anymore.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                <Button onClick={handleClearTradeData} color="warning" variant="contained">
                    Clear
                </Button>
            </DialogActions>
        </Dialog>

        {/* Generated Trade Offer Dialog */}
        <Dialog
            open={showTradeOffer}
            onClose={() => setShowTradeOffer(false)}
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle sx={{ pb: 1 }}>Trade Offer</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Copy this and send it to the trade poster on Purple Discord.
                </Typography>
                <TextField
                    value={tradeOfferText}
                    multiline
                    fullWidth
                    minRows={8}
                    maxRows={18}
                    InputProps={{
                        readOnly: true,
                        sx: {
                            fontFamily: fonts.mono,
                            fontSize: '0.85rem',
                            lineHeight: 1.45
                        }
                    }}
                    onFocus={(e) => e.target.select()}
                />
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={() => setShowTradeOffer(false)}>Close</Button>
                <Button
                    variant="contained"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyTradeOffer}
                >
                    Copy to Clipboard
                </Button>
            </DialogActions>
        </Dialog>

        {showTradePost && (
            <SalePostDialog
                open
                onClose={() => setShowTradePost(false)}
                items={postHave}
                wants={postWant}
            />
        )}

        {/* Confirm Trade Dialog */}
        <Dialog
            open={showConfirmDialog}
            onClose={() => !confirming && setShowConfirmDialog(false)}
            fullWidth
            maxWidth="xs"
        >
            <DialogTitle>Confirm Trade</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Giving {haveCardCount} {haveCardCount === 1 ? 'card' : 'cards'} ·
                    {' '}Receiving {wantCardCount} {wantCardCount === 1 ? 'card' : 'cards'}
                </Typography>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={removeGiven}
                            onChange={(e) => setRemoveGiven(e.target.checked)}
                            disabled={haveCardCount === 0 || confirming}
                        />
                    }
                    label={`Remove my ${haveCardCount} given ${haveCardCount === 1 ? 'card' : 'cards'} from Binder`}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={addReceived}
                            onChange={(e) => setAddReceived(e.target.checked)}
                            disabled={wantCardCount === 0 || confirming}
                        />
                    }
                    label={
                        <Box>
                            <Typography component="span" variant="body1">
                                Add their {wantCardCount} {wantCardCount === 1 ? 'card' : 'cards'} to my Binder
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Uncheck for deck-bound pulls
                            </Typography>
                        </Box>
                    }
                />
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={() => setShowConfirmDialog(false)} disabled={confirming}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleConfirmTrade}
                    disabled={confirming}
                    startIcon={<CheckCircleIcon />}
                >
                    {confirming ? 'Confirming…' : 'Confirm'}
                </Button>
            </DialogActions>
        </Dialog>

        <Snackbar
            open={snackbar.open}
            autoHideDuration={3000}
            onClose={() => setSnackbar(s => ({ ...s, open: false }))}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
            <Alert
                onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                severity={snackbar.severity}
                variant="filled"
                sx={{ width: '100%' }}
            >
                {snackbar.message}
            </Alert>
        </Snackbar>
        </>
    );
};

export default TradeSummary;
