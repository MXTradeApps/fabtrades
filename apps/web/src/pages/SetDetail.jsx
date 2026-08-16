import { useState, useMemo } from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    Button,
    List,
    ListItem,
    Chip,
    CircularProgress,
    Alert,
    TextField,
    InputAdornment,
    ToggleButtonGroup,
    ToggleButton,
    useMediaQuery,
    useTheme
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Search as SearchIcon,
    CalendarToday as CalendarIcon,
    Style as StyleIcon
} from '@mui/icons-material';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/elements/Header.jsx';
import { CardThumbnail } from '../components/ui/CardImagePreview.jsx';
import TcgplayerBuyLink from '../components/ui/TcgplayerBuyLink.jsx';
import { useSets } from '../hooks/useSets.js';
import { useCardData } from '../hooks/useCardData.jsx';
import { useThemeMode } from '../contexts/ThemeContext.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import { formatCardType, getCardGradient } from '../utils/searchUtils.js';
import { useDocumentHead } from '../utils/seo.js';

/**
 * Flesh and Blood frequently encodes alternate printings into the card name
 * itself (e.g. "Oldhim (Extended Art)"). We split them out so the base name
 * can display cleanly while the art variant shows up as a separate chip.
 *
 * Note: pitch-color suffixes like `(Red)`, `(Blue)`, `(Yellow)` are NOT art
 * variants - they identify distinct cards with different pitch values - so
 * they are intentionally left attached to the displayed name.
 */
const ART_VARIANT_KEYWORDS = [
    'Extended Art',
    'Alternate Art',
    'Alt Art',
    'Full Art',
    'Marvel',
    'Fabled',
    'Promo',
    'Cold Foil',
    'Gold Foil',
    'Rainbow Foil',
    'Nexus Night',
    'Treasure',
    'Reverse',
    'Holo',
    'JPN Exclusive',
    'CC Tag'
];

const parseCardVariant = (name = '') => {
    const match = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (!match) return { baseName: name, artVariant: null };
    const inner = match[2].trim();
    const lower = inner.toLowerCase();
    const isArtVariant = ART_VARIANT_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
    if (!isArtVariant) return { baseName: name, artVariant: null };
    return { baseName: match[1].trim(), artVariant: inner };
};

/**
 * Color coding for foiling types so the user can tell printings apart at a
 * glance. Matches the palette used elsewhere in the app.
 */
const getFoilChipStyle = (subTypeName, isDark) => {
    const sub = (subTypeName || '').toLowerCase();
    if (sub.includes('rainbow foil')) {
        return isDark
            ? { background: 'linear-gradient(90deg, #4a2a3a, #4a3a20, #204a3a, #204a50, #3a204a)', color: '#fff' }
            : { background: 'linear-gradient(90deg, #ffd0d0, #ffe8c0, #d0ffd0, #c0e8ff, #e0c0ff)', color: '#2c1810' };
    }
    if (sub.includes('cold foil')) {
        return isDark
            ? { background: 'linear-gradient(135deg, #1a3a55, #2a5070)', color: '#e4f0ff' }
            : { background: 'linear-gradient(135deg, #cce6ff, #99ccff)', color: '#0a2a4a' };
    }
    if (sub.includes('gold foil')) {
        return isDark
            ? { background: 'linear-gradient(135deg, #5a4510, #8a6a20)', color: '#fff4cc' }
            : { background: 'linear-gradient(135deg, #ffe699, #ffcc33)', color: '#3a2a00' };
    }
    if (sub.includes('foil') || sub.includes('holo')) {
        return isDark
            ? { background: 'linear-gradient(135deg, #3a2820, #4a3028)', color: '#e4c09c' }
            : { background: 'linear-gradient(135deg, #f0e0d0, #e0c8b0)', color: '#5d2f0d' };
    }
    return null;
};

const formatDate = (iso) => {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatMoney = (value) => {
    const num = Number(value);
    if (!isFinite(num) || num <= 0) return '—';
    return `$${num.toFixed(2)}`;
};

const SORT_OPTIONS = [
    { value: 'market-desc', label: 'Market ↓' },
    { value: 'market-asc', label: 'Market ↑' },
    { value: 'low-desc', label: 'Low ↓' },
    { value: 'high-desc', label: 'High ↓' },
    { value: 'name', label: 'Name' }
];

const getSortedCards = (cards, sortMode) => {
    const arr = [...cards];
    switch (sortMode) {
        case 'market-asc':
            return arr.sort((a, b) => (a.marketPrice || 0) - (b.marketPrice || 0));
        case 'low-desc':
            return arr.sort((a, b) => (b.lowPrice || 0) - (a.lowPrice || 0));
        case 'high-desc':
            return arr.sort((a, b) => (b.highPrice || 0) - (a.highPrice || 0));
        case 'name':
            return arr.sort((a, b) => {
                const an = a._baseName || a.name || '';
                const bn = b._baseName || b.name || '';
                const nameCmp = an.localeCompare(bn);
                if (nameCmp !== 0) return nameCmp;
                // Within the same base name, fall back to market desc so the
                // most valuable printing appears first.
                return (b.marketPrice || 0) - (a.marketPrice || 0);
            });
        case 'market-desc':
        default:
            return arr.sort((a, b) => (b.marketPrice || 0) - (a.marketPrice || 0));
    }
};

const annotateCards = (cards) =>
    cards.map((card) => {
        const { baseName, artVariant } = parseCardVariant(card.name || '');
        return { ...card, _baseName: baseName, _artVariant: artVariant };
    });

const PriceCell = ({ label, value, isDark, accent = false }) => (
    <Box sx={{ textAlign: 'center', minWidth: 64 }}>
        <Typography
            variant="caption"
            sx={{
                display: 'block',
                color: isDark ? 'rgba(212, 165, 116, 0.7)' : 'rgba(93, 58, 26, 0.7)',
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600
            }}
        >
            {label}
        </Typography>
        <Typography
            variant="body2"
            sx={{
                color: accent
                    ? (isDark ? '#e4c09c' : '#8b4513')
                    : (isDark ? '#f5f1ed' : '#2c1810'),
                fontWeight: accent ? 700 : 500,
                fontSize: accent ? '0.95rem' : '0.85rem'
            }}
        >
            {formatMoney(value)}
        </Typography>
    </Box>
);

const SetDetail = () => {
    const { groupId } = useParams();
    const { getSetById, loading, error } = useSets();
    const { pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();
    const { isDark } = useThemeMode();
    const { openDetail } = useCardDetail();
    const theme = useTheme();
    const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

    const [query, setQuery] = useState('');
    const [sortMode, setSortMode] = useState('market-desc');

    const set = useMemo(() => getSetById(groupId), [getSetById, groupId]);

    // Keep the document head in sync for SPA navigation & social scrapers.
    const seoTitle = set
        ? `${set.name}${set.abbreviation ? ` (${set.abbreviation})` : ''} Card Price Guide`
        : 'Card Price Guide';
    const topName = set?.cards?.length
        ? [...set.cards].sort((a, b) => (b.marketPrice || 0) - (a.marketPrice || 0))[0]?.name
        : null;
    const seoDescription = set
        ? `Up-to-date TCGplayer market, low, and high prices for all ${set.cards.length} ` +
          `Flesh and Blood cards in ${set.name}${topName ? `, including ${topName}` : ''}. ` +
          `Sort by value and balance trades with FAB Trades.`
        : undefined;
    useDocumentHead({
        title: seoTitle,
        description: seoDescription,
        canonicalPath: set?.slug ? `/sets/${set.slug}` : undefined
    });

    const annotated = useMemo(() => (set ? annotateCards(set.cards) : []), [set]);

    const visibleCards = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = q
            ? annotated.filter((c) => {
                const name = (c.name || '').toLowerCase();
                const num = (c.extNumber || '').toLowerCase();
                const rarity = (c.extRarity || '').toLowerCase();
                const sub = (c.subTypeName || '').toLowerCase();
                const variant = (c._artVariant || '').toLowerCase();
                return (
                    name.includes(q) ||
                    num.includes(q) ||
                    rarity.includes(q) ||
                    sub.includes(q) ||
                    variant.includes(q)
                );
            })
            : annotated;
        return getSortedCards(filtered, sortMode);
    }, [annotated, query, sortMode]);

    const variantCount = useMemo(() => {
        let count = 0;
        for (const c of annotated) {
            const sub = (c.subTypeName || '').toLowerCase();
            if (c._artVariant) count++;
            else if (sub && sub !== 'normal') count++;
        }
        return count;
    }, [annotated]);

    const bgGradient = isDark
        ? 'linear-gradient(135deg, #0d0806 0%, #1a0f0a 50%, #2c1810 100%)'
        : 'linear-gradient(135deg, #f5f1ed 0%, #e8dfd6 50%, #f0e6dc 100%)';

    const textColor = isDark ? '#f5f1ed' : '#2c1810';
    const mutedColor = isDark ? '#d4a574' : '#5d3a1a';

    const openCard = (card) => {
        if (card?._uniqueId) openDetail(card);
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            background: bgGradient,
            backgroundAttachment: 'fixed'
        }}>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />

            <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
                <Button
                    component={Link}
                    to="/sets"
                    startIcon={<ArrowBackIcon />}
                    sx={{
                        mb: 2,
                        color: isDark ? '#e4c09c' : '#8b4513',
                        background: 'transparent',
                        '&:hover': {
                            background: isDark ? 'rgba(200, 113, 55, 0.15)' : 'rgba(139, 69, 19, 0.08)'
                        }
                    }}
                >
                    All sets
                </Button>

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress sx={{ color: isDark ? '#d4a574' : '#8b4513' }} />
                    </Box>
                )}

                {!loading && error && (
                    <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                )}

                {!loading && !error && !set && (
                    <Alert severity="warning">Set not found.</Alert>
                )}

                {!loading && set && (
                    <>
                        <Box sx={{ mb: 2 }}>
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 700,
                                    color: textColor,
                                    fontSize: { xs: '1.5rem', md: '2rem' }
                                }}
                            >
                                {set.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
                                {set.abbreviation && (
                                    <Chip
                                        size="small"
                                        label={set.abbreviation}
                                        sx={{
                                            height: 22,
                                            fontSize: '0.75rem',
                                            backgroundColor: isDark ? 'rgba(200, 113, 55, 0.25)' : 'rgba(139, 69, 19, 0.1)',
                                            color: isDark ? '#e4c09c' : '#8b4513'
                                        }}
                                    />
                                )}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <CalendarIcon sx={{ fontSize: 14, color: mutedColor }} />
                                    <Typography variant="caption" sx={{ color: mutedColor }}>
                                        {formatDate(set.publishedOn)}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <StyleIcon sx={{ fontSize: 14, color: mutedColor }} />
                                    <Typography variant="caption" sx={{ color: mutedColor }}>
                                        {set.cards.length} printings
                                        {variantCount > 0 ? ` · ${variantCount} variants` : ''}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: 1.5,
                            mb: 2,
                            alignItems: { xs: 'stretch', sm: 'center' }
                        }}>
                            <TextField
                                placeholder="Filter cards..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                size="small"
                                sx={{
                                    flexGrow: 1,
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: isDark ? 'rgba(44, 24, 16, 0.6)' : '#ffffff',
                                        '& fieldset': {
                                            borderColor: isDark ? 'rgba(212, 165, 116, 0.3)' : 'rgba(139, 69, 19, 0.3)'
                                        }
                                    },
                                    '& input': { color: textColor }
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: mutedColor, fontSize: 18 }} />
                                        </InputAdornment>
                                    )
                                }}
                            />
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={sortMode}
                                onChange={(_, v) => v && setSortMode(v)}
                                sx={{
                                    flexWrap: 'wrap',
                                    '& .MuiToggleButton-root': {
                                        textTransform: 'none',
                                        color: mutedColor,
                                        borderColor: isDark ? 'rgba(212, 165, 116, 0.3)' : 'rgba(139, 69, 19, 0.25)',
                                        '&.Mui-selected': {
                                            backgroundColor: isDark ? 'rgba(200, 113, 55, 0.25)' : 'rgba(139, 69, 19, 0.12)',
                                            color: isDark ? '#e4c09c' : '#8b4513',
                                            fontWeight: 700
                                        }
                                    }
                                }}
                            >
                                {SORT_OPTIONS.map((opt) => (
                                    <ToggleButton key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Box>

                        <Paper
                            elevation={0}
                            sx={{
                                backgroundColor: isDark ? 'rgba(44, 24, 16, 0.6)' : '#ffffff',
                                border: `1px solid ${isDark ? 'rgba(212, 165, 116, 0.2)' : 'rgba(139, 69, 19, 0.15)'}`,
                                borderRadius: 2,
                                overflow: 'hidden'
                            }}
                        >
                            <List disablePadding>
                                {visibleCards.length === 0 && (
                                    <ListItem>
                                        <Typography variant="body2" sx={{ color: mutedColor, py: 2 }}>
                                            No cards match your filter.
                                        </Typography>
                                    </ListItem>
                                )}
                                {visibleCards.map((card, idx) => {
                                    const rawFoilLabel = formatCardType(card.subTypeName);
                                    // Avoid duplicating the same descriptor as both the art-variant chip
                                    // (parsed from the card name) and the foil chip (from subTypeName).
                                    const foilLabel = rawFoilLabel && card._artVariant
                                        && rawFoilLabel.toLowerCase() === card._artVariant.toLowerCase()
                                        ? null
                                        : rawFoilLabel;
                                    const foilStyle = getFoilChipStyle(card.subTypeName, isDark);
                                    const hasSpecialPrinting = !!card._artVariant || !!foilLabel;
                                    const rowGradient = hasSpecialPrinting
                                        ? getCardGradient(card.subTypeName, isDark).background
                                        : 'transparent';

                                    return (
                                        <ListItem
                                            key={card._uniqueId || card.productId || idx}
                                            sx={{
                                                px: { xs: 1.25, sm: 2 },
                                                py: 1.25,
                                                gap: 1.5,
                                                position: 'relative',
                                                background: rowGradient,
                                                borderBottom: idx === visibleCards.length - 1
                                                    ? 'none'
                                                    : `1px solid ${isDark ? 'rgba(212, 165, 116, 0.12)' : 'rgba(139, 69, 19, 0.08)'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                '&::before': hasSpecialPrinting ? {
                                                    content: '""',
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: 3,
                                                    background: isDark ? '#d4a574' : '#8b4513'
                                                } : undefined
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: mutedColor,
                                                    fontVariantNumeric: 'tabular-nums',
                                                    width: 28,
                                                    textAlign: 'right',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {idx + 1}
                                            </Typography>

                                            <CardThumbnail
                                                imageUrl={card.imageUrl}
                                                fallbackUrl={card.imageUrlFallback}
                                                alt={card.name}
                                                size={isSmall ? 34 : 42}
                                                onClick={() => openCard(card)}
                                            />

                                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                <Typography
                                                    component={card._uniqueId ? 'button' : 'span'}
                                                    type={card._uniqueId ? 'button' : undefined}
                                                    onClick={card._uniqueId ? () => openCard(card) : undefined}
                                                    aria-label={card._uniqueId ? `View details for ${card.name}` : undefined}
                                                    variant="body2"
                                                    sx={{
                                                        color: textColor,
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        border: 0,
                                                        background: 'none',
                                                        p: 0,
                                                        m: 0,
                                                        textAlign: 'left',
                                                        fontFamily: 'inherit',
                                                        cursor: card._uniqueId ? 'pointer' : 'default',
                                                    }}
                                                >
                                                    {card._baseName || card.name}
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.35, alignItems: 'center' }}>
                                                    {card.extNumber && (
                                                        <Typography variant="caption" sx={{ color: mutedColor, fontSize: '0.7rem' }}>
                                                            {card.extNumber}
                                                        </Typography>
                                                    )}
                                                    {card.extRarity && (
                                                        <Typography variant="caption" sx={{ color: mutedColor, fontSize: '0.7rem' }}>
                                                            · {card.extRarity}
                                                        </Typography>
                                                    )}
                                                    {card._artVariant && (
                                                        <Chip
                                                            size="small"
                                                            label={card._artVariant}
                                                            sx={{
                                                                height: 18,
                                                                fontSize: '0.65rem',
                                                                fontWeight: 600,
                                                                backgroundColor: isDark ? 'rgba(228, 192, 156, 0.2)' : 'rgba(139, 69, 19, 0.12)',
                                                                color: isDark ? '#e4c09c' : '#5d2f0d',
                                                                border: `1px solid ${isDark ? 'rgba(212, 165, 116, 0.4)' : 'rgba(139, 69, 19, 0.3)'}`,
                                                                '& .MuiChip-label': { px: 0.75 }
                                                            }}
                                                        />
                                                    )}
                                                    {foilLabel && (
                                                        <Chip
                                                            size="small"
                                                            label={foilLabel}
                                                            sx={{
                                                                height: 18,
                                                                fontSize: '0.65rem',
                                                                fontWeight: 700,
                                                                border: `1px solid ${isDark ? 'rgba(212, 165, 116, 0.35)' : 'rgba(139, 69, 19, 0.25)'}`,
                                                                '& .MuiChip-label': { px: 0.75 },
                                                                ...(foilStyle || {
                                                                    backgroundColor: isDark ? 'rgba(212, 165, 116, 0.15)' : 'rgba(139, 69, 19, 0.08)',
                                                                    color: isDark ? '#e4c09c' : '#5d2f0d'
                                                                })
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            </Box>

                                            <TcgplayerBuyLink
                                                productId={card.productId}
                                                subTypeName={card.subTypeName}
                                            />

                                            <Box sx={{
                                                display: 'flex',
                                                gap: { xs: 0.75, sm: 2 },
                                                alignItems: 'center',
                                                flexShrink: 0
                                            }}>
                                                <PriceCell label="Market" value={card.marketPrice} isDark={isDark} accent />
                                                <PriceCell label="Low" value={card.lowPrice} isDark={isDark} />
                                                <PriceCell label="High" value={card.highPrice} isDark={isDark} />
                                            </Box>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Paper>
                    </>
                )}
            </Container>
        </Box>
    );
};

export default SetDetail;
