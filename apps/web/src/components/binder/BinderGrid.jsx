import { Box, Card, CardActionArea, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { MoreVert as MoreVertIcon } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { pickBinderCover } from '../../utils/binderCover.js';
import { isPricedField } from '../../utils/binderValueSnapshot.js';
import { gridOrderBinders, TRADE_BINDER_ID } from '../../services/binder.js';

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

function ownedInBinder(entries, binderId) {
    return (entries || []).filter((e) =>
        !e.isWanted && (e.binderId || TRADE_BINDER_ID) === binderId && (e.quantity || 0) > 0,
    );
}

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
                sx={{ width: '100%', height: '100%', bgcolor: 'rgba(0, 0, 0, 0.2)' }}
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
    onSettings,
    mutedColor,
    accentColor,
    paperBg,
    paperBorder,
}) {
    const ordered = gridOrderBinders(binders);

    return (
        <Box
            data-testid="binder-grid"
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 1.5,
            }}
        >
            {ordered.map((binder) => (
                <BinderTile
                    key={binder.clientId}
                    binder={binder}
                    entries={entries}
                    resolveCard={resolveCard}
                    onOpen={onOpen}
                    onRename={onRename}
                    onDelete={binder.role === 'trade' ? undefined : onDelete}
                    onSettings={onSettings}
                    mutedColor={mutedColor}
                    accentColor={accentColor}
                    paperBg={paperBg}
                    paperBorder={paperBorder}
                />
            ))}
        </Box>
    );
}

function BinderTile({
    binder,
    entries,
    resolveCard,
    onOpen,
    onRename,
    onDelete,
    onSettings,
    mutedColor,
    accentColor,
    paperBg,
    paperBorder,
}) {
    const [menuEl, setMenuEl] = useState(null);
    const id = binder.clientId;
    const rows = ownedInBinder(entries, id).map((entry) => {
        const card = resolveCard ? resolveCard(entry) : (entry.card || {});
        return {
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
    });
    const copies = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const value = formatBinderTileValue(rows);
    const cover = pickBinderCover(rows);
    const coverRow = rows.find((r) => r.printingId === cover.printingId);

    return (
        <Card
            variant="outlined"
            sx={{
                position: 'relative',
                backgroundColor: paperBg,
                borderColor: paperBorder,
            }}
        >
            <CardActionArea
                data-testid={`binder-tile-${id}`}
                onClick={() => onOpen?.(binder)}
                sx={{ p: 1.25, textAlign: 'left' }}
            >
                <Box
                    sx={{
                        height: 120,
                        mb: 0.5,
                        overflow: 'hidden',
                        borderRadius: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    }}
                >
                    {cover.printingId ? (
                        <BinderTileCover
                            binderId={id}
                            imageUrl={coverRow?.imageUrl}
                            fallbackUrl={coverRow?.imageUrlFallback}
                            alt={coverRow?.name}
                        />
                    ) : null}
                </Box>
                <Typography
                    data-testid={`binder-tile-name-${id}`}
                    sx={{ fontWeight: 700, color: accentColor, fontSize: '0.9rem' }}
                    noWrap
                >
                    {binder.name}
                </Typography>
                <Typography data-testid={`binder-tile-count-${id}`} sx={{ color: mutedColor, fontSize: '0.8rem' }}>
                    {copies}
                </Typography>
                <Typography data-testid={`binder-tile-value-${id}`} sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {value}
                </Typography>
            </CardActionArea>
            {(onRename || onDelete || onSettings) && (
                <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
                    <IconButton
                        size="small"
                        data-testid={`binder-tile-menu-${id}`}
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
                {onDelete && (
                    <MenuItem
                        data-testid={`binder-delete-${id}`}
                        onClick={() => {
                            setMenuEl(null);
                            onDelete(binder);
                        }}
                    >
                        Delete
                    </MenuItem>
                )}
            </Menu>
        </Card>
    );
}
