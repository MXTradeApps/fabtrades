import { useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    Paper,
    Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Header from '../components/elements/Header.jsx';
import SignInDialog from '../components/auth/SignInDialog.jsx';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext.jsx';
import { useCardData } from '../hooks/useCardData.jsx';
import { useDocumentHead } from '../utils/seo.js';
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

const BinderSettings = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isDark } = useThemeMode();
    const { cards, pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();
    const fileInputRef = useRef(null);
    const [signInOpen, setSignInOpen] = useState(false);
    const [working, setWorking] = useState(false);
    const [applying, setApplying] = useState(false);
    const [plan, setPlan] = useState(null);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    useDocumentHead({
        title: 'Import from Fabrary',
        description: 'Import a Fabrary collection CSV into Collection, Want List, and Trade Binder.',
        canonicalPath: '/binder/import',
    });

    const bgGradient = isDark
        ? 'linear-gradient(135deg, #0d0806 0%, #1a0f0a 50%, #2c1810 100%)'
        : 'linear-gradient(135deg, #f5f1ed 0%, #e8dfd6 50%, #f0e6dc 100%)';
    const mutedColor = isDark ? '#d4a574' : '#5d3a1a';
    const accentColor = isDark ? '#e4c09c' : '#8b4513';
    const paperBg = isDark ? 'rgba(44, 24, 16, 0.6)' : '#ffffff';
    const paperBorder = isDark ? 'rgba(212, 165, 116, 0.2)' : 'rgba(139, 69, 19, 0.15)';

    const catalogById = useMemo(() => {
        const map = new Map();
        for (const card of cards || []) {
            if (card._uniqueId) map.set(card._uniqueId, card);
        }
        return map;
    }, [cards]);

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
    };

    const handleCancel = () => {
        setPlan(null);
        setSuccess('');
        setError('');
    };

    const goBack = () => {
        navigate('/binder');
    };

    if (!user) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100vh',
                    background: bgGradient,
                    backgroundAttachment: 'fixed',
                }}
            >
                <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
                <Container maxWidth="sm" sx={{ mt: 8 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            backgroundColor: paperBg,
                            border: `1px solid ${paperBorder}`,
                            borderRadius: 3,
                        }}
                    >
                        <Typography variant="h5" sx={{ mb: 2, color: accentColor, fontWeight: 700 }}>
                            Sign In Required
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 3, color: mutedColor }}>
                            Sign in to sync your binder across devices.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button variant="contained" onClick={() => setSignInOpen(true)}>
                                Sign in
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<ArrowBackIcon />}
                                onClick={() => navigate('/')}
                            >
                                Back
                            </Button>
                        </Box>
                    </Paper>
                </Container>
                <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                background: bgGradient,
                backgroundAttachment: 'fixed',
            }}
        >
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
            <Container maxWidth="md" sx={{ flexGrow: 1, py: { xs: 1.5, sm: 2 } }}>
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 2, sm: 3 },
                        borderRadius: 1.5,
                        backgroundColor: paperBg,
                        border: `1px solid ${paperBorder}`,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, minWidth: 0 }}>
                        <Button
                            data-testid="binder-settings-back"
                            startIcon={<ArrowBackIcon />}
                            onClick={goBack}
                            sx={{ color: accentColor, textTransform: 'none', flexShrink: 0 }}
                        >
                            Back
                        </Button>
                        <Typography variant="h5" sx={{ color: accentColor, fontWeight: 700 }}>
                            Import from Fabrary
                        </Typography>
                    </Box>
                    <input
                        ref={fileInputRef}
                        data-testid="fabrary-file"
                        type="file"
                        accept=".csv,text/csv,.txt"
                        hidden
                        onChange={onPickFile}
                    />
                    <Button
                        variant="contained"
                        data-testid="import-fabrary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={working || applying}
                    >
                        Choose CSV
                    </Button>
                    {working && (
                        <Box data-testid="fabrary-working" sx={{ mt: 3, textAlign: 'center' }}>
                            <CircularProgress size={28} sx={{ color: accentColor }} />
                        </Box>
                    )}
                    {error && (
                        <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
                    )}
                    {plan && !plan.ok && (
                        <Box sx={{ mt: 2 }}>
                            <Alert severity="warning" data-testid="fabrary-refuse">
                                {FABRARY_REFUSE_COPY[plan.refuseReason] || 'This file cannot be imported'}
                            </Alert>
                        </Box>
                    )}
                    {plan?.ok && (
                        <Box data-testid="fabrary-preview" sx={{ mt: 3 }}>
                            {success && (
                                <Alert severity="success" data-testid="fabrary-success" sx={{ mb: 2 }}>
                                    {success}
                                </Alert>
                            )}
                            <Typography>Rows with quantities: {plan.ownedCount}</Typography>
                            <Typography>Collection: {copiesForDestination(plan.adds, FABRARY_DESTINATION.collection)}</Typography>
                            <Typography>Want List: {copiesForDestination(plan.adds, FABRARY_DESTINATION.want)}</Typography>
                            <Typography>Trade Binder: {copiesForDestination(plan.adds, FABRARY_DESTINATION.trade)}</Typography>
                            <Typography>Matched: {plan.matchedCount}</Typography>
                            <Typography>Unmatched: {plan.unmatched.length}</Typography>
                            <Typography>Copies to add: {plan.copiesToAdd}</Typography>
                            <Typography sx={{ mt: 1.5, color: mutedColor }}>
                                Confirming adds Have copies to Collection, Want in trade / Want to buy to Want List, and Extra for trade / Extra to sell to Trade Binder. Existing cards stay. A second import of the same file will add again.
                            </Typography>
                            {plan.unmatched.length > 0 && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography sx={{ fontWeight: 700, mb: 1 }}>Unmatched cards</Typography>
                                    {plan.unmatched.map((row, index) => (
                                        <Typography key={`${row.name}-${index}`} sx={{ mb: 0.5 }}>
                                            {[row.name, row.setNumber, row.foiling, row.treatment, row.edition]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </Typography>
                                    ))}
                                </Box>
                            )}
                            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                                <Button
                                    variant="contained"
                                    data-testid="fabrary-confirm"
                                    onClick={handleConfirm}
                                    disabled={applying}
                                >
                                    Confirm
                                </Button>
                                <Button
                                    data-testid="fabrary-cancel"
                                    onClick={handleCancel}
                                    disabled={applying}
                                >
                                    Cancel
                                </Button>
                            </Box>
                        </Box>
                    )}
                </Paper>
            </Container>
        </Box>
    );
};

export default BinderSettings;
