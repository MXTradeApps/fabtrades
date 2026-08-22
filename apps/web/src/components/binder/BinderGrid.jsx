import { Box, Card, CardActionArea, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { MoreVert as MoreVertIcon } from '@mui/icons-material';
import { useState } from 'react';
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

export function formatBinderTileValue(ownedRows) {
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

export default function BinderGrid({
    binders = [],
    entries = [],
    resolveCard,
    onOpen,
    onCreate,
    onRename,
    onDelete,
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
                <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {cover.printingId ? (
                        coverRow?.imageUrl ? (
                            <Box
                                component="img"
                                data-testid={`binder-tile-cover-${id}`}
                                src={coverRow.imageUrl}
                                alt=""
                                sx={{ maxHeight: 112, maxWidth: '100%', objectFit: 'contain' }}
                            />
                        ) : (
                            <Box data-testid={`binder-tile-cover-${id}`} sx={{ width: 72, height: 100, bgcolor: paperBorder }} />
                        )
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
            {(onRename || onDelete) && (
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
