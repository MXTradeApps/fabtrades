import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    IconButton,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import {
    Add as AddIcon,
    ArrowBack as ArrowBackIcon,
    ContentCopy as ContentCopyIcon,
    Delete as DeleteIcon,
    Remove as RemoveIcon,
    Share as ShareIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEntitlement } from '../contexts/EntitlementContext.jsx';
import { useThemeMode } from '../contexts/ThemeContext.jsx';
import { useCardData } from '../hooks/useCardData.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import Header from '../components/elements/Header.jsx';
import { SearchInput } from '../components/search/index.js';
import SignInDialog from '../components/auth/SignInDialog.jsx';
import {
    ensureBinderShare,
    getBinderEntries,
    regenerateBinderShare,
    removeEntry,
    setBinderShareEnabled,
    upsertEntry,
} from '../services/binder.js';
import { canAddDistinctCard, cardsFor } from '../utils/freeLimits.js';
import { formatCurrency } from '../utils/helpers.js';

const FAB_CDN_BASE = 'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large';

/** Matches mobile `CardSort` labels / ordering. */
const SORT_OPTIONS = [
    { id: 'nameAsc', label: 'Name (A–Z)' },
    { id: 'priceDesc', label: 'Price (high → low)' },
    { id: 'priceAsc', label: 'Price (low → high)' },
    { id: 'numberAsc', label: 'Collector #' },
];

function compareBinderEntries(a, b, sort, resolveCard) {
    const ca = resolveCard(a);
    const cb = resolveCard(b);
    switch (sort) {
        case 'priceDesc': {
            const pa = ca.market || 0;
            const pb = cb.market || 0;
            return pb - pa || ca.name.localeCompare(cb.name);
        }
        case 'priceAsc': {
            const pa = ca.market || 0;
            const pb = cb.market || 0;
            return pa - pb || ca.name.localeCompare(cb.name);
        }
        case 'numberAsc': {
            const an = ca.collectorNumber || '';
            const bn = cb.collectorNumber || '';
            if (!an && !bn) return ca.name.localeCompare(cb.name);
            if (!an) return 1;
            if (!bn) return -1;
            return an.localeCompare(bn, undefined, { numeric: true }) ||
                ca.name.localeCompare(cb.name);
        }
        case 'nameAsc':
        default:
            return ca.name.localeCompare(cb.name);
    }
}

/** Same CDN pattern as useCardData — rebuild when the stub URL is stale/empty. */
function fabCdnUrl(collectorNumber, finish) {
    if (!collectorNumber) return '';
    const code = String(collectorNumber).split(/\s*\/\/\s*|\s*\/\s*/)[0].trim();
    if (!code) return '';
    const sub = (finish || '').toLowerCase();
    let suffix = '';
    if (sub.includes('cold foil')) suffix = '-CF';
    else if (sub.includes('rainbow foil')) suffix = '-RF';
    return `${FAB_CDN_BASE}/${code}${suffix}.webp`;
}

/**
 * Card art with CDN → catalog/TCG fallback. Binder stubs often lack a working
 * image_url; catalog merge can miss if ids diverge — always try the CDN code.
 */
function BinderCardArt({ imageUrl, fallbackUrl, alt, onClick, qty, mutedColor }) {
    const [src, setSrc] = useState(imageUrl || fallbackUrl || '');
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setSrc(imageUrl || fallbackUrl || '');
        setFailed(false);
    }, [imageUrl, fallbackUrl]);

    const handleError = () => {
        if (fallbackUrl && src !== fallbackUrl) {
            setSrc(fallbackUrl);
            return;
        }
        setFailed(true);
    };

    return (
        <Box
            component="button"
            type="button"
            onClick={onClick}
            aria-label={`Preview ${alt || 'card'}`}
            sx={{
                position: 'relative',
                width: '100%',
                height: 112,
                p: 0,
                border: 0,
                cursor: 'pointer',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                overflow: 'hidden',
            }}
        >
            {!failed && src ? (
                <Box
                    component="img"
                    src={src}
                    alt={alt || ''}
                    loading="lazy"
                    onError={handleError}
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'top',
                        display: 'block',
                    }}
                />
            ) : (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        px: 0.5,
                    }}
                >
                    <Typography
                        sx={{ color: mutedColor, fontSize: '0.65rem', textAlign: 'center' }}
                    >
                        {alt || 'No image'}
                    </Typography>
                </Box>
            )}
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    px: 0.6,
                    py: 0.15,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    color: '#fff',
                    backgroundColor: 'rgba(0, 0, 0, 0.78)',
                    borderBottomRightRadius: 5,
                }}
            >
                {qty}x
            </Box>
        </Box>
    );
}

/**
 * Shared Binder / Want List page. Parameterized by `isWanted` the same way
 * mobile uses a single BinderEntry model for both lists.
 */
const BinderCollection = ({ isWanted = false }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isPro, loading: entitlementLoading } = useEntitlement();
    const { isDark } = useThemeMode();
    const { openDetail } = useCardDetail();
    const { cards, cardGroups, pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sort, setSort] = useState('nameAsc');
    const [signInOpen, setSignInOpen] = useState(false);
    const [busyCardId, setBusyCardId] = useState(null);
    const [limitMessage, setLimitMessage] = useState('');
    const [toast, setToast] = useState('');
    const [shareOpen, setShareOpen] = useState(false);
    const [share, setShare] = useState(null);
    const [shareBusy, setShareBusy] = useState(false);

    const listLabel = isWanted ? 'Want List' : 'Binder';
    const limit = cardsFor({ isWanted });

    const bgGradient = isDark
        ? 'linear-gradient(135deg, #0d0806 0%, #1a0f0a 50%, #2c1810 100%)'
        : 'linear-gradient(135deg, #f5f1ed 0%, #e8dfd6 50%, #f0e6dc 100%)';
    const textColor = isDark ? '#f5f1ed' : '#2c1810';
    const mutedColor = isDark ? '#d4a574' : '#5d3a1a';
    const accentColor = isDark ? '#e4c09c' : '#8b4513';
    const paperBg = isDark ? 'rgba(44, 24, 16, 0.6)' : '#ffffff';
    const paperBorder = isDark ? 'rgba(212, 165, 116, 0.2)' : 'rgba(139, 69, 19, 0.15)';

    const loadEntries = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await getBinderEntries();
        if (fetchError) {
            setError(fetchError.message || `Failed to load ${listLabel.toLowerCase()}`);
            setEntries([]);
        } else {
            setEntries(isWanted ? data.wants : data.binder);
        }
        setLoading(false);
    }, [isWanted, listLabel]);

    useEffect(() => {
        if (user) loadEntries();
    }, [user, loadEntries]);

    const catalogById = useMemo(() => {
        const map = new Map();
        for (const card of cards) {
            if (card._uniqueId) map.set(card._uniqueId, card);
        }
        return map;
    }, [cards]);

    /** cardId → sibling printings (Normal / Rainbow Foil / …) from catalog groups. */
    const editionsByCardId = useMemo(() => {
        const map = new Map();
        for (const group of cardGroups || []) {
            const editions = group.editions || [];
            for (const edition of editions) {
                if (edition.uniqueId) map.set(edition.uniqueId, editions);
            }
        }
        return map;
    }, [cardGroups]);

    const cardOptions = useMemo(
        () =>
            cards.map((card) => ({
                label: card.displayName,
                value: card._uniqueDisplayId,
                subTypeName: card.subTypeName,
                setName: card._setName || '',
                card,
            })),
        [cards],
    );

    /** Merge a binder stub with live catalog row for fresher prices / type lines. */
    const resolveCard = useCallback(
        (entry) => {
            const stub = entry.card || {};
            const live = catalogById.get(entry.cardId);
            const finish =
                live?.subTypeName ||
                stub.subTypeName ||
                (stub.isFoil ? 'Foil' : 'Normal');
            const collectorNumber = live?.extNumber || stub.collectorNumber || '';
            const cdn = fabCdnUrl(collectorNumber, finish);
            const tcgFallback = live?.imageUrlFallback || stub.imageUrl || '';

            return {
                name: live?.name || stub.name || 'Unknown card',
                // Prefer CDN (rebuilt from set code); fall back to TCG / stub.
                imageUrl: cdn || live?.imageUrl || stub.imageUrl || '',
                imageUrlFallback: tcgFallback && tcgFallback !== cdn ? tcgFallback : '',
                collectorNumber,
                rarity: live?.extRarity || stub.rarity || '',
                finish,
                setName: live?._setName || stub.setName || '',
                typeLine: [
                    live?.extCardType || stub.cardType,
                    live?.extCardSubType || live?.extClass || stub.cardClass,
                ]
                    .filter(Boolean)
                    .join(' — '),
                market: Number(live?.marketPrice) || Number(stub.tcgMarket) || 0,
                low:
                    Number(live?.lowPrice) ||
                    (stub.tcgLow != null ? Number(stub.tcgLow) : null) ||
                    null,
                mid: Number(live?.midPrice) || null,
                high: Number(live?.highPrice) || null,
            };
        },
        [catalogById],
    );

    const openEntryDetail = (entry) => {
        const live = catalogById.get(entry.cardId);
        if (live?._uniqueId) openDetail(live);
    };

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const list = q
            ? entries.filter((entry) => {
                const card = resolveCard(entry);
                return (
                    card.name.toLowerCase().includes(q) ||
                    card.setName.toLowerCase().includes(q) ||
                    card.finish.toLowerCase().includes(q) ||
                    card.collectorNumber.toLowerCase().includes(q) ||
                    card.typeLine.toLowerCase().includes(q)
                );
            })
            : [...entries];
        list.sort((a, b) => compareBinderEntries(a, b, sort, resolveCard));
        return list;
    }, [entries, searchQuery, sort, resolveCard]);

    const totalValue = useMemo(
        () =>
            entries.reduce((sum, entry) => {
                const price = resolveCard(entry).market;
                return sum + price * (entry.quantity || 1);
            }, 0),
        [entries, resolveCard],
    );

    const atFreeLimit =
        !entitlementLoading &&
        !isPro &&
        !canAddDistinctCard(entries.length, { isWanted, isPro: false });

    const handleAddCard = async (option) => {
        const catalogCard = option?.card;
        if (!catalogCard?._uniqueId) return;

        const cardId = catalogCard._uniqueId;
        const existing = entries.find((e) => e.cardId === cardId);

        if (!existing && !canAddDistinctCard(entries.length, { isWanted, isPro })) {
            setLimitMessage(
                `${isWanted ? 'Want lists' : 'Binders'} hold ${limit} cards on the free plan. Subscribe in the FABTrades app to add more.`,
            );
            return;
        }

        setBusyCardId(cardId);
        const nextQty = existing ? existing.quantity + 1 : 1;
        const { data, error: upsertError } = await upsertEntry({
            cardId,
            isWanted,
            quantity: nextQty,
            condition: existing?.condition || 'NM',
            card: catalogCard,
            addedAt: existing?.addedAt,
        });
        setBusyCardId(null);

        if (upsertError) {
            setToast(upsertError.message || 'Failed to add card');
            return;
        }

        setEntries((prev) => {
            const without = prev.filter((e) => e.cardId !== cardId);
            return [data, ...without];
        });
        setToast(`Added ${catalogCard.name} to ${listLabel}`);
    };

    const updateQuantity = async (entry, quantity) => {
        setBusyCardId(entry.cardId);
        if (quantity <= 0) {
            const { error: delError } = await removeEntry(entry.cardId, isWanted);
            setBusyCardId(null);
            if (delError) {
                setToast(delError.message || 'Failed to remove card');
                return;
            }
            setEntries((prev) => prev.filter((e) => e.cardId !== entry.cardId));
            return;
        }

        const { data, error: upsertError } = await upsertEntry({
            cardId: entry.cardId,
            isWanted,
            quantity,
            condition: entry.condition,
            card: entry.stub || entry.card,
            addedAt: entry.addedAt,
        });
        setBusyCardId(null);

        if (upsertError) {
            setToast(upsertError.message || 'Failed to update quantity');
            return;
        }
        setEntries((prev) => prev.map((e) => (e.cardId === entry.cardId ? data : e)));
    };

    /**
     * Swap printing (e.g. Normal → Rainbow Foil). Keeps qty/condition; merges
     * into an existing row for the target printing when one is already present.
     */
    const changeVersion = async (entry, newCardId) => {
        if (!newCardId || newCardId === entry.cardId) return;
        const newCard = catalogById.get(newCardId);
        if (!newCard) {
            setToast('That printing is not in the catalog');
            return;
        }

        const mergeTarget = entries.find((e) => e.cardId === newCardId);
        const qty = entry.quantity || 1;
        const condition = entry.condition || 'NM';

        setBusyCardId(entry.cardId);

        const { data: upserted, error: upsertError } = await upsertEntry({
            cardId: newCardId,
            isWanted,
            quantity: mergeTarget ? mergeTarget.quantity + qty : qty,
            condition: mergeTarget?.condition || condition,
            card: newCard,
            addedAt: mergeTarget?.addedAt || entry.addedAt,
        });

        if (upsertError) {
            setBusyCardId(null);
            setToast(upsertError.message || 'Failed to change version');
            return;
        }

        const { error: delError } = await removeEntry(entry.cardId, isWanted);
        setBusyCardId(null);

        if (delError) {
            setToast(delError.message || 'Version updated, but the old printing lingered');
            await loadEntries();
            return;
        }

        setEntries((prev) => {
            const withoutOld = prev.filter((e) => e.cardId !== entry.cardId);
            const withoutTarget = withoutOld.filter((e) => e.cardId !== newCardId);
            return [upserted, ...withoutTarget];
        });
        setToast(`Changed to ${newCard.subTypeName || 'new version'}`);
    };

    const handleRemove = async (entry) => {
        if (!entry) return;
        setBusyCardId(entry.cardId);
        const { error: delError } = await removeEntry(entry.cardId, isWanted);
        setBusyCardId(null);
        if (delError) {
            setToast(delError.message || 'Failed to remove card');
            return;
        }
        setEntries((prev) => prev.filter((e) => e.cardId !== entry.cardId));
    };

    const openShareDialog = async () => {
        setShareOpen(true);
        setShareBusy(true);
        const { data, error: shareError } = await ensureBinderShare();
        setShareBusy(false);
        if (shareError) {
            setToast(shareError.message || 'Could not create share link');
            setShareOpen(false);
            return;
        }
        setShare(data);
    };

    const copyShareLink = async () => {
        if (!share?.url) return;
        try {
            await navigator.clipboard.writeText(share.url);
            setToast('Link copied');
        } catch {
            setToast('Could not copy link');
        }
    };

    const toggleShareEnabled = async (enabled) => {
        setShareBusy(true);
        const { data, error: shareError } = await setBinderShareEnabled(enabled);
        setShareBusy(false);
        if (shareError) {
            setToast(shareError.message || 'Could not update sharing');
            return;
        }
        setShare(data);
        setToast(enabled ? 'Sharing enabled' : 'Sharing turned off');
    };

    const handleRegenerateShare = async () => {
        setShareBusy(true);
        const { data, error: shareError } = await regenerateBinderShare();
        setShareBusy(false);
        if (shareError) {
            setToast(shareError.message || 'Could not regenerate link');
            return;
        }
        setShare(data);
        setToast('New link created — old link no longer works');
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
                            Sign in to sync your {listLabel.toLowerCase()} across devices.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button variant="contained" onClick={() => setSignInOpen(true)}>
                                Sign in
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<ArrowBackIcon />}
                                onClick={() => navigate('/')}
                                sx={{
                                    color: accentColor,
                                    borderColor: paperBorder,
                                    '&:hover': {
                                        borderColor: accentColor,
                                        backgroundColor: isDark
                                            ? 'rgba(200, 113, 55, 0.12)'
                                            : 'rgba(139, 69, 19, 0.06)',
                                    },
                                }}
                            >
                                Back to Trading
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

            <Container maxWidth="xl" sx={{ flexGrow: 1, py: { xs: 1.5, sm: 2 } }}>
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 1, sm: 1.5 },
                        borderRadius: 1.5,
                        backgroundColor: paperBg,
                        border: `1px solid ${paperBorder}`,
                        minHeight: '60vh',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 1.25,
                            pb: 1,
                            borderBottom: `1px solid ${paperBorder}`,
                            gap: 1,
                            flexWrap: 'wrap',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                            <Typography
                                sx={{
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    color: accentColor,
                                    lineHeight: 1.2,
                                }}
                            >
                                {listLabel}
                            </Typography>
                            {isPro && (
                                <Chip
                                    size="small"
                                    label="PRO"
                                    sx={{
                                        height: 20,
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        letterSpacing: 0.5,
                                        color: isDark ? '#1a0f0a' : '#ffffff',
                                        backgroundColor: accentColor,
                                        '& .MuiChip-label': { px: 0.75 },
                                    }}
                                />
                            )}
                            <Chip
                                size="small"
                                label={`${entries.length}`}
                                sx={{
                                    height: 20,
                                    fontSize: '0.7rem',
                                    color: mutedColor,
                                    borderColor: paperBorder,
                                    '& .MuiChip-label': { px: 0.75 },
                                }}
                                variant="outlined"
                            />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography
                                sx={{ color: mutedColor, fontWeight: 600, fontSize: '0.8rem' }}
                            >
                                {formatCurrency(totalValue.toFixed(2))}
                            </Typography>
                            {!isWanted && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<ShareIcon sx={{ fontSize: '1rem !important' }} />}
                                    onClick={openShareDialog}
                                    sx={{
                                        color: accentColor,
                                        borderColor: paperBorder,
                                        fontSize: '0.75rem',
                                        minHeight: 28,
                                        px: 0.75,
                                        '&:hover': {
                                            borderColor: accentColor,
                                            backgroundColor: isDark
                                                ? 'rgba(200, 113, 55, 0.12)'
                                                : 'rgba(139, 69, 19, 0.06)',
                                        },
                                    }}
                                >
                                    Share
                                </Button>
                            )}
                            <Button
                                variant="text"
                                size="small"
                                startIcon={<ArrowBackIcon sx={{ fontSize: '1rem !important' }} />}
                                onClick={() => navigate('/')}
                                sx={{
                                    color: accentColor,
                                    fontSize: '0.75rem',
                                    minHeight: 28,
                                    px: 0.75,
                                }}
                            >
                                Back
                            </Button>
                        </Box>
                    </Box>

                    {!entitlementLoading && !isPro && entries.length / limit >= 0.7 && (
                        <Alert severity="info" icon={false} sx={{ mb: 1, py: 0.25, fontSize: '0.8rem' }}>
                            Free plan — {listLabel.toLowerCase()} holds {limit} cards
                            ({entries.length}/{limit}). Subscribe in the FABTrades app for unlimited.
                        </Alert>
                    )}

                    {atFreeLimit && (
                        <Alert severity="warning" sx={{ mb: 1, py: 0.25, fontSize: '0.8rem' }}>
                            {isWanted ? 'Want lists' : 'Binders'} hold {limit} cards on the free plan.
                            You can still change quantity on cards you already have. Subscribe in the
                            FABTrades app to add more.
                        </Alert>
                    )}

                    <Box
                        sx={{
                            mb: 1.25,
                            position: 'relative',
                            zIndex: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        }}
                    >
                        <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 0 } }}>
                            <SearchInput
                                label=""
                                size="small"
                                placeholder={
                                    atFreeLimit
                                        ? 'Search your binder…'
                                        : 'Search to add cards…'
                                }
                                items={cardOptions}
                                value={searchQuery}
                                onChange={(_e, value) => setSearchQuery(value || '')}
                                onSelect={handleAddCard}
                                keepOpenOnSelect
                                keepInputOnSelect
                            />
                        </Box>
                        <FormControl
                            size="small"
                            sx={{
                                minWidth: { xs: '100%', sm: 150 },
                                flexShrink: 0,
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: isDark
                                        ? 'rgba(26, 15, 10, 0.6)'
                                        : 'rgba(255, 255, 255, 0.7)',
                                    color: textColor,
                                    fontSize: '0.8125rem',
                                    minHeight: 36,
                                    '& fieldset': { borderColor: paperBorder },
                                    '&:hover fieldset': { borderColor: accentColor },
                                    '& .MuiSelect-select': { py: 0.75 },
                                },
                            }}
                        >
                            <Select
                                value={sort}
                                displayEmpty
                                onChange={(e) => setSort(e.target.value)}
                                aria-label="Sort binder"
                                renderValue={(value) => {
                                    const opt = SORT_OPTIONS.find((o) => o.id === value);
                                    return opt?.label || 'Sort';
                                }}
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <MenuItem key={option.id} value={option.id} dense>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    {loading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress sx={{ color: accentColor }} />
                        </Box>
                    )}

                    {error && !loading && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {!loading && !error && filtered.length === 0 && (
                        <Box sx={{ textAlign: 'center', py: 6 }}>
                            <Typography variant="h6" sx={{ color: textColor, mb: 1 }}>
                                {searchQuery.trim()
                                    ? 'No matching cards in this list'
                                    : `${listLabel} is empty`}
                            </Typography>
                            <Typography variant="body2" sx={{ color: mutedColor }}>
                                {searchQuery.trim()
                                    ? 'Pick a result above to add it, or clear the search.'
                                    : `Type in the search box above to add cards.`}
                            </Typography>
                        </Box>
                    )}

                    {!loading && filtered.length > 0 && (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                gap: 1,
                            }}
                        >
                            {filtered.map((entry) => {
                                const card = resolveCard(entry);
                                const qty = entry.quantity || 1;
                                const busy = busyCardId === entry.cardId;
                                const editions = editionsByCardId.get(entry.cardId) || [];
                                const canChangeVersion = editions.length >= 2;
                                const idLine = [card.collectorNumber, card.rarity]
                                    .filter(Boolean)
                                    .join(' · ');
                                const priceRows = [
                                    ['Market', card.market],
                                    ['Low', card.low],
                                    ['Mid', card.mid],
                                    ['High', card.high],
                                ].filter(([, v]) => v != null && Number.isFinite(v) && v > 0);

                                return (
                                    <Box
                                        key={entry.cardId}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            borderRadius: 1.5,
                                            overflow: 'hidden',
                                            backgroundColor: isDark
                                                ? 'rgba(26, 15, 10, 0.55)'
                                                : 'rgba(255, 255, 255, 0.92)',
                                            border: `1px solid ${paperBorder}`,
                                            fontSize: '0.75rem',
                                        }}
                                    >
                                        <BinderCardArt
                                            imageUrl={card.imageUrl}
                                            fallbackUrl={card.imageUrlFallback}
                                            alt={card.name}
                                            qty={qty}
                                            mutedColor={mutedColor}
                                            onClick={() => openEntryDetail(entry)}
                                        />

                                        <Box
                                            sx={{
                                                px: 0.85,
                                                py: 0.65,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 0.3,
                                                flexGrow: 1,
                                            }}
                                        >
                                            <Typography
                                                component={catalogById.get(entry.cardId) ? 'button' : 'span'}
                                                type={catalogById.get(entry.cardId) ? 'button' : undefined}
                                                onClick={
                                                    catalogById.get(entry.cardId)
                                                        ? () => openEntryDetail(entry)
                                                        : undefined
                                                }
                                                aria-label={
                                                    catalogById.get(entry.cardId)
                                                        ? `View details for ${card.name}`
                                                        : undefined
                                                }
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    color: textColor,
                                                    lineHeight: 1.2,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    border: 0,
                                                    background: 'none',
                                                    p: 0,
                                                    m: 0,
                                                    textAlign: 'left',
                                                    fontFamily: 'inherit',
                                                    cursor: catalogById.get(entry.cardId) ? 'pointer' : 'default',
                                                }}
                                            >
                                                {card.name}
                                            </Typography>

                                            <Typography
                                                sx={{
                                                    color: mutedColor,
                                                    fontSize: '0.68rem',
                                                    lineHeight: 1.2,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {idLine || card.setName || '—'}
                                            </Typography>

                                            {card.typeLine && (
                                                <Typography
                                                    sx={{
                                                        color: mutedColor,
                                                        fontSize: '0.65rem',
                                                        lineHeight: 1.2,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                >
                                                    {card.typeLine}
                                                </Typography>
                                            )}

                                            <Box
                                                component="dl"
                                                sx={{
                                                    m: 0,
                                                    mt: 0.35,
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr auto',
                                                    columnGap: 1,
                                                    rowGap: 0.15,
                                                    '& dt, & dd': {
                                                        m: 0,
                                                        fontSize: '0.68rem',
                                                        lineHeight: 1.25,
                                                    },
                                                    '& dt': { color: mutedColor },
                                                    '& dd': {
                                                        color: accentColor,
                                                        fontWeight: 600,
                                                        textAlign: 'right',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    },
                                                }}
                                            >
                                                {priceRows.map(([label, value]) => (
                                                    <Box
                                                        key={label}
                                                        sx={{ display: 'contents' }}
                                                    >
                                                        <Box component="dt">{label}</Box>
                                                        <Box component="dd">
                                                            {formatCurrency(value.toFixed(2))}
                                                        </Box>
                                                    </Box>
                                                ))}
                                                {priceRows.length === 0 && (
                                                    <>
                                                        <Box component="dt">Market</Box>
                                                        <Box component="dd">—</Box>
                                                    </>
                                                )}
                                            </Box>

                                            {canChangeVersion ? (
                                                <FormControl
                                                    size="small"
                                                    fullWidth
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    <Select
                                                        value={entry.cardId}
                                                        disabled={busy}
                                                        onChange={(e) =>
                                                            changeVersion(entry, e.target.value)
                                                        }
                                                        aria-label={`Version of ${card.name}`}
                                                        sx={{
                                                            color: mutedColor,
                                                            fontSize: '0.65rem',
                                                            fontWeight: 600,
                                                            backgroundColor: isDark
                                                                ? 'rgba(212, 165, 116, 0.12)'
                                                                : 'rgba(139, 69, 19, 0.08)',
                                                            height: 26,
                                                            '& .MuiSelect-select': {
                                                                py: 0.35,
                                                                px: 0.75,
                                                                textAlign: 'center',
                                                            },
                                                            '& .MuiOutlinedInput-notchedOutline': {
                                                                borderColor: 'transparent',
                                                            },
                                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                                                borderColor: paperBorder,
                                                            },
                                                        }}
                                                    >
                                                        {editions.map((edition) => (
                                                            <MenuItem
                                                                key={edition.uniqueId}
                                                                value={edition.uniqueId}
                                                                dense
                                                                sx={{ fontSize: '0.75rem' }}
                                                            >
                                                                {edition.subTypeName || 'Normal'}
                                                                {edition.cardPrice
                                                                    ? ` · ${formatCurrency(Number(edition.cardPrice).toFixed(2))}`
                                                                    : ''}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            ) : (
                                                <Box
                                                    sx={{
                                                        mt: 0.5,
                                                        px: 0.75,
                                                        py: 0.35,
                                                        borderRadius: 1,
                                                        backgroundColor: isDark
                                                            ? 'rgba(212, 165, 116, 0.12)'
                                                            : 'rgba(139, 69, 19, 0.08)',
                                                        color: mutedColor,
                                                        fontSize: '0.65rem',
                                                        fontWeight: 600,
                                                        textAlign: 'center',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                >
                                                    {card.finish}
                                                </Box>
                                            )}

                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.25,
                                                    mt: 'auto',
                                                    pt: 0.5,
                                                    borderTop: `1px solid ${paperBorder}`,
                                                }}
                                            >
                                                <IconButton
                                                    size="small"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        updateQuantity(entry, qty - 1)
                                                    }
                                                    aria-label="decrease quantity"
                                                    sx={{ p: 0.35 }}
                                                >
                                                    <RemoveIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                                <Typography
                                                    sx={{
                                                        minWidth: 18,
                                                        textAlign: 'center',
                                                        fontWeight: 700,
                                                        fontSize: '0.8rem',
                                                        color: textColor,
                                                    }}
                                                >
                                                    {qty}
                                                </Typography>
                                                <IconButton
                                                    size="small"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        updateQuantity(entry, qty + 1)
                                                    }
                                                    aria-label="increase quantity"
                                                    sx={{ p: 0.35 }}
                                                >
                                                    <AddIcon sx={{ fontSize: 16 }} />
                                                </IconButton>

                                                <IconButton
                                                    size="small"
                                                    disabled={busy}
                                                    onClick={() => handleRemove(entry)}
                                                    aria-label="remove card"
                                                    sx={{ color: 'error.main', p: 0.35, ml: 'auto' }}
                                                >
                                                    {busy ? (
                                                        <CircularProgress size={14} />
                                                    ) : (
                                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                                    )}
                                                </IconButton>
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                </Paper>
            </Container>

            <Dialog
                open={shareOpen}
                onClose={() => !shareBusy && setShareOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Share binder</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: mutedColor, fontSize: '0.875rem', mb: 2 }}>
                        Anyone with this link can view your binder (not your want list). Turn sharing
                        off or regenerate the link anytime.
                    </Typography>
                    {shareBusy && !share ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <CircularProgress size={28} sx={{ color: accentColor }} />
                        </Box>
                    ) : (
                        <>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={Boolean(share?.isEnabled)}
                                        onChange={(e) => toggleShareEnabled(e.target.checked)}
                                        disabled={shareBusy || !share}
                                    />
                                }
                                label={share?.isEnabled ? 'Sharing on' : 'Sharing off'}
                                sx={{ mb: 1.5, color: textColor }}
                            />
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <TextField
                                    value={share?.url || ''}
                                    fullWidth
                                    size="small"
                                    InputProps={{ readOnly: true }}
                                    disabled={!share?.isEnabled}
                                />
                                <Button
                                    variant="contained"
                                    startIcon={<ContentCopyIcon />}
                                    onClick={copyShareLink}
                                    disabled={shareBusy || !share?.isEnabled || !share?.url}
                                    sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                                >
                                    Copy
                                </Button>
                            </Box>
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
                    <Button
                        onClick={handleRegenerateShare}
                        disabled={shareBusy || !share}
                        color="inherit"
                    >
                        New link
                    </Button>
                    <Button onClick={() => setShareOpen(false)} disabled={shareBusy}>
                        Done
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={Boolean(limitMessage)}
                autoHideDuration={6000}
                onClose={() => setLimitMessage('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setLimitMessage('')}
                    severity="info"
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {limitMessage}
                </Alert>
            </Snackbar>

            <Snackbar
                open={Boolean(toast)}
                autoHideDuration={3000}
                onClose={() => setToast('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setToast('')}
                    severity="success"
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {toast}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default BinderCollection;
