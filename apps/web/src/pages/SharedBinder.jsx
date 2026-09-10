import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Container,
    FormControl,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Typography,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useThemeMode } from '../contexts/ThemeContext.jsx';
import { useCardData } from '../hooks/useCardData.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import Header from '../components/elements/Header.jsx';
import { getPublicBinder } from '../services/binder.js';
import { formatCurrency } from '../utils/helpers.js';
import { addCardToTradeDraft } from '../utils/tradeDraft.js';
import BinderEntryList from '../components/binder/BinderEntryList.jsx';

const FAB_CDN_BASE = 'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large';

const SORT_OPTIONS = [
    { id: 'priceDesc', label: 'Price (high → low)' },
    { id: 'priceAsc', label: 'Price (low → high)' },
    { id: 'nameAsc', label: 'Name (A–Z)' },
    { id: 'numberAsc', label: 'Collector #' },
];

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

function compareEntries(a, b, sort, resolveCard) {
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

/**
 * Read-only public binder view at `/b/:token`.
 */
const SharedBinder = () => {
    const { token } = useParams();
    const { isDark } = useThemeMode();
    const { openDetail } = useCardDetail();
    const { cards, pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sort, setSort] = useState('priceDesc');
    const [toast, setToast] = useState('');

    const bgGradient = isDark
        ? 'linear-gradient(135deg, #0d0806 0%, #1a0f0a 50%, #2c1810 100%)'
        : 'linear-gradient(135deg, #f5f1ed 0%, #e8dfd6 50%, #f0e6dc 100%)';
    const textColor = isDark ? '#f5f1ed' : '#2c1810';
    const mutedColor = isDark ? '#d4a574' : '#5d3a1a';
    const accentColor = isDark ? '#e4c09c' : '#8b4513';
    const paperBg = isDark ? 'rgba(44, 24, 16, 0.6)' : '#ffffff';
    const paperBorder = isDark ? 'rgba(212, 165, 116, 0.2)' : 'rgba(139, 69, 19, 0.15)';

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            const { data, error: fetchError } = await getPublicBinder(token);
            if (cancelled) return;
            if (fetchError) {
                setError(fetchError.message || 'This binder link is unavailable');
                setEntries([]);
            } else {
                setEntries(data.entries || []);
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const catalogById = useMemo(() => {
        const map = new Map();
        for (const card of cards) {
            if (card._uniqueId) map.set(card._uniqueId, card);
        }
        return map;
    }, [cards]);

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
            };
        },
        [catalogById],
    );

    const openEntryDetail = (entry) => {
        const live = catalogById.get(entry.cardId);
        if (live?._uniqueId) openDetail(live);
    };

    const sorted = useMemo(() => {
        const list = [...entries];
        list.sort((a, b) => compareEntries(a, b, sort, resolveCard));
        return list;
    }, [entries, sort, resolveCard]);

    const totalValue = useMemo(
        () =>
            entries.reduce((sum, entry) => {
                const price = resolveCard(entry).market;
                return sum + price * (entry.quantity || 1);
            }, 0),
        [entries, resolveCard],
    );

    const handleAddToTrade = (entry) => {
        const live = catalogById.get(entry.cardId);
        const stub = entry.card || {};
        const name = live?.displayName || live?.name || stub.name || 'Card';
        const subTypeName =
            live?.subTypeName ||
            stub.subTypeName ||
            (stub.isFoil ? 'Foil' : 'Normal');
        const price =
            Number(live?.marketPrice) ||
            Number(stub.tcgMarket) ||
            0;

        addCardToTradeDraft('want', {
            uniqueId: entry.cardId || live?._uniqueId || null,
            name,
            subTypeName,
            quantity: 1,
            price,
        });

        const shortName = live?.name || stub.name || 'Card';
        setToast(`Added ${shortName} to trade calculator`);
    };

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
                                Shared Binder
                            </Typography>
                            {!loading && !error && (
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
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            {!loading && !error && (
                                <Typography
                                    sx={{ color: mutedColor, fontWeight: 600, fontSize: '0.8rem' }}
                                >
                                    {formatCurrency(totalValue.toFixed(2))}
                                </Typography>
                            )}
                        </Box>
                    </Box>

                    {loading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress size={36} sx={{ color: accentColor }} />
                        </Box>
                    )}

                            {!loading && error && (
                        <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                            <Typography sx={{ color: accentColor, fontWeight: 700, mb: 1 }}>
                                Binder unavailable
                            </Typography>
                            <Typography sx={{ color: mutedColor, mb: 2, fontSize: '0.9rem' }}>
                                {error}
                            </Typography>
                        </Box>
                    )}

                    {!loading && !error && (
                        <>
                            <Box
                                sx={{
                                    mb: 1.25,
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                }}
                            >
                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <Select
                                        value={sort}
                                        onChange={(e) => setSort(e.target.value)}
                                        sx={{ fontSize: '0.8rem', color: textColor }}
                                    >
                                        {SORT_OPTIONS.map((opt) => (
                                            <MenuItem key={opt.id} value={opt.id}>
                                                {opt.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>

                            {sorted.length === 0 ? (
                                <Typography
                                    sx={{
                                        color: mutedColor,
                                        textAlign: 'center',
                                        py: 6,
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    This binder is empty.
                                </Typography>
                            ) : (
                                <BinderEntryList
                                    entries={sorted}
                                    resolveCard={resolveCard}
                                    resetKey={`${token}|${sort}`}
                                    catalogById={catalogById}
                                    variant="shared"
                                    onOpenDetail={openEntryDetail}
                                    onAddToTrade={handleAddToTrade}
                                    mutedColor={mutedColor}
                                    accentColor={accentColor}
                                    textColor={textColor}
                                    paperBorder={paperBorder}
                                    isDark={isDark}
                                />
                            )}
                        </>
                    )}
                </Paper>
            </Container>

            <Snackbar
                open={Boolean(toast)}
                autoHideDuration={2500}
                onClose={() => setToast('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{ bottom: { xs: 40, sm: 40 } }}
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

export default SharedBinder;
