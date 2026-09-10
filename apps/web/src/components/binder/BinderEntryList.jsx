import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    FormControl,
    IconButton,
    MenuItem,
    Select,
    TablePagination,
    Typography,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Remove as RemoveIcon,
} from '@mui/icons-material';
import { CardThumbnail } from '../ui/CardImagePreview.jsx';
import { formatCurrency } from '../../utils/helpers.js';
import {
    BINDER_PAGE_SIZE,
    BINDER_PAGE_SIZE_OPTIONS,
    paginate,
} from '../../utils/paginate.js';

function metaLine(card, condition) {
    return [card.collectorNumber, card.finish, condition, card.setName]
        .filter(Boolean)
        .join(' · ');
}

export default function BinderEntryList({
    entries = [],
    resolveCard,
    resetKey,
    catalogById,
    editionsByCardId,
    busyCardId,
    variant = 'owned',
    isWanted = false,
    onOpenDetail,
    onChangeVersion,
    onUpdateQuantity,
    onRemove,
    onMove,
    onAddToTrade,
    mutedColor,
    accentColor,
    textColor,
    paperBorder,
    isDark,
}) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(BINDER_PAGE_SIZE);
    const skipScrollRef = useRef(true);

    useEffect(() => {
        setPage(0);
    }, [resetKey]);

    const sliced = useMemo(
        () => paginate(entries, page, rowsPerPage),
        [entries, page, rowsPerPage],
    );

    useEffect(() => {
        if (sliced.page !== page) setPage(sliced.page);
    }, [page, sliced.page]);

    useEffect(() => {
        if (skipScrollRef.current) {
            skipScrollRef.current = false;
            return undefined;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return undefined;
    }, [sliced.page]);

    const showPager = sliced.total > BINDER_PAGE_SIZE_OPTIONS[0];

    const pagerSx = {
        color: mutedColor,
        borderTop: `1px solid ${paperBorder}`,
        overflow: 'hidden',
        '.MuiTablePagination-toolbar': {
            minHeight: 40,
            px: 0.5,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
        },
        '.MuiTablePagination-displayedRows, .MuiTablePagination-selectLabel': {
            color: mutedColor,
            fontSize: '0.75rem',
            m: 0,
        },
        '.MuiTablePagination-select': {
            color: textColor,
            fontSize: '0.75rem',
        },
        '.MuiIconButton-root': { color: accentColor },
        '.MuiIconButton-root.Mui-disabled': { color: paperBorder },
    };

    return (
        <Box data-testid="binder-entry-list">
            <Box
                component="ul"
                sx={{
                    listStyle: 'none',
                    m: 0,
                    p: 0,
                    border: `1px solid ${paperBorder}`,
                    borderRadius: 1,
                    overflow: 'hidden',
                    backgroundColor: isDark
                        ? 'rgba(26, 15, 10, 0.35)'
                        : 'rgba(255, 255, 255, 0.72)',
                }}
            >
                {sliced.rows.map((entry, index) => {
                    const card = resolveCard(entry);
                    const qty = entry.quantity || 1;
                    const busy = busyCardId === entry.cardId;
                    const editions = editionsByCardId?.get(entry.cardId) || [];
                    const canChangeVersion = variant === 'owned' && editions.length >= 2;
                    const canOpen = Boolean(catalogById?.get(entry.cardId));
                    const market = card.market;
                    const priced = market != null && Number.isFinite(market) && market > 0;

                    return (
                        <Box
                            component="li"
                            key={entry.cardId}
                            data-testid={`binder-entry-row-${entry.cardId}`}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 0.75,
                                minHeight: 44,
                                px: 0.75,
                                py: 0.4,
                                borderTop: index === 0 ? 0 : `1px solid ${paperBorder}`,
                            }}
                        >
                            <CardThumbnail
                                imageUrl={card.imageUrl}
                                fallbackUrl={card.imageUrlFallback}
                                alt={card.name}
                                size={28}
                                onClick={canOpen ? () => onOpenDetail?.(entry) : undefined}
                            />

                            <Box sx={{ flex: '1 1 140px', minWidth: 0 }}>
                                <Typography
                                    component={canOpen ? 'button' : 'span'}
                                    type={canOpen ? 'button' : undefined}
                                    onClick={canOpen ? () => onOpenDetail?.(entry) : undefined}
                                    aria-label={canOpen ? `View details for ${card.name}` : undefined}
                                    sx={{
                                        display: 'block',
                                        width: '100%',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        lineHeight: 1.2,
                                        color: textColor,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        border: 0,
                                        background: 'none',
                                        p: 0,
                                        m: 0,
                                        textAlign: 'left',
                                        fontFamily: 'inherit',
                                        cursor: canOpen ? 'pointer' : 'default',
                                    }}
                                >
                                    {card.name}
                                </Typography>
                                <Typography
                                    sx={{
                                        color: mutedColor,
                                        fontSize: '0.65rem',
                                        lineHeight: 1.2,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {metaLine(card, entry.condition)}
                                </Typography>
                            </Box>

                            {canChangeVersion && (
                                <FormControl size="small" sx={{ minWidth: 88, flexShrink: 0 }}>
                                    <Select
                                        value={entry.cardId}
                                        disabled={busy}
                                        onChange={(e) => onChangeVersion?.(entry, e.target.value)}
                                        aria-label={`Version of ${card.name}`}
                                        sx={{
                                            color: mutedColor,
                                            fontSize: '0.65rem',
                                            fontWeight: 600,
                                            height: 26,
                                            '& .MuiSelect-select': { py: 0.25, px: 0.75 },
                                            '& .MuiOutlinedInput-notchedOutline': {
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
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}

                            <Box
                                sx={{
                                    flexShrink: 0,
                                    textAlign: 'right',
                                    minWidth: 52,
                                }}
                            >
                                <Typography
                                    sx={{
                                        color: accentColor,
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        fontVariantNumeric: 'tabular-nums',
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {priced ? formatCurrency(Number(market).toFixed(2)) : '—'}
                                </Typography>
                                {variant === 'shared' && (
                                    <Typography
                                        sx={{
                                            color: mutedColor,
                                            fontSize: '0.65rem',
                                            fontVariantNumeric: 'tabular-nums',
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {qty}×
                                    </Typography>
                                )}
                            </Box>

                            {variant === 'owned' && (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        flexShrink: 0,
                                        gap: 0,
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        disabled={busy}
                                        onClick={() => onUpdateQuantity?.(entry, qty - 1)}
                                        aria-label="decrease quantity"
                                        sx={{ p: 0.25 }}
                                    >
                                        <RemoveIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                    <Typography
                                        sx={{
                                            minWidth: 16,
                                            textAlign: 'center',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            color: textColor,
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {qty}
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        disabled={busy}
                                        onClick={() => onUpdateQuantity?.(entry, qty + 1)}
                                        aria-label="increase quantity"
                                        sx={{ p: 0.25 }}
                                    >
                                        <AddIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                    {!isWanted && onMove && (
                                        <Button
                                            size="small"
                                            data-testid={`binder-move-${entry.cardId}`}
                                            onClick={() => onMove(entry)}
                                            sx={{
                                                fontSize: '0.7rem',
                                                minWidth: 0,
                                                px: 0.5,
                                                minHeight: 24,
                                            }}
                                        >
                                            Move
                                        </Button>
                                    )}
                                    <IconButton
                                        size="small"
                                        disabled={busy}
                                        onClick={() => onRemove?.(entry)}
                                        aria-label="remove card"
                                        sx={{ color: 'error.main', p: 0.25 }}
                                    >
                                        {busy ? (
                                            <CircularProgress size={12} />
                                        ) : (
                                            <DeleteIcon sx={{ fontSize: 16 }} />
                                        )}
                                    </IconButton>
                                </Box>
                            )}

                            {variant === 'shared' && (
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => onAddToTrade?.(entry)}
                                    sx={{
                                        flexShrink: 0,
                                        minHeight: 26,
                                        py: 0.25,
                                        px: 0.75,
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        textTransform: 'none',
                                        backgroundColor: accentColor,
                                        color: isDark ? '#1a0f0a' : '#ffffff',
                                        '&:hover': {
                                            backgroundColor: isDark ? '#d4a574' : '#5d2f0d',
                                        },
                                    }}
                                >
                                    Add to trade
                                </Button>
                            )}
                        </Box>
                    );
                })}
            </Box>

            {showPager && (
                <TablePagination
                    component="div"
                    data-testid="binder-pagination"
                    count={sliced.total}
                    page={sliced.page}
                    onPageChange={(_e, next) => setPage(next)}
                    rowsPerPage={sliced.rowsPerPage}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                    rowsPerPageOptions={BINDER_PAGE_SIZE_OPTIONS}
                    labelRowsPerPage="Per page"
                    sx={pagerSx}
                />
            )}
        </Box>
    );
}
