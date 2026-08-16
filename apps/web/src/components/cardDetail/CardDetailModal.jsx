import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogContent,
    IconButton,
    Snackbar,
    Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useLocation } from 'react-router-dom';
import { useCardDetail } from '../../contexts/CardDetailContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useEntitlement } from '../../contexts/EntitlementContext.jsx';
import { useCardData } from '../../hooks/useCardData.jsx';
import { useThemeMode } from '../../contexts/ThemeContext.jsx';
import { CardImageModal, CardThumbnail } from '../ui/CardImagePreview.jsx';
import SignInDialog from '../auth/SignInDialog.jsx';
import CardDetailPrices from './CardDetailPrices.jsx';
import { printingsForCard } from '../../utils/printingsForCard.js';
import { upsertEntry, getBinderEntries } from '../../services/binder.js';
import { canAddDistinctCard, cardsFor } from '../../utils/freeLimits.js';
import { formatCardType } from '../../utils/searchUtils.js';

const WANT_LIMIT_MESSAGE = `Want lists hold ${cardsFor({ isWanted: true })} cards on the free plan. Subscribe in the FABTrades app to add more.`;

function versionLabel(card) {
    const finish = formatCardType(card.subTypeName) || card.subTypeName || 'Normal';
    const set = card._setName || card.extNumber || '';
    return set ? `${set} · ${finish}` : finish;
}

/**
 * Overlay inspect surface. Bound to CardDetailContext by {@link CardDetailHost}.
 */
export function CardDetailModal({
    open,
    printing,
    onClose,
    addWantCard = null,
}) {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const { isPro } = useEntitlement();
    const { cards, pricesUpdatedAt } = useCardData();
    const { isDark } = useThemeMode();

    const [selected, setSelected] = useState(printing);
    const [zoomOpen, setZoomOpen] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);
    const [ownQty, setOwnQty] = useState(null);
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
    const [wantBusy, setWantBusy] = useState(false);

    useEffect(() => {
        setSelected(printing);
        setZoomOpen(false);
    }, [printing]);

    const shown = selected || printing;
    const siblings = useMemo(
        () => printingsForCard(cards, shown),
        [cards, shown],
    );

    useEffect(() => {
        if (!open || !user || !shown?._uniqueId) {
            setOwnQty(null);
            return undefined;
        }
        let cancelled = false;
        getBinderEntries().then(({ data }) => {
            if (cancelled || !data) return;
            const entry = (data.binder || []).find((e) => e.cardId === shown._uniqueId);
            setOwnQty(entry?.quantity ?? null);
        });
        return () => {
            cancelled = true;
        };
    }, [open, user, shown?._uniqueId]);

    const showAddToTrade = pathname === '/' && typeof addWantCard === 'function';
    const hasArt = Boolean(shown?.imageUrl || shown?.imageUrlFallback);
    const finishLabel = formatCardType(shown?.subTypeName) || shown?.subTypeName || 'Normal';
    const identityLine = [shown?._setName, shown?.extNumber, finishLabel]
        .filter(Boolean)
        .join(' · ');

    const showSuccess = (message) => {
        setToast({ open: true, message, severity: 'success' });
    };

    const handleAddToTrade = () => {
        if (!showAddToTrade || !shown) return;
        addWantCard({
            label: shown.displayName || shown.name,
            card: shown,
        });
        showSuccess(`Added ${shown.name} to Want`);
    };

    const handleWantList = async () => {
        if (!shown?._uniqueId) return;
        if (!user) {
            setSignInOpen(true);
            return;
        }
        setWantBusy(true);
        const { data: lists, error: listError } = await getBinderEntries();
        if (listError || !lists) {
            setWantBusy(false);
            setToast({
                open: true,
                message: listError?.message || 'Could not update Want List',
                severity: 'error',
            });
            return;
        }
        const wants = lists.wants || [];
        const existing = wants.find((e) => e.cardId === shown._uniqueId);
        if (!existing && !canAddDistinctCard(wants.length, { isWanted: true, isPro })) {
            setWantBusy(false);
            setToast({ open: true, message: WANT_LIMIT_MESSAGE, severity: 'warning' });
            return;
        }
        const { error } = await upsertEntry({
            cardId: shown._uniqueId,
            isWanted: true,
            quantity: existing ? existing.quantity + 1 : 1,
            condition: existing?.condition || 'NM',
            card: shown,
            addedAt: existing?.addedAt,
        });
        setWantBusy(false);
        if (error) {
            setToast({
                open: true,
                message: error.message || 'Could not add to Want List',
                severity: 'error',
            });
            return;
        }
        showSuccess(`Added ${shown.name} to Want List`);
    };

    const textColor = isDark ? '#f5f1ed' : '#2c1810';
    const muted = isDark ? 'rgba(212, 165, 116, 0.75)' : 'rgba(93, 58, 26, 0.7)';

    return (
        <>
            <Dialog
                open={Boolean(open && shown)}
                onClose={onClose}
                maxWidth="sm"
                fullWidth
                disableRestoreFocus={false}
                aria-labelledby="card-detail-title"
                PaperProps={{
                    sx: {
                        backgroundColor: isDark ? '#1a0f0a' : '#f5f1ed',
                        backgroundImage: 'none',
                        border: isDark
                            ? '1px solid rgba(212, 165, 116, 0.25)'
                            : '1px solid rgba(139, 69, 19, 0.18)',
                    },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        px: 2,
                        pt: 1.5,
                        pb: 0,
                    }}
                >
                    <Typography
                        id="card-detail-title"
                        variant="h6"
                        sx={{ fontWeight: 700, color: textColor, pr: 1, lineHeight: 1.3 }}
                    >
                        {shown?.name || 'Card'}
                    </Typography>
                    <IconButton
                        aria-label="Close card details"
                        onClick={onClose}
                        size="small"
                        sx={{ color: muted }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                <DialogContent sx={{ pt: 1.5 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            gap: 2,
                            alignItems: 'flex-start',
                            mb: 2,
                        }}
                    >
                        {hasArt ? (
                            <Box
                                component="button"
                                type="button"
                                onClick={() => setZoomOpen(true)}
                                aria-label={`Zoom art for ${shown.name}`}
                                sx={{
                                    p: 0,
                                    border: 0,
                                    background: 'none',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                }}
                            >
                                <CardThumbnail
                                    imageUrl={shown.imageUrl}
                                    fallbackUrl={shown.imageUrlFallback}
                                    alt={shown.name}
                                    size={88}
                                />
                            </Box>
                        ) : (
                            <Box
                                aria-label="No art"
                                sx={{
                                    width: 88,
                                    height: 88 * 1.4,
                                    borderRadius: 1,
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isDark
                                        ? 'rgba(200, 113, 55, 0.15)'
                                        : 'rgba(139, 69, 19, 0.1)',
                                    border: isDark
                                        ? '1px solid rgba(200, 113, 55, 0.2)'
                                        : '1px solid rgba(139, 69, 19, 0.15)',
                                }}
                            >
                                <Typography sx={{ fontSize: '0.7rem', color: muted, textAlign: 'center', px: 0.5 }}>
                                    No art
                                </Typography>
                            </Box>
                        )}

                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontSize: '0.85rem', color: muted, mb: 0.75 }}>
                                {identityLine || 'Printing'}
                            </Typography>
                            {user && ownQty != null && ownQty > 0 && (
                                <Chip
                                    size="small"
                                    label={`Own ${ownQty}`}
                                    sx={{
                                        height: 22,
                                        fontWeight: 700,
                                        fontSize: '0.7rem',
                                        mb: 0.75,
                                        backgroundColor: isDark
                                            ? 'rgba(212, 165, 116, 0.2)'
                                            : 'rgba(139, 69, 19, 0.12)',
                                        color: isDark ? '#e4c09c' : '#8b4513',
                                    }}
                                />
                            )}
                        </Box>
                    </Box>

                    {siblings.length >= 2 && (
                        <Box sx={{ mb: 2 }}>
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
                                Versions
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                {siblings.map((sib) => {
                                    const active = sib._uniqueId === shown._uniqueId;
                                    return (
                                        <Chip
                                            key={sib._uniqueId}
                                            label={versionLabel(sib)}
                                            onClick={() => setSelected(sib)}
                                            variant={active ? 'filled' : 'outlined'}
                                            color={active ? 'primary' : 'default'}
                                            sx={{ fontWeight: active ? 700 : 500 }}
                                        />
                                    );
                                })}
                            </Box>
                        </Box>
                    )}

                    <CardDetailPrices
                        printing={shown}
                        pricesUpdatedAt={pricesUpdatedAt}
                        isDark={isDark}
                    />

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2.5 }}>
                        {showAddToTrade && (
                            <Button
                                variant="contained"
                                onClick={handleAddToTrade}
                            >
                                Add to trade
                            </Button>
                        )}
                        <Button
                            variant={showAddToTrade ? 'outlined' : 'contained'}
                            onClick={handleWantList}
                            disabled={wantBusy}
                        >
                            Want List
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>

            <CardImageModal
                open={zoomOpen}
                onClose={() => setZoomOpen(false)}
                imageUrl={shown?.imageUrl}
                fallbackUrl={shown?.imageUrlFallback}
                cardName={shown?.name}
            />

            <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />

            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={() => setToast((t) => ({ ...t, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setToast((t) => ({ ...t, open: false }))}
                    severity={toast.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </>
    );
}

/** Renders the single app-shell modal from CardDetailContext. */
export function CardDetailHost() {
    const { open, printing, closeDetail, addWantCard } = useCardDetail();
    return (
        <CardDetailModal
            open={open}
            printing={printing}
            onClose={closeDetail}
            addWantCard={addWantCard}
        />
    );
}

export default CardDetailModal;
