import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/elements/Header.jsx';
import SignInDialog from '../components/auth/SignInDialog.jsx';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext.jsx';
import { useCardData } from '../hooks/useCardData.jsx';
import { useDocumentHead } from '../utils/seo.js';
import { getOpenBinderId, targetOwnedBinderId } from '../utils/openBinder.js';
import { applyImportAddsToEntries, planFabraryImport } from '../utils/fabraryImportApply.js';
import {
    getBinderEntries,
    getBinders,
    upsertEntries,
    TRADE_BINDER_ID,
    COLLECTION_BINDER_ID,
} from '../services/binder.js';

export const FABRARY_REFUSE_COPY = {
    not_fabrary: 'This is not a Fabrary collection export',
    no_owned: 'No owned cards (Have) were found',
    no_matched: 'None of the owned cards were found in the catalog',
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

const BinderSettings = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const { isDark } = useThemeMode();
    const { cards, pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();
    const fileInputRef = useRef(null);
    const [signInOpen, setSignInOpen] = useState(false);
    const [binders, setBinders] = useState([]);
    const [entries, setEntries] = useState([]);
    const [working, setWorking] = useState(false);
    const [applying, setApplying] = useState(false);
    const [plan, setPlan] = useState(null);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const binderId = searchParams.get('b') || getOpenBinderId() || targetOwnedBinderId() || TRADE_BINDER_ID;

    useDocumentHead({
        title: 'Settings',
        description: 'Binder settings and Fabrary collection import.',
        canonicalPath: '/binder',
    });

    const bgGradient = isDark
        ? 'linear-gradient(135deg, #0d0806 0%, #1a0f0a 50%, #2c1810 100%)'
        : 'linear-gradient(135deg, #f5f1ed 0%, #e8dfd6 50%, #f0e6dc 100%)';
    const textColor = isDark ? '#f5f1ed' : '#2c1810';
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

    const binderName = useMemo(() => {
        const named = binders.find((b) => b.clientId === binderId && !b.deletedAt);
        if (named?.name) return named.name;
        if (binderId === TRADE_BINDER_ID) return 'Trade Binder';
        if (binderId === COLLECTION_BINDER_ID) return 'Collection';
        return 'Binder';
    }, [binders, binderId]);

    const load = useCallback(async () => {
        const [entryRes, binderRes] = await Promise.all([getBinderEntries(), getBinders()]);
        setEntries(entryRes.data?.binder || []);
        setBinders(binderRes.data?.binders || []);
    }, []);

    useEffect(() => {
        if (!user) return undefined;
        load();
        return undefined;
    }, [user, load]);

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
            const latest = entryRes.data?.binder || entries;
            if (entryRes.data?.binder) setEntries(entryRes.data.binder);
            const next = planFabraryImport({
                csv,
                catalog: cards || [],
                binderId,
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
        const entryRes = await getBinderEntries();
        const latest = entryRes.data?.binder || entries;
        if (entryRes.data?.binder) setEntries(entryRes.data.binder);
        const combined = applyImportAddsToEntries(latest, binderId, plan.adds);
        const rows = plan.adds.map((add) => {
            const entry = combined.find((row) =>
                !row.isWanted
                && (row.binderId || TRADE_BINDER_ID) === binderId
                && (row.condition || 'NM') === 'NM'
                && (row.cardId || row.printingId) === add.printingId,
            );
            return {
                cardId: add.printingId,
                quantity: entry?.quantity ?? add.quantity,
                binderId,
                card: catalogById.get(add.printingId),
            };
        }).filter((row) => row.card);
        const { error: upsertError } = await upsertEntries(rows);
        if (upsertError) {
            setError(upsertError.message || 'Could not import');
            setApplying(false);
            return;
        }
        await load();
        setSuccess(`Added ${plan.copiesToAdd} Near Mint copies`);
        setApplying(false);
    };

    const handleCancel = () => {
        setPlan(null);
        setSuccess('');
        setError('');
    };

    const goBack = () => {
        navigate(`/binder?b=${encodeURIComponent(binderId)}`);
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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h5" sx={{ color: accentColor, fontWeight: 700 }}>
                            Settings
                        </Typography>
                        <Button
                            data-testid="binder-settings-back"
                            startIcon={<ArrowBackIcon />}
                            onClick={goBack}
                            sx={{ color: accentColor, textTransform: 'none' }}
                        >
                            Back
                        </Button>
                    </Box>
                    <Typography sx={{ color: textColor, fontWeight: 600, mb: 2 }}>
                        {binderName}
                    </Typography>
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
                        Import from Fabrary
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
                            <Typography>Owned cards: {plan.ownedCount}</Typography>
                            <Typography>Matched: {plan.matchedCount}</Typography>
                            <Typography>Unmatched: {plan.unmatched.length}</Typography>
                            <Typography>Copies to add: {plan.copiesToAdd}</Typography>
                            <Typography sx={{ mt: 1.5, color: mutedColor }}>
                                Confirming adds Near Mint copies to this Binder. Existing cards stay. A second import of the same file will add again.
                            </Typography>
                            {plan.unmatched.length > 0 && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography sx={{ fontWeight: 700, mb: 1 }}>Unmatched owned cards</Typography>
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
