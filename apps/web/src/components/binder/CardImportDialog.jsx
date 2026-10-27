import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    ButtonBase,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useCardData } from '../../hooks/useCardData.jsx';
import { applyImportAddsToEntries, FABRARY_DESTINATION } from '../../utils/fabraryImportApply.js';
import { printingIdOf } from '../../utils/fabraryMatch.js';
import { planCsvImport, priceOf, resolveImportAdds } from '../../utils/csvImport.js';
import { formatCurrency } from '../../utils/helpers.js';
import { getBinderEntries, upsertEntries, TRADE_BINDER_ID } from '../../services/binder.js';

const REFUSE_COPY = {
    no_name: 'This file needs a Name column (or a Fabrary collection export).',
    no_rows: 'No cards with a quantity were found in this file.',
    no_matched: 'None of those cards were found in the catalog.',
};

const REVIEW_REASON_COPY = {
    price_spread: 'These printings are more than $5 apart. Pick the one you have.',
    unpriced: "We can't tell these printings apart by price. Pick the one you have.",
    similar_names: 'More than one card has a name like this. Pick the one you have.',
    name_code_mismatch: "The card code doesn't match the name. Pick the one you have.",
    set: "No printing is in that set. Pick the one you have.",
    pitch: "No printing has that pitch. Pick the one you have.",
    foiling: "No printing has that finish. Pick the one you have.",
    treatment: "No printing has that treatment. Pick the one you have.",
};

export const UNMATCHED_EXPLAIN =
    "These rows aren't in the FAB Trades catalog. Confirming still adds everything else; these will be skipped.";

async function readPickedFile(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function rowLabel(row) {
    return [row.name, row.set, row.foiling, row.treatment, row.edition]
        .filter(Boolean)
        .join(' · ');
}

function copies(rows) {
    return rows.reduce((sum, row) => sum + row.quantity, 0);
}

function CandidateOption({ card, selected, onSelect }) {
    const price = priceOf(card);
    return (
        <ButtonBase
            data-testid={`import-candidate-${printingIdOf(card)}`}
            aria-pressed={selected}
            onClick={onSelect}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                width: '100%',
                justifyContent: 'flex-start',
                textAlign: 'left',
                p: 1,
                borderRadius: '10px',
                border: 2,
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? 'action.selected' : 'transparent',
            }}
        >
            <Box
                component="img"
                src={card.imageUrl || card.imageUrlFallback || undefined}
                alt=""
                onError={(e) => {
                    if (card.imageUrlFallback && e.currentTarget.src !== card.imageUrlFallback) {
                        e.currentTarget.src = card.imageUrlFallback;
                    }
                }}
                sx={{ width: 44, height: 62, objectFit: 'cover', borderRadius: '4px', bgcolor: 'surface.sunken', flexShrink: 0 }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 650 }} noWrap>{card.name}</Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.8125rem' }} noWrap>
                    {[card._setName, card.extNumber, card.subTypeName].filter(Boolean).join(' · ')}
                </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {price != null ? formatCurrency(price.toFixed(2)) : '—'}
            </Typography>
        </ButtonBase>
    );
}

const CardImportDialog = ({ open, binder, onClose, onImported }) => {
    const { cards } = useCardData();
    const fileInputRef = useRef(null);
    const [working, setWorking] = useState(false);
    const [applying, setApplying] = useState(false);
    const [plan, setPlan] = useState(null);
    const [picks, setPicks] = useState({});
    const [reviewIndex, setReviewIndex] = useState(0);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const binderId = binder?.clientId;
    const binderName = binder?.name || 'this Binder';

    const catalogById = useMemo(() => {
        const map = new Map();
        for (const card of cards || []) {
            const id = printingIdOf(card);
            if (id) map.set(id, card);
        }
        return map;
    }, [cards]);

    useEffect(() => {
        if (open) return;
        setWorking(false);
        setApplying(false);
        setPlan(null);
        setPicks({});
        setReviewIndex(0);
        setSuccess('');
        setError('');
    }, [open]);

    const reviewRows = useMemo(() => plan?.review || [], [plan]);
    const reviewedCount = reviewRows.filter((row) => row.key in picks).length;
    const pickedRows = reviewRows.filter((row) => picks[row.key]);
    const unreviewedCount = reviewRows.length - reviewedCount;
    const copiesToAdd = plan ? copies(plan.matched) + copies(pickedRows) : 0;
    const current = reviewRows[reviewIndex];

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
        setPicks({});
        setReviewIndex(0);
        setSuccess('');
        setError('');
        try {
            const csv = await readPickedFile(file);
            // Let the spinner paint before matching a large file.
            await new Promise((resolve) => setTimeout(resolve, 0));
            setPlan(planCsvImport({ csv, catalog: cards || [] }));
        } catch {
            setPlan({ ok: false, refuseReason: 'no_name', matched: [], review: [], unmatched: [] });
        } finally {
            setWorking(false);
        }
    };

    const choose = (key, printingId) => {
        setPicks((prev) => ({ ...prev, [key]: printingId }));
        setReviewIndex((idx) => Math.min(idx + 1, reviewRows.length - 1));
    };

    const handleConfirm = async () => {
        if (!plan?.ok || applying || success || !binderId || copiesToAdd === 0) return;
        setApplying(true);
        setError('');
        const adds = resolveImportAdds(plan, picks).map((add) => ({
            ...add,
            destination: FABRARY_DESTINATION.collection,
        }));
        const entryRes = await getBinderEntries();
        const latest = entryRes.data?.all || [
            ...(entryRes.data?.binder || []),
            ...(entryRes.data?.wants || []),
        ];
        const combined = applyImportAddsToEntries(latest, adds, {
            collectionBinderId: binderId,
            tradeBinderId: TRADE_BINDER_ID,
        });
        const rows = adds.map((add) => {
            const entry = combined.find((row) =>
                (row.cardId || row.printingId) === add.printingId
                && !row.isWanted
                && (row.binderId || TRADE_BINDER_ID) === binderId
                && (row.condition || 'NM') === 'NM');
            return {
                cardId: add.printingId,
                quantity: entry?.quantity ?? add.quantity,
                binderId,
                isWanted: false,
                card: catalogById.get(add.printingId),
            };
        }).filter((row) => row.card);
        const { error: upsertError } = await upsertEntries(rows);
        if (upsertError) {
            setError(upsertError.message || 'Could not import');
            setApplying(false);
            return;
        }
        setSuccess(`Added ${copiesToAdd} Near Mint ${copiesToAdd === 1 ? 'copy' : 'copies'} to ${binderName}`);
        setApplying(false);
        await onImported?.();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            aria-labelledby="card-import-title"
            PaperProps={{ sx: { maxHeight: '90vh', display: 'flex', flexDirection: 'column' } }}
        >
            <DialogTitle id="card-import-title" sx={{ pr: 6, flexShrink: 0 }}>
                Import cards
                {binder?.name && (
                    <Typography component="span" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.875rem' }}>
                        into {binder.name}
                    </Typography>
                )}
                <IconButton
                    aria-label="close"
                    onClick={handleClose}
                    disabled={applying}
                    sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0 }}>
                <input
                    ref={fileInputRef}
                    data-testid="import-file"
                    type="file"
                    accept=".csv,text/csv,.txt"
                    hidden
                    onChange={onPickFile}
                />
                {!plan && !working && (
                    <Typography sx={{ color: 'text.secondary' }}>
                        Use a CSV with a <b>Name</b> column, plus optional <b>Set</b>, <b>Foiling</b> and{' '}
                        <b>Quantity</b>. Card codes in the name (like WTR167) make matching exact.
                        Fabrary collection exports work too.
                    </Typography>
                )}
                <Box sx={{ flexShrink: 0 }}>
                    <Button
                        variant={plan ? 'outlined' : 'contained'}
                        data-testid="import-choose"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={working || applying}
                    >
                        {plan ? 'Choose a different CSV' : 'Choose CSV'}
                    </Button>
                </Box>
                {working && (
                    <Box data-testid="import-working" sx={{ textAlign: 'center' }}>
                        <CircularProgress size={28} />
                    </Box>
                )}
                {error && <Alert severity="error">{error}</Alert>}
                {plan && !plan.ok && (
                    <Alert severity="warning" data-testid="import-refuse">
                        {REFUSE_COPY[plan.refuseReason] || 'This file cannot be imported'}
                    </Alert>
                )}
                {plan?.ok && (
                    <Box data-testid="import-preview" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {success && (
                            <Alert severity="success" data-testid="import-success" sx={{ mb: 1 }}>
                                {success}
                            </Alert>
                        )}
                        <Typography>Rows read: {plan.rowCount}</Typography>
                        <Typography>Matched automatically: {plan.matched.length}</Typography>
                        <Typography>Needs review: {reviewRows.length}</Typography>
                        <Typography>Couldn&apos;t match: {plan.unmatched.length}</Typography>
                        <Typography sx={{ fontWeight: 650 }}>Copies to add: {copiesToAdd}</Typography>
                        <Typography sx={{ mt: 0.5, color: 'text.secondary' }}>
                            Cards are added as Near Mint to {binderName}, on top of what&apos;s already there.
                        </Typography>
                    </Box>
                )}
                {plan?.ok && current && (
                    <Box data-testid="import-review" sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                            <Typography sx={{ fontWeight: 700 }}>Needs review</Typography>
                            <Typography data-testid="import-review-progress" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                {reviewedCount} of {reviewRows.length} reviewed
                            </Typography>
                        </Box>
                        <Box sx={{ bgcolor: 'surface.sunken', borderRadius: '10px', px: 1.25, py: 1 }}>
                            <Typography data-testid="import-review-row" sx={{ fontWeight: 650 }}>
                                {current.quantity} × {rowLabel(current.row)}
                            </Typography>
                            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                {REVIEW_REASON_COPY[current.reason] || 'Pick the printing you have.'}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, overflowY: 'auto', maxHeight: { xs: 260, sm: 320 }, pr: 0.5 }}>
                            {current.candidates.map((id) => {
                                const card = catalogById.get(id);
                                if (!card) return null;
                                return (
                                    <CandidateOption
                                        key={id}
                                        card={card}
                                        selected={picks[current.key] === id}
                                        onSelect={() => choose(current.key, id)}
                                    />
                                );
                            })}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Button
                                size="small"
                                data-testid="import-review-prev"
                                disabled={reviewIndex === 0}
                                onClick={() => setReviewIndex((idx) => Math.max(0, idx - 1))}
                            >
                                Previous
                            </Button>
                            <Button
                                size="small"
                                data-testid="import-review-skip"
                                color="inherit"
                                onClick={() => choose(current.key, null)}
                            >
                                {picks[current.key] === null ? 'Skipped' : 'Skip this card'}
                            </Button>
                            <Box sx={{ flex: 1 }} />
                            <Button
                                size="small"
                                data-testid="import-review-next"
                                disabled={reviewIndex >= reviewRows.length - 1}
                                onClick={() => setReviewIndex((idx) => Math.min(reviewRows.length - 1, idx + 1))}
                            >
                                Next
                            </Button>
                        </Box>
                    </Box>
                )}
                {plan?.ok && plan.unmatched.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Cards we couldn&apos;t match</Typography>
                        <Typography sx={{ color: 'text.secondary', mb: 1 }}>{UNMATCHED_EXPLAIN}</Typography>
                        <Box
                            data-testid="import-unmatched"
                            sx={{ overflowY: 'auto', maxHeight: { xs: 120, sm: 180 }, bgcolor: 'surface.sunken', borderRadius: '10px', px: 1.25, py: 1 }}
                        >
                            {plan.unmatched.map((row, index) => (
                                <Typography key={`${row.name}-${index}`} sx={{ mb: 0.5 }}>
                                    {rowLabel(row)}
                                </Typography>
                            ))}
                        </Box>
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, flexShrink: 0, gap: 1, flexWrap: 'wrap' }}>
                {plan?.ok && unreviewedCount > 0 && (
                    <Typography data-testid="import-unreviewed" sx={{ color: 'text.secondary', fontSize: '0.8125rem', mr: 'auto' }}>
                        {unreviewedCount} unreviewed {unreviewedCount === 1 ? 'row' : 'rows'} will be skipped
                    </Typography>
                )}
                <Button data-testid="import-cancel" onClick={handleClose} disabled={applying}>
                    {success ? 'Done' : 'Cancel'}
                </Button>
                {plan?.ok && (
                    <Button
                        variant="contained"
                        data-testid="import-confirm"
                        onClick={handleConfirm}
                        disabled={applying || copiesToAdd === 0 || Boolean(success)}
                        aria-busy={applying}
                    >
                        {applying && (
                            <CircularProgress size={16} color="inherit" data-testid="import-confirm-spinner" sx={{ mr: 1 }} />
                        )}
                        Add {copiesToAdd} {copiesToAdd === 1 ? 'copy' : 'copies'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default CardImportDialog;
