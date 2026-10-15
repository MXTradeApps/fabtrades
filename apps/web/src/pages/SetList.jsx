import { useState, useMemo } from 'react';
import {
    Box,
    ButtonBase,
    Typography,
    TextField,
    InputAdornment,
    CircularProgress,
    Alert
} from '@mui/material';
import {
    Search as SearchIcon,
    ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import Header from '../components/elements/Header.jsx';
import { Page, PageHeader, SectionTitle } from '../components/layout/Page.jsx';
import { tk } from '../theme/tokens.js';
import CatalogPrintingResults from '../components/search/CatalogPrintingResults.jsx';
import { SearchClearAdornment } from '../components/search/index.js';
import { useSets } from '../hooks/useSets.js';
import { useCardData } from '../hooks/useCardData.jsx';
import { useDocumentHead } from '../utils/seo.js';
import { matchPrintings } from '../utils/searchUtils.js';
import { browseTierLabel, setBrowseTier } from '../utils/setSort.js';

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

/**
 * Set tile: official FAB set logo on a neutral plate (falls back to the
 * abbreviation), then the name and the numbers people scan for.
 */
const SetTile = ({ set }) => {
    const [logoFailed, setLogoFailed] = useState(false);
    const showLogo = Boolean(set.logoUrl) && !logoFailed;

    return (
        <ButtonBase
            component={Link}
            to={`/sets/${set.slug || set.groupId}`}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                textAlign: 'left',
                minWidth: 0,
                borderRadius: '14px',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflow: 'hidden',
                transition: 'border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease',
                '&:hover': {
                    borderColor: 'text.disabled',
                    boxShadow: (t) => tk(t).shadowMd,
                },
                '&:hover .set-tile-arrow': { transform: 'translateX(2px)', color: 'text.primary' },
                '&.Mui-focusVisible': { borderColor: 'primary.main' },
            }}
        >
            <Box
                sx={{
                    height: { xs: 68, sm: 84 },
                    display: 'grid',
                    placeItems: 'center',
                    px: 2.5,
                    bgcolor: 'surface.sunken',
                    borderBottom: 1,
                    borderColor: 'divider',
                }}
            >
                {showLogo ? (
                    <Box
                        component="img"
                        src={set.logoUrl}
                        alt=""
                        loading="lazy"
                        onError={() => setLogoFailed(true)}
                        sx={{
                            display: 'block',
                            maxHeight: 52,
                            maxWidth: '100%',
                            width: 'auto',
                            objectFit: 'contain',
                        }}
                    />
                ) : (
                    <Typography
                        aria-hidden
                        sx={{
                            fontFamily: (t) => t.typography.h1.fontFamily,
                            fontWeight: 800,
                            fontStretch: '120%',
                            fontSize: '1.6rem',
                            letterSpacing: '0.02em',
                            color: 'text.disabled',
                        }}
                    >
                        {set.abbreviation || set.name.slice(0, 3).toUpperCase()}
                    </Typography>
                )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
                        <Typography
                            variant="subtitle1"
                            noWrap
                            sx={{ color: 'text.primary', fontWeight: 650, lineHeight: 1.3, minWidth: 0 }}
                        >
                            {set.name}
                        </Typography>
                        {set.abbreviation ? (
                            <Typography
                                component="span"
                                sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', flexShrink: 0 }}
                            >
                                {set.abbreviation}
                            </Typography>
                        ) : null}
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            columnGap: 1.5,
                            rowGap: 0.25,
                            mt: 0.5,
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        <span>{formatDate(set.publishedOn)}</span>
                        <span>{set.cardCount} cards</span>
                        {set.topMarketPrice > 0 && (
                            <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                Top {formatMoney(set.topMarketPrice)}
                            </Box>
                        )}
                    </Box>
                </Box>
                <ChevronRightIcon
                    className="set-tile-arrow"
                    sx={{ color: 'text.disabled', flexShrink: 0, transition: 'transform 120ms ease, color 120ms ease' }}
                />
            </Box>
        </ButtonBase>
    );
};

// Consecutive sets that share a browse tier, in catalog order.
const groupByTier = (sets) => {
    const groups = [];
    for (const set of sets) {
        const tier = setBrowseTier(set.name);
        const last = groups[groups.length - 1];
        if (last && last.tier === tier) {
            last.sets.push(set);
        } else {
            groups.push({ tier, sets: [set] });
        }
    }
    return groups;
};

const SetList = () => {
    const { sets, loading, error } = useSets();
    const { cards, pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();
    const [query, setQuery] = useState('');

    useDocumentHead({
        title: 'Flesh and Blood Card Price Guides by Set',
        description:
            'Browse every Flesh and Blood TCG set and see up-to-date TCGplayer ' +
            'market prices for each card. Pick a set for its full price guide.',
        canonicalPath: '/sets'
    });

    const searching = query.trim().length > 0;
    const printings = useMemo(
        () => (searching ? matchPrintings(cards, query) : []),
        [cards, query, searching],
    );
    const tiers = useMemo(() => groupByTier(sets), [sets]);

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />

            <Page>
                <PageHeader
                    title="Browse Sets"
                    subtitle="Pick a set to see its cards ranked by TCGplayer market price."
                />

                <TextField
                    fullWidth
                    placeholder="Search all cards…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    inputProps={{ 'aria-label': 'Search all cards' }}
                    sx={{ mb: 3, maxWidth: 640 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <SearchClearAdornment
                                value={query}
                                onClear={() => setQuery('')}
                            />
                        ),
                    }}
                />

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {searching ? (
                    <CatalogPrintingResults printings={printings} />
                ) : loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : sets.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
                        No sets available.
                    </Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {tiers.map(({ tier, sets: tierSets }, idx) => (
                            <Box component="section" key={`${tier}-${idx}`}>
                                <SectionTitle count={tierSets.length}>
                                    {browseTierLabel(tier)}
                                </SectionTitle>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: {
                                            xs: '1fr',
                                            sm: 'repeat(2, minmax(0, 1fr))',
                                            lg: 'repeat(3, minmax(0, 1fr))',
                                        },
                                        gap: 1.5,
                                    }}
                                >
                                    {tierSets.map((set) => (
                                        <SetTile key={set.groupId} set={set} />
                                    ))}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}
            </Page>
        </>
    );
};

export default SetList;
