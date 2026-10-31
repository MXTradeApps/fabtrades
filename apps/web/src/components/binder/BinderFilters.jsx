import { useState } from 'react';
import { Box, Button, ButtonBase, Chip, Divider, Drawer, Typography, useTheme } from '@mui/material';
import { CheckRounded, ExpandMoreRounded, ExpandLessRounded } from '@mui/icons-material';
import { tk } from '../../theme/tokens.js';
import { FILTER_GROUPS } from '../../utils/binderFilters.js';

const RARITY_PREVIEW = 5;
const SET_PREVIEW = 12;

/** Badge colours per rarity; anything unlisted gets a neutral badge. */
const RARITY_COLORS = {
    fabled: '#D9822B',
    marvel: '#7A4FB5',
    legendary: '#C9A227',
    majestic: '#B3261E',
    promo: '#2E8B57',
    'super rare': '#2F6DB5',
    rare: '#4A90C9',
    common: '#8C8C8C',
    basic: '#A89C90',
    token: '#6F6259',
};

/** Standard FAB pitch colours. */
const PITCH_COLORS = { 1: '#D64545', 2: '#E8C547', 3: '#3D7DD8' };

const FOIL_SWATCHES = {
    rainbow: 'linear-gradient(135deg, #ff8a8a, #ffd27a, #8be3a5, #8ac4ff, #c99bff)',
    cold: 'linear-gradient(135deg, #7fe7f5, #b8f3ff)',
    gold: 'linear-gradient(135deg, #f2c94c, #e0a526)',
    foil: 'linear-gradient(135deg, #e4c09c, #f4e9dd)',
    nonfoil: '#D6D3D1',
};

function SectionTitle({ children }) {
    return (
        <Typography
            component="h3"
            sx={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'text.secondary',
                mb: 1,
            }}
        >
            {children}
        </Typography>
    );
}

function OptionRow({ selected, onClick, icon, label, count, testId }) {
    const palette = tk(useTheme());
    return (
        <ButtonBase
            data-testid={testId}
            aria-pressed={selected}
            onClick={onClick}
            sx={{
                width: '100%',
                justifyContent: 'flex-start',
                gap: 1.25,
                px: 1,
                py: 0.6,
                borderRadius: '8px',
                border: 1,
                borderColor: selected ? palette.accent : 'transparent',
                textAlign: 'left',
                bgcolor: selected ? palette.accentSoft : 'transparent',
                color: selected ? palette.accentText : 'text.primary',
                fontWeight: selected ? 650 : 500,
                // No matches with the other picks: still clickable, but muted.
                opacity: !selected && count === 0 ? 0.45 : 1,
                '&:hover': { bgcolor: selected ? palette.accentSoft : palette.hover },
            }}
        >
            {icon}
            <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: '0.875rem' }}>
                {label}
            </Box>
            {selected ? (
                <CheckRounded sx={{ fontSize: '1rem', color: palette.accentText }} />
            ) : (
                <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                    {count}
                </Box>
            )}
        </ButtonBase>
    );
}

function ShowMore({ expanded, onClick, testId }) {
    return (
        <Button
            size="small"
            color="inherit"
            data-testid={testId}
            onClick={onClick}
            startIcon={expanded ? <ExpandLessRounded /> : <ExpandMoreRounded />}
            sx={{ mt: 0.5, color: 'text.secondary', fontWeight: 500, fontSize: '0.8rem' }}
        >
            {expanded ? 'Show less' : 'Show more'}
        </Button>
    );
}

function SetTile({ option, logoUrl, selected, onClick }) {
    const palette = tk(useTheme());
    const [logoFailed, setLogoFailed] = useState(false);
    const showLogo = logoUrl && !logoFailed;
    return (
        <ButtonBase
            data-testid={`binder-filter-set-${option.code || option.name}`}
            aria-pressed={selected}
            title={`${option.name} (${option.count})`}
            onClick={onClick}
            sx={{
                flexDirection: 'column',
                gap: 0.5,
                opacity: !selected && option.count === 0 ? 0.45 : 1,
                p: 0.75,
                minHeight: 64,
                borderRadius: '10px',
                border: selected ? 2 : 1,
                // Keep the tile the same size when the thicker border appears.
                m: selected ? 0 : '1px',
                borderColor: selected ? palette.accent : palette.border,
                bgcolor: selected ? palette.accentSoft : palette.surface,
                '&:hover': { borderColor: selected ? palette.accent : palette.borderStrong },
            }}
        >
            <Box sx={{ height: 28, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showLogo ? (
                    <Box
                        component="img"
                        src={logoUrl}
                        alt=""
                        loading="lazy"
                        onError={() => setLogoFailed(true)}
                        sx={{ maxHeight: 28, maxWidth: '100%', objectFit: 'contain' }}
                    />
                ) : (
                    <Typography
                        sx={{
                            fontSize: '0.625rem',
                            lineHeight: 1.15,
                            color: 'text.secondary',
                            textAlign: 'center',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                        }}
                    >
                        {option.name}
                    </Typography>
                )}
            </Box>
            <Typography
                sx={{
                    fontSize: '0.7rem',
                    fontWeight: 650,
                    color: selected ? palette.accentText : 'text.secondary',
                    lineHeight: 1,
                }}
            >
                {option.code || '—'}
            </Typography>
        </ButtonBase>
    );
}

/**
 * Rarity / Foiling / Set filters for an open Binder. Options come from
 * `buildBinderFilterOptions` so only values present in the Binder show.
 */
export default function BinderFilters({ options, filters, onToggle, onClear, activeCount, logoByGroupId = {} }) {
    const [moreRarities, setMoreRarities] = useState(false);
    const [moreSets, setMoreSets] = useState(false);

    const visibleRarities = moreRarities ? options.rarities : options.rarities.slice(0, RARITY_PREVIEW);
    const visibleSets = moreSets ? options.sets : options.sets.slice(0, SET_PREVIEW);
    // Keep picked values visible even while the list is collapsed.
    const pinnedRarities = options.rarities.filter(
        (o) => filters.rarities.includes(o.id) && !visibleRarities.includes(o),
    );
    const pinnedSets = options.sets.filter(
        (o) => filters.sets.includes(o.id) && !visibleSets.includes(o),
    );

    return (
        <Box data-testid="binder-filters">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, minHeight: 30 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Filters</Typography>
                {activeCount > 0 && (
                    <Button size="small" data-testid="binder-filters-clear" onClick={onClear}>
                        Clear ({activeCount})
                    </Button>
                )}
            </Box>

            {options.rarities.length > 0 && (
                <>
                    <SectionTitle>Rarity</SectionTitle>
                    {[...visibleRarities, ...pinnedRarities].map((o) => {
                        const color = RARITY_COLORS[o.id.toLowerCase()] || '#9A8C80';
                        return (
                            <OptionRow
                                key={o.id}
                                testId={`binder-filter-rarity-${o.id}`}
                                selected={filters.rarities.includes(o.id)}
                                onClick={() => onToggle('rarities', o.id)}
                                label={o.label}
                                count={o.count}
                                icon={(
                                    <Box
                                        component="span"
                                        aria-hidden
                                        sx={{
                                            width: 18,
                                            height: 18,
                                            flexShrink: 0,
                                            borderRadius: '50%',
                                            bgcolor: color,
                                            color: '#fff',
                                            fontSize: '0.625rem',
                                            fontWeight: 800,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {o.label.charAt(0).toUpperCase()}
                                    </Box>
                                )}
                            />
                        );
                    })}
                    {options.rarities.length > RARITY_PREVIEW && (
                        <ShowMore
                            testId="binder-filter-rarity-more"
                            expanded={moreRarities}
                            onClick={() => setMoreRarities((v) => !v)}
                        />
                    )}
                    <Divider sx={{ my: 2 }} />
                </>
            )}

            {options.foilings.length > 0 && (
                <>
                    <SectionTitle>Foiling</SectionTitle>
                    {options.foilings.map((o) => (
                        <OptionRow
                            key={o.id}
                            testId={`binder-filter-foiling-${o.id}`}
                            selected={filters.foilings.includes(o.id)}
                            onClick={() => onToggle('foilings', o.id)}
                            label={o.label}
                            count={o.count}
                            icon={(
                                <Box
                                    component="span"
                                    aria-hidden
                                    sx={{
                                        width: 18,
                                        height: 18,
                                        flexShrink: 0,
                                        borderRadius: '4px',
                                        background: FOIL_SWATCHES[o.id],
                                    }}
                                />
                            )}
                        />
                    ))}
                    <Divider sx={{ my: 2 }} />
                </>
            )}

            {options.pitches.length > 0 && (
                <>
                    <SectionTitle>Pitch</SectionTitle>
                    {options.pitches.map((o) => (
                        <OptionRow
                            key={o.id}
                            testId={`binder-filter-pitch-${o.id}`}
                            selected={filters.pitches.includes(o.id)}
                            onClick={() => onToggle('pitches', o.id)}
                            label={o.label}
                            count={o.count}
                            icon={(
                                <Box
                                    component="span"
                                    aria-hidden
                                    sx={{
                                        width: 14,
                                        height: 14,
                                        mx: '2px',
                                        flexShrink: 0,
                                        borderRadius: '50%',
                                        bgcolor: PITCH_COLORS[o.id],
                                    }}
                                />
                            )}
                        />
                    ))}
                    <Divider sx={{ my: 2 }} />
                </>
            )}

            {options.sets.length > 0 && (
                <>
                    <SectionTitle>Set</SectionTitle>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75 }}>
                        {[...visibleSets, ...pinnedSets].map((o) => (
                            <SetTile
                                key={o.id}
                                option={o}
                                logoUrl={(o.groupId != null && logoByGroupId[String(o.groupId)]) || o.logoUrl}
                                selected={filters.sets.includes(o.id)}
                                onClick={() => onToggle('sets', o.id)}
                            />
                        ))}
                    </Box>
                    {options.sets.length > SET_PREVIEW && (
                        <ShowMore
                            testId="binder-filter-set-more"
                            expanded={moreSets}
                            onClick={() => setMoreSets((v) => !v)}
                        />
                    )}
                </>
            )}
        </Box>
    );
}

function chipLabel(options, group, value) {
    if (group === 'foilings') return options.foilings.find((o) => o.id === value)?.label || value;
    if (group === 'pitches') {
        const label = options.pitches.find((o) => o.id === value)?.label;
        return label ? `${label} pitch` : value;
    }
    if (group === 'sets') {
        const set = options.sets.find((o) => o.id === value);
        return set?.code ? `${set.code} · ${set.name}` : value;
    }
    return value;
}

/**
 * "23 of 81 cards" plus a removable chip for every picked filter value and
 * Clear all. Shows only while filters or search narrow the list.
 */
export function ActiveFilterBar({ options, filters, onToggle, onClearAll, shownCount, totalCount, narrowed }) {
    if (!narrowed) return null;
    const picked = FILTER_GROUPS.flatMap((group) =>
        (filters[group] || []).map((value) => ({ group, value })),
    );
    return (
        <Box
            data-testid="binder-active-filters"
            sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}
        >
            <Typography
                data-testid="binder-filter-result-count"
                sx={{ fontSize: '0.875rem', fontWeight: 650, mr: 0.5, fontVariantNumeric: 'tabular-nums' }}
            >
                {`${shownCount} of ${totalCount} ${totalCount === 1 ? 'card' : 'cards'}`}
            </Typography>
            {picked.map(({ group, value }) => (
                <Chip
                    key={`${group}:${value}`}
                    size="small"
                    label={chipLabel(options, group, value)}
                    onDelete={() => onToggle(group, value)}
                />
            ))}
            <Button size="small" data-testid="binder-filters-clear-all" onClick={onClearAll}>
                Clear all
            </Button>
        </Box>
    );
}

/** Narrow-screen version of the panel: a right-hand drawer with a done button. */
export function BinderFiltersDrawer({ open, onClose, shownCount, children }) {
    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{ sx: { width: 300, maxWidth: '88vw', display: 'flex', flexDirection: 'column' } }}
        >
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>{children}</Box>
            <Box
                sx={{
                    p: 2,
                    pb: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                    borderTop: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                }}
            >
                <Button
                    fullWidth
                    variant="contained"
                    data-testid="binder-filters-done"
                    onClick={onClose}
                >
                    {`Show ${shownCount} ${shownCount === 1 ? 'card' : 'cards'}`}
                </Button>
            </Box>
        </Drawer>
    );
}

/** Desktop sidebar wrapper that sticks while the card list scrolls. */
export function BinderFiltersSidebar({ children }) {
    return (
        <Box
            component="aside"
            aria-label="Filters"
            sx={{
                display: { xs: 'none', md: 'block' },
                width: 252,
                flexShrink: 0,
                position: 'sticky',
                top: 24,
                maxHeight: 'calc(100vh - 48px)',
                overflowY: 'auto',
                p: 2,
                borderRadius: '14px',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
            }}
        >
            {children}
        </Box>
    );
}
