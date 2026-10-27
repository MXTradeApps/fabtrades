import { Box, Card, CardActionArea, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import {
    MoreHoriz as MoreVertIcon,
    BookmarkBorderRounded,
    CollectionsBookmarkOutlined,
} from '@mui/icons-material';
import { tk } from '../../theme/tokens.js';
import { useEffect, useMemo, useState } from 'react';
import { pickBinderCover } from '../../utils/binderCover.js';
import { isPricedField } from '../../utils/binderValueSnapshot.js';
import { gridOrderBinders, isProtectedBinder, TRADE_BINDER_ID, WANT_BINDER_ID } from '../../services/binder.js';

function formatTileUsd(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatBinderTileValue(ownedRows) {
    let copies = 0;
    let amount = 0;
    let priced = false;
    for (const row of ownedRows || []) {
        const qty = Number(row.quantity) || 0;
        copies += qty;
        const market = row.market ?? row.tcgMarket;
        if (isPricedField(market)) {
            priced = true;
            amount += Number(market) * qty;
        }
    }
    if (copies <= 0) return formatTileUsd(0);
    if (!priced) return '—';
    return formatTileUsd(amount);
}

/**
 * Bucket entries by tile in one pass. Filtering the whole collection once per
 * tile, and resolving each card again on every render, was the bulk of the
 * grid's render cost for collections in the thousands.
 */
function rowsByBinder(entries, resolveCard) {
    const buckets = new Map();
    for (const entry of entries || []) {
        if (!((entry.quantity || 0) > 0)) continue;
        const binderId = entry.isWanted ? WANT_BINDER_ID : (entry.binderId || TRADE_BINDER_ID);
        const card = resolveCard ? resolveCard(entry) : (entry.card || {});
        const row = {
            ...entry,
            printingId: entry.cardId || entry.printingId,
            name: card.name || entry.name || '',
            tcgMarket: card.market ?? card.tcgMarket ?? entry.tcgMarket,
            market: card.market ?? card.tcgMarket ?? entry.tcgMarket,
            imageUrl: card.imageUrl,
            imageUrlFallback: card.imageUrlFallback,
            isFoil: Boolean(card.isFoil),
            condition: entry.condition || 'NM',
            quantity: entry.quantity || 1,
        };
        const bucket = buckets.get(binderId);
        if (bucket) bucket.push(row);
        else buckets.set(binderId, [row]);
    }
    return buckets;
}

const NO_ROWS = [];

/** Tile art: CDN first, then catalog/TCG fallback when the CDN 404s. */
function BinderTileCover({ imageUrl, fallbackUrl, alt, binderId }) {
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

    if (!src || failed) {
        return (
            <Box
                data-testid={`binder-tile-cover-${binderId}`}
                sx={{ width: '100%', height: '100%', bgcolor: 'surface.sunken' }}
            />
        );
    }

    return (
        <Box
            component="img"
            data-testid={`binder-tile-cover-${binderId}`}
            src={src}
            alt={alt || ''}
            onError={handleError}
            sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'top',
                display: 'block',
            }}
        />
    );
}

export default function BinderGrid({
    binders = [],
    entries = [],
    resolveCard,
    onOpen,
    onRename,
    onDelete,
    onClear,
    onSettings,
}) {
    const ordered = useMemo(() => gridOrderBinders(binders), [binders]);
    const rowsById = useMemo(() => rowsByBinder(entries, resolveCard), [entries, resolveCard]);

    return (
        <Box
            data-testid="binder-grid"
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(auto-fill, minmax(200px, 1fr))',
                },
                gap: { xs: 1.5, sm: 2 },
            }}
        >
            {ordered.map((binder) => (
                <BinderTile
                    key={binder.clientId}
                    binder={binder}
                    rows={rowsById.get(binder.clientId) || NO_ROWS}
                    onOpen={onOpen}
                    onRename={onRename}
                    onDelete={isProtectedBinder(binder) ? undefined : onDelete}
                    onClear={onClear}
                    onSettings={onSettings}
                />
            ))}
        </Box>
    );
}

function BinderTile({
    binder,
    rows,
    onOpen,
    onRename,
    onDelete,
    onClear,
    onSettings,
}) {
    const [menuEl, setMenuEl] = useState(null);
    const id = binder.clientId;
    const copies = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const value = formatBinderTileValue(rows);
    const cover = pickBinderCover(rows);
    const coverRow = rows.find((r) => r.printingId === cover.printingId);

    return (
        <Card
            sx={{
                position: 'relative',
                bgcolor: 'background.paper',
                transition: 'border-color 120ms ease, box-shadow 120ms ease',
                '&:hover': { borderColor: 'text.disabled', boxShadow: (t) => tk(t).shadowMd },
            }}
        >
            <CardActionArea
                data-testid={`binder-tile-${id}`}
                onClick={() => onOpen?.(binder)}
                sx={{ textAlign: 'left' }}
            >
                <Box
                    sx={{
                        position: 'relative',
                        aspectRatio: '4 / 3',
                        overflow: 'hidden',
                        bgcolor: 'surface.sunken',
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    {cover.printingId ? (
                        <BinderTileCover
                            binderId={id}
                            imageUrl={coverRow?.imageUrl}
                            fallbackUrl={coverRow?.imageUrlFallback}
                            alt={coverRow?.name}
                        />
                    ) : (
                        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'text.disabled' }}>
                            {id === WANT_BINDER_ID
                                ? <BookmarkBorderRounded sx={{ fontSize: 36 }} />
                                : <CollectionsBookmarkOutlined sx={{ fontSize: 36 }} />}
                        </Box>
                    )}
                </Box>
                <Box sx={{ px: 1.75, py: 1.5 }}>
                    <Typography
                        data-testid={`binder-tile-name-${id}`}
                        sx={{ fontWeight: 650, color: 'text.primary', fontSize: '0.9375rem', pr: 3 }}
                        noWrap
                    >
                        {binder.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mt: 0.25 }}>
                        <Typography data-testid={`binder-tile-count-${id}`} sx={{ color: 'text.secondary', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                            {copies} {copies === 1 ? 'card' : 'cards'}
                        </Typography>
                        <Typography data-testid={`binder-tile-value-${id}`} sx={{ fontWeight: 700, fontSize: '0.9375rem', color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                            {value}
                        </Typography>
                    </Box>
                </Box>
            </CardActionArea>
            {(onRename || onDelete || onClear || onSettings) && (
                <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                    <IconButton
                        size="small"
                        aria-label={`${binder.name} options`}
                        data-testid={`binder-tile-menu-${id}`}
                        sx={{
                            color: '#fff',
                            bgcolor: 'rgba(0, 0, 0, 0.45)',
                            backdropFilter: 'blur(6px)',
                            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.65)' },
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setMenuEl(e.currentTarget);
                        }}
                    >
                        <MoreVertIcon fontSize="small" />
                    </IconButton>
                </Box>
            )}
            <Menu
                anchorEl={menuEl}
                open={Boolean(menuEl)}
                onClose={() => setMenuEl(null)}
            >
                {onSettings && (
                    <MenuItem
                        data-testid={`binder-tile-settings-${id}`}
                        onClick={() => {
                            setMenuEl(null);
                            onSettings(binder);
                        }}
                    >
                        Settings
                    </MenuItem>
                )}
                {onRename && (
                    <MenuItem
                        onClick={() => {
                            setMenuEl(null);
                            onRename(binder);
                        }}
                    >
                        Rename
                    </MenuItem>
                )}
                {onClear && copies > 0 && (
                    <MenuItem
                        data-testid={`binder-clear-${id}`}
                        onClick={() => {
                            setMenuEl(null);
                            onClear(binder);
                        }}
                    >
                        Clear
                    </MenuItem>
                )}
                {onDelete && (
                    <MenuItem
                        data-testid={`binder-delete-${id}`}
                        onClick={() => {
                            setMenuEl(null);
                            onDelete(binder);
                        }}
                        sx={{ color: 'error.main' }}
                    >
                        Delete
                    </MenuItem>
                )}
            </Menu>
        </Card>
    );
}
