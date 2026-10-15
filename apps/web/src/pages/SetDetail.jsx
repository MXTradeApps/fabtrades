import { useState, useMemo } from 'react';
import {
    Box,
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
import { Page, Panel } from '../components/layout/Page.jsx';
import { SearchClearAdornment } from '../components/search/index.js';
import { CardThumbnail } from '../components/ui/CardImagePreview.jsx';
import TcgplayerBuyLink from '../components/ui/TcgplayerBuyLink.jsx';
import FoilTag from '../components/ui/FoilTag.jsx';
import { useSets } from '../hooks/useSets.js';
import { useCardData } from '../hooks/useCardData.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import { formatCardType } from '../utils/searchUtils.js';
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

const PRICE_COLUMNS = [
    { key: 'marketPrice', label: 'Market' },
    { key: 'lowPrice', label: 'Low' },
    { key: 'highPrice', label: 'High' },
];

// Rank · art · name/meta · buy link · Market · Low · High. Phones fold Low and
// High under Market so the row keeps one line of name.
const ROW_GRID = {
    display: 'grid',
    gridTemplateColumns: {
        xs: '22px auto minmax(0, 1fr) auto',
        sm: '28px auto minmax(0, 1fr) auto 84px 72px 72px',
    },
    alignItems: 'center',
    columnGap: { xs: 1.25, sm: 1.75 },
};

const SetDetail = () => {
    const { groupId } = useParams();
    const { getSetById, loading, error } = useSets();
    const { pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();
    const { openDetail } = useCardDetail();
    const theme = useTheme();
    const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

    const [query, setQuery] = useState('');
    const [sortMode, setSortMode] = useState('market-desc');
    const [logoFailed, setLogoFailed] = useState(false);

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

    const topCard = useMemo(
        () => annotated.reduce((best, c) => ((c.marketPrice || 0) > (best?.marketPrice || 0) ? c : best), null),
        [annotated],
    );

    const openCard = (card) => {
        if (card?._uniqueId) openDetail(card);
    };

    const showLogo = Boolean(set?.logoUrl) && !logoFailed;

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />

            <Page maxWidth={1080}>
                <Button
                    component={Link}
                    to="/sets"
                    size="small"
                    color="inherit"
                    startIcon={<ArrowBackIcon sx={{ fontSize: '1rem !important' }} />}
                    sx={{ mb: 2, ml: -1, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                >
                    All sets
                </Button>

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
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
                        <Box
                            sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: { xs: 2, sm: 3 },
                                mb: 3,
                            }}
                        >
                            {showLogo && (
                                <Box
                                    sx={{
                                        width: { xs: 120, sm: 168 },
                                        height: { xs: 72, sm: 96 },
                                        borderRadius: '14px',
                                        bgcolor: 'surface.sunken',
                                        border: 1,
                                        borderColor: 'divider',
                                        display: 'grid',
                                        placeItems: 'center',
                                        p: 1.5,
                                        flexShrink: 0,
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src={set.logoUrl}
                                        alt=""
                                        onError={() => setLogoFailed(true)}
                                        sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    />
                                </Box>
                            )}
                            <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
                                <Typography
                                    variant="h1"
                                    sx={{ fontSize: { xs: '1.6rem', md: '2.25rem' }, color: 'text.primary', textWrap: 'balance' }}
                                >
                                    {set.name}
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        columnGap: 1.5,
                                        rowGap: 0.5,
                                        mt: 1,
                                        flexWrap: 'wrap',
                                        color: 'text.secondary',
                                        fontSize: '0.8125rem',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {set.abbreviation && (
                                        <Chip size="small" color="primary" label={set.abbreviation} sx={{ height: 22, fontSize: '0.72rem' }} />
                                    )}
                                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                        <CalendarIcon sx={{ fontSize: 14 }} />
                                        {formatDate(set.publishedOn)}
                                    </Box>
                                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                        <StyleIcon sx={{ fontSize: 14 }} />
                                        {set.cards.length} printings
                                        {variantCount > 0 ? ` · ${variantCount} variants` : ''}
                                    </Box>
                                    {topCard?.marketPrice > 0 && (
                                        <Box component="span">
                                            Top card{' '}
                                            <Box component="span" sx={{ color: 'text.primary', fontWeight: 650 }}>
                                                {formatMoney(topCard.marketPrice)}
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: 1.5,
                            mb: 2,
                            alignItems: { xs: 'stretch', md: 'center' }
                        }}>
                            <TextField
                                placeholder="Filter by name, number, rarity or foiling…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                size="small"
                                inputProps={{ 'aria-label': 'Filter cards' }}
                                sx={{ flexGrow: 1 }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <SearchClearAdornment
                                            value={query}
                                            onClear={() => setQuery('')}
                                            dense
                                        />
                                    ),
                                }}
                            />
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={sortMode}
                                onChange={(_, v) => v && setSortMode(v)}
                                aria-label="Sort cards"
                                sx={{ flexWrap: 'wrap', alignSelf: { xs: 'flex-start', md: 'auto' } }}
                            >
                                {SORT_OPTIONS.map((opt) => (
                                    <ToggleButton key={opt.value} value={opt.value} sx={{ px: 1.5, py: 0.5 }}>
                                        {opt.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Box>

                        <Panel sx={{ overflow: 'hidden' }}>
                            <Box
                                aria-hidden
                                sx={{
                                    ...ROW_GRID,
                                    display: { xs: 'none', sm: 'grid' },
                                    px: 2,
                                    py: 1,
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    bgcolor: 'surface.sunken',
                                    color: 'text.secondary',
                                    fontSize: '0.6875rem',
                                    fontWeight: 650,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                }}
                            >
                                <Box sx={{ textAlign: 'right' }}>#</Box>
                                <Box sx={{ gridColumn: 'span 3' }}>Card</Box>
                                {PRICE_COLUMNS.map((col) => (
                                    <Box key={col.key} sx={{ textAlign: 'right' }}>{col.label}</Box>
                                ))}
                            </Box>
                            <List disablePadding>
                                {visibleCards.length === 0 && (
                                    <ListItem>
                                        <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
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
                                    const tagSx = {
                                        height: 18,
                                        fontSize: '0.65rem',
                                        fontWeight: 650,
                                        borderRadius: '6px',
                                        '& .MuiChip-label': { px: 0.75 },
                                    };

                                    return (
                                        <ListItem
                                            key={card._uniqueId || card.productId || idx}
                                            sx={{
                                                ...ROW_GRID,
                                                px: { xs: 1.5, sm: 2 },
                                                py: 1,
                                                borderBottom: idx === visibleCards.length - 1 ? 0 : 1,
                                                borderColor: 'divider',
                                                transition: 'background-color 120ms ease',
                                                '&:hover': { bgcolor: 'action.hover' },
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'text.disabled',
                                                    fontVariantNumeric: 'tabular-nums',
                                                    textAlign: 'right',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {idx + 1}
                                            </Typography>

                                            <CardThumbnail
                                                imageUrl={card.imageUrl}
                                                fallbackUrl={card.imageUrlFallback}
                                                alt={card.name}
                                                size={isSmall ? 34 : 40}
                                                onClick={() => openCard(card)}
                                            />

                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography
                                                    component={card._uniqueId ? 'button' : 'span'}
                                                    type={card._uniqueId ? 'button' : undefined}
                                                    onClick={card._uniqueId ? () => openCard(card) : undefined}
                                                    aria-label={card._uniqueId ? `View details for ${card.name}` : undefined}
                                                    variant="body2"
                                                    sx={{
                                                        display: 'block',
                                                        maxWidth: '100%',
                                                        color: 'text.primary',
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
                                                        '&:hover': card._uniqueId ? { color: 'primary.main' } : undefined,
                                                    }}
                                                >
                                                    {card._baseName || card.name}
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.4, alignItems: 'center' }}>
                                                    {(card.extNumber || card.extRarity) && (
                                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', mr: 0.25 }}>
                                                            {[card.extNumber, card.extRarity].filter(Boolean).join(' · ')}
                                                        </Typography>
                                                    )}
                                                    {card._artVariant && (
                                                        <Chip
                                                            size="small"
                                                            label={card._artVariant}
                                                            sx={{
                                                                ...tagSx,
                                                                bgcolor: 'action.selected',
                                                                color: 'primary.main',
                                                            }}
                                                        />
                                                    )}
                                                    {foilLabel && (
                                                        <FoilTag subTypeName={card.subTypeName} label={foilLabel} />
                                                    )}
                                                    <Box sx={{ display: { xs: 'inline-flex', sm: 'none' }, ml: 0.25 }}>
                                                        <TcgplayerBuyLink
                                                            productId={card.productId}
                                                            subTypeName={card.subTypeName}
                                                        />
                                                    </Box>
                                                </Box>
                                            </Box>

                                            <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
                                                <TcgplayerBuyLink
                                                    productId={card.productId}
                                                    subTypeName={card.subTypeName}
                                                />
                                            </Box>

                                            {isSmall ? (
                                                <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                    <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: 'text.primary', lineHeight: 1.3 }}>
                                                        {formatMoney(card.marketPrice)}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                                        {formatMoney(card.lowPrice)} – {formatMoney(card.highPrice)}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                PRICE_COLUMNS.map((col, colIdx) => (
                                                    <Typography
                                                        key={col.key}
                                                        sx={{
                                                            textAlign: 'right',
                                                            fontVariantNumeric: 'tabular-nums',
                                                            fontWeight: colIdx === 0 ? 700 : 500,
                                                            fontSize: colIdx === 0 ? '0.9375rem' : '0.84375rem',
                                                            color: colIdx === 0 ? 'text.primary' : 'text.secondary',
                                                        }}
                                                    >
                                                        {formatMoney(card[col.key])}
                                                    </Typography>
                                                ))
                                            )}
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Panel>
                    </>
                )}
            </Page>
        </>
    );
};

export default SetDetail;
