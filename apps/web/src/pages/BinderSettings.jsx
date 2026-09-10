import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useThemeMode } from '../contexts/ThemeContext.jsx';
import { useCardData } from '../hooks/useCardData.jsx';
import {
    applyImportAddsToEntries,
    copiesForDestination,
    FABRARY_DESTINATION,
    planFabraryImport,
} from '../utils/fabraryImportApply.js';
import {
    getBinderEntries,
    upsertEntries,
    ensureCollectionBinder,
    TRADE_BINDER_ID,
    COLLECTION_BINDER_ID,
} from '../services/binder.js';

const FABRARY_REFUSE_COPY = {
    not_fabrary: 'This is not a Fabrary collection export',
    no_owned: 'No Have, Want, or Extra quantities were found',
    no_matched: 'None of those cards were found in the catalog',
};

export const UNMATCHED_EXPLAIN =
    "These printings from your Fabrary export aren't in the FAB Trades catalog. Confirming still adds everything we could match; these copies will be skipped.";

async function readPickedFile(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function destinationBinderId(destination) {
    if (destination === FABRARY_DESTINATION.want) return null;
    if (destination === FABRARY_DESTINATION.trade) return TRADE_BINDER_ID;
    return COLLECTION_BINDER_ID;
}

function unmatchedLabel(row) {
    return [row.name, row.setNumber, row.foiling, row.treatment, row.edition]
        .filter(Boolean)
        .join(' · ');
}

const FabraryImportDialog = ({ open, onClose, onImported }) => {
    const { isDark } = useThemeMode();
    const { cards } = useCardData();
    const fileInputRef = useRef(null);
    const [working, setWorking] = useState(false);
    const [applying, setApplying] = useState(false);
    const [plan, setPlan] = useState(null);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const mutedColor = isDark ? '#d4a574' : '#5d3a1a';
    const accentColor = isDark ? '#e4c09c' : '#8b4513';
    const textColor = isDark ? '#f5f1ed' : '#2c1810';

    const catalogById = useMemo(() => {
        const map = new Map();
        for (const card of cards || []) {
            if (card._uniqueId) map.set(card._uniqueId, card);
        }
        return map;
    }, [cards]);

    useEffect(() => {
        if (open) return undefined;
        setWorking(false);
        setApplying(false);
        setPlan(null);
        setSuccess('');
        setError('');
        return undefined;
    }, [open]);

    const handleClose = () => {
        if (applying) return;
        onClose?.();
    };

    const onPickFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setWorking(true);
        setPlan(null);
        setSuccess('');
        setError('');
        try {
            const csv = await readPickedFile(file);
            const entryRes = await getBinderEntries();
            const latest = entryRes.data?.all || [
                ...(entryRes.data?.binder || []),
                ...(entryRes.data?.wants || []),
            ];
            const next = planFabraryImport({
                csv,
                catalog: cards || [],
                existingEntries: latest,
            });
            setPlan(next);
        } catch {
            setPlan({
                ok: false,
                refuseReason: 'not_fabrary',
                ownedCount: 0,
                matchedCount: 0,
                copiesToAdd: 0,
                unmatched: [],
                adds: [],
            });
        } finally {
            setWorking(false);
        }
    };

    const handleConfirm = async () => {
        if (!plan?.ok || applying) return;
        setApplying(true);
        setError('');
        if (plan.restoreCollection) {
            const restored = await ensureCollectionBinder();
            if (restored.error) {
                setError(restored.error.message || 'Could not restore Collection');
                setApplying(false);
                return;
            }
        }
        const entryRes = await getBinderEntries();
        const latest = entryRes.data?.all || [
            ...(entryRes.data?.binder || []),
            ...(entryRes.data?.wants || []),
        ];
        const combined = applyImportAddsToEntries(latest, plan.adds);
        const rows = plan.adds.map((add) => {
            const wanted = add.destination === FABRARY_DESTINATION.want;
            const binderId = destinationBinderId(add.destination);
            const entry = combined.find((row) => {
                const id = row.cardId || row.printingId;
                if (id !== add.printingId) return false;
                if (wanted) return Boolean(row.isWanted);
                return !row.isWanted
                    && (row.binderId || TRADE_BINDER_ID) === binderId
                    && (row.condition || 'NM') === 'NM';
            });
            return {
                cardId: add.printingId,
                quantity: entry?.quantity ?? add.quantity,
                binderId,
                isWanted: wanted,
                card: catalogById.get(add.printingId),
            };
        }).filter((row) => row.card);
        const { error: upsertError } = await upsertEntries(rows);
        if (upsertError) {
            setError(upsertError.message || 'Could not import');
            setApplying(false);
            return;
        }
        setSuccess(`Added ${plan.copiesToAdd} Near Mint copies`);
        setApplying(false);
        await onImported?.();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            aria-labelledby="fabrary-import-title"
            PaperProps={{
                sx: {
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: isDark ? '#1a0f0a' : '#f5f1ed',
                    backgroundImage: 'none',
                    border: isDark
                        ? '1px solid rgba(212, 165, 116, 0.25)'
                        : '1px solid rgba(139, 69, 19, 0.18)',
                },
            }}
        >
            <DialogTitle
                id="fabrary-import-title"
                sx={{
                    color: accentColor,
                    fontWeight: 700,
                    pr: 6,
                    flexShrink: 0,
                }}
            >
                Import from Fabrary
                <IconButton
                    aria-label="close"
                    onClick={handleClose}
                    disabled={applying}
                    sx={{ position: 'absolute', right: 8, top: 8, color: mutedColor }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    minHeight: 0,
                    overflow: 'hidden',
                    color: textColor,
                }}
            >
                <input
                    ref={fileInputRef}
                    data-testid="fabrary-file"
                    type="file"
                    accept=".csv,text/csv,.txt"
                    hidden
                    onChange={onPickFile}
                />
                <Box sx={{ flexShrink: 0 }}>
                    <Button
                        variant="contained"
                        data-testid="fabrary-choose"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={working || applying}
                    >
                        Choose CSV
                    </Button>
                </Box>
                {working && (
                    <Box data-testid="fabrary-working" sx={{ textAlign: 'center', flexShrink: 0 }}>
                        <CircularProgress size={28} sx={{ color: accentColor }} />
                    </Box>
                )}
                {error && (
                    <Alert severity="error" sx={{ flexShrink: 0 }}>{error}</Alert>
                )}
                {plan && !plan.ok && (
                    <Alert severity="warning" data-testid="fabrary-refuse" sx={{ flexShrink: 0 }}>
                        {FABRARY_REFUSE_COPY[plan.refuseReason] || 'This file cannot be imported'}
                    </Alert>
                )}
                {plan?.ok && (
                    <Box
                        data-testid="fabrary-preview"
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            minHeight: 0,
                            flex: '1 1 auto',
                        }}
                    >
                        {success && (
                            <Alert severity="success" data-testid="fabrary-success" sx={{ mb: 1, flexShrink: 0 }}>
                                {success}
                            </Alert>
                        )}
                        <Typography>Rows with quantities: {plan.ownedCount}</Typography>
                        <Typography>Collection: {copiesForDestination(plan.adds, FABRARY_DESTINATION.collection)}</Typography>
                        <Typography>Want List: {copiesForDestination(plan.adds, FABRARY_DESTINATION.want)}</Typography>
                        <Typography>Trade Binder: {copiesForDestination(plan.adds, FABRARY_DESTINATION.trade)}</Typography>
                        <Typography>Matched: {plan.matchedCount}</Typography>
                        <Typography>Won&apos;t be imported: {plan.unmatched.length}</Typography>
                        <Typography>Copies to add: {plan.copiesToAdd}</Typography>
                        <Typography sx={{ mt: 1, color: mutedColor }}>
                            Haves will be added to the Collection Binder
                        </Typography>
                        <Typography sx={{ mt: 1, color: mutedColor }}>
                            Wants will be added to the Want List
                        </Typography>
                        <Typography sx={{ mt: 1, color: mutedColor }}>
                            Trades will be added to the Trade Binder
                        </Typography>
                        {plan.unmatched.length > 0 && (
                            <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto' }}>
                                <Typography sx={{ fontWeight: 700, mb: 0.5, flexShrink: 0 }}>
                                    Cards we couldn&apos;t match
                                </Typography>
                                <Typography sx={{ color: mutedColor, mb: 1, flexShrink: 0 }}>
                                    {UNMATCHED_EXPLAIN}
                                </Typography>
                                <Box
                                    data-testid="fabrary-unmatched"
                                    sx={{
                                        overflowY: 'auto',
                                        maxHeight: { xs: 140, sm: 220 },
                                        pr: 0.5,
                                        border: `1px solid ${isDark ? 'rgba(212, 165, 116, 0.2)' : 'rgba(139, 69, 19, 0.15)'}`,
                                        borderRadius: 1,
                                        px: 1.25,
                                        py: 1,
                                    }}
                                >
                                    {plan.unmatched.map((row, index) => (
                                        <Typography key={`${row.name}-${index}`} sx={{ mb: 0.5 }}>
                                            {unmatchedLabel(row)}
                                        </Typography>
                                    ))}
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, flexShrink: 0, gap: 1 }}>
                <Button
                    data-testid="fabrary-cancel"
                    onClick={handleClose}
                    disabled={applying}
                >
                    Cancel
                </Button>
                {plan?.ok && (
                    <Button
                        variant="contained"
                        data-testid="fabrary-confirm"
                        onClick={handleConfirm}
                        disabled={applying}
                        aria-busy={applying}
                    >
                        {applying && (
                            <CircularProgress
                                size={16}
                                color="inherit"
                                data-testid="fabrary-confirm-spinner"
                                sx={{ mr: 1 }}
                            />
                        )}
                        Confirm
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default FabraryImportDialog;
