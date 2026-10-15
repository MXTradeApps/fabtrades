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
    useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
    SwapHorizRounded,
    BookmarkBorderRounded,
    CollectionsBookmarkOutlined,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useCardDetail } from '../../contexts/CardDetailContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useCardData } from '../../hooks/useCardData.jsx';
import { useThemeMode } from '../../contexts/ThemeContext.jsx';
import { CardImageModal, CardThumbnail } from '../ui/CardImagePreview.jsx';
import SignInDialog from '../auth/SignInDialog.jsx';
import CardDetailPrices from './CardDetailPrices.jsx';
import PriceHistorySection from './PriceHistorySection.jsx';
import { printingsForCard } from '../../utils/printingsForCard.js';
import { upsertEntry, getBinderEntries } from '../../services/binder.js';
import { targetOwnedBinderId } from '../../utils/openBinder.js';
import { formatCardType } from '../../utils/searchUtils.js';

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
    const { cards, pricesUpdatedAt } = useCardData();
    const { isDark } = useThemeMode();
    const isPhone = useMediaQuery((t) => t.breakpoints.down('sm'));

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

    const handleAddToBinder = async () => {
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
                message: listError?.message || 'Could not update Binder',
                severity: 'error',
            });
            return;
        }
        const binderId = targetOwnedBinderId();
        const owned = lists.binder || [];
        const existing = owned.find((e) =>
            e.cardId === shown._uniqueId && (e.binderId || 'system:trade') === binderId,
        );
        const { error } = await upsertEntry({
            cardId: shown._uniqueId,
            isWanted: false,
            quantity: existing ? existing.quantity + 1 : 1,
            condition: existing?.condition || 'NM',
            binderId,
            card: shown,
            addedAt: existing?.addedAt,
        });
        setWantBusy(false);
        if (error) {
            setToast({
                open: true,
                message: error.message || 'Could not add to Binder',
                severity: 'error',
            });
            return;
        }
        showSuccess(`Added ${shown.name} to Binder`);
    };

    return (
        <>
            <Dialog
                open={Boolean(open && shown)}
                onClose={onClose}
                maxWidth="md"
                fullWidth
                fullScreen={isPhone}
                disableRestoreFocus={false}
                aria-labelledby="card-detail-title"
                PaperProps={{
                    sx: isPhone ? { borderRadius: 0, border: 0 } : { maxWidth: 820 },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 1,
                        px: { xs: 2, sm: 3 },
                        pt: { xs: 'calc(12px + env(safe-area-inset-top, 0px))', sm: 2.5 },
                        pb: 0,
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            id="card-detail-title"
                            variant="h3"
                            component="h2"
                            sx={{ color: 'text.primary', textWrap: 'balance' }}
                        >
                            {shown?.name || 'Card'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 0.75 }}>
                            <Typography sx={{ fontSize: '0.84375rem', color: 'text.secondary' }}>
                                {identityLine || 'Printing'}
                            </Typography>
                            {user && ownQty != null && ownQty > 0 && (
                                <Chip
                                    size="small"
                                    color="primary"
                                    label={`Own ${ownQty}`}
                                    sx={{ height: 22, fontSize: '0.72rem' }}
                                />
                            )}
                        </Box>
                    </Box>
                    <IconButton
                        aria-label="Close card details"
                        onClick={onClose}
                        size="small"
                        sx={{ color: 'text.secondary', mt: -0.25, mr: -1 }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: { xs: 3, sm: 3 } }}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '112px minmax(0, 1fr)', sm: '200px minmax(0, 1fr)' },
                            gridTemplateAreas: {
                                xs: '"art actions" "info info"',
                                sm: '"art info" "actions info"',
                            },
                            gridTemplateRows: { sm: 'auto 1fr' },
                            columnGap: { xs: 2, sm: 3 },
                            rowGap: { xs: 2.5, sm: 2 },
                            alignItems: 'start',
                        }}
                    >
                        <Box sx={{ gridArea: 'art' }}>
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
                                        cursor: 'zoom-in',
                                        flexShrink: 0,
                                        width: { xs: 112, sm: 200 },
                                        display: 'block',
                                    }}
                                >
                                    <CardThumbnail
                                        imageUrl={shown.imageUrl}
                                        fallbackUrl={shown.imageUrlFallback}
                                        alt={shown.name}
                                        size={isPhone ? 112 : 200}
                                    />
                                </Box>
                            ) : (
                                <Box
                                    aria-label="No art"
                                    sx={{
                                        width: { xs: 112, sm: 200 },
                                        aspectRatio: '5 / 7',
                                        borderRadius: '8px',
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: 'surface.sunken',
                                        border: 1,
                                        borderColor: 'divider',
                                    }}
                                >
                                    <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', textAlign: 'center', px: 0.5 }}>
                                        No art
                                    </Typography>
                                </Box>
                            )}

                        </Box>

                        <Box sx={{ gridArea: 'info', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {siblings.length >= 2 && (
                                <Box>
                                    <Typography variant="overline" component="h3" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
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

                            {shown?._uniqueId && (
                                <PriceHistorySection
                                    printingId={shown._uniqueId}
                                    isDark={isDark}
                                />
                            )}
                        </Box>

                            <Box sx={{ gridArea: 'actions', display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, alignSelf: { xs: 'center', sm: 'start' } }}>
                                {showAddToTrade && (
                                    <Button
                                        variant="contained"
                                        startIcon={<SwapHorizRounded />}
                                        onClick={handleAddToTrade}
                                        fullWidth
                                    >
                                        Add to trade
                                    </Button>
                                )}
                                <Button
                                    variant={showAddToTrade ? 'outlined' : 'contained'}
                                    color={showAddToTrade ? 'inherit' : 'primary'}
                                    startIcon={<BookmarkBorderRounded />}
                                    onClick={handleWantList}
                                    disabled={wantBusy}
                                    fullWidth
                                >
                                    Want List
                                </Button>
                                <Button
                                    variant="outlined"
                                    color="inherit"
                                    startIcon={<CollectionsBookmarkOutlined />}
                                    onClick={handleAddToBinder}
                                    disabled={wantBusy}
                                    fullWidth
                                >
                                    Binder
                                </Button>
                            </Box>
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
