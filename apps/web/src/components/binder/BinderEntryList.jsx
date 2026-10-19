import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
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
    DeleteOutline as DeleteIcon,
    Remove as RemoveIcon,
} from '@mui/icons-material';
import { CardThumbnail } from '../ui/CardImagePreview.jsx';
import { tk } from '../../theme/tokens.js';
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
    rowKey = (entry) => entry.cardId,
    selectedKeys,
    onToggleSelect,
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
        color: 'text.secondary',
        overflow: 'hidden',
        '.MuiTablePagination-toolbar': {
            minHeight: 40,
            px: 0.5,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
        },
        '.MuiTablePagination-displayedRows, .MuiTablePagination-selectLabel': {
            color: 'text.secondary',
            fontSize: '0.8125rem',
            m: 0,
            fontVariantNumeric: 'tabular-nums',
        },
        '.MuiTablePagination-select': {
            color: 'text.primary',
            fontSize: '0.8125rem',
        },
        '.MuiTablePagination-input .MuiOutlinedInput-notchedOutline': { border: 0 },
    };

    return (
        <Box data-testid="binder-entry-list">
            <Box
                component="ul"
                sx={{
                    listStyle: 'none',
                    m: 0,
                    p: 0,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                    boxShadow: (t) => tk(t).shadowSm,
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
                    const key = rowKey(entry);

                    return (
                        <Box
                            component="li"
                            key={key}
                            data-testid={`binder-entry-row-${entry.cardId}`}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                columnGap: 1.5,
                                rowGap: 0.75,
                                minHeight: 60,
                                px: { xs: 1.5, sm: 2 },
                                py: 1,
                                borderTop: index === 0 ? 0 : 1,
                                borderColor: 'divider',
                                transition: 'background-color 120ms ease',
                                '&:hover': { bgcolor: 'action.hover' },
                                ...(selectedKeys?.has(key) && { bgcolor: 'action.selected' }),
                            }}
                        >
                            {onToggleSelect && (
                                <Checkbox
                                    size="small"
                                    checked={Boolean(selectedKeys?.has(key))}
                                    onChange={() => onToggleSelect(entry)}
                                    inputProps={{
                                        'aria-label': `Select ${card.name}`,
                                        'data-testid': `binder-select-${key}`,
                                    }}
                                    sx={{ p: 0.5, ml: -0.5, flexShrink: 0 }}
                                />
                            )}
                            <CardThumbnail
                                imageUrl={card.imageUrl}
                                fallbackUrl={card.imageUrlFallback}
                                alt={card.name}
                                size={34}
                                onClick={canOpen ? () => onOpenDetail?.(entry) : undefined}
                            />

                            <Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
                                <Typography
                                    component={canOpen ? 'button' : 'span'}
                                    type={canOpen ? 'button' : undefined}
                                    onClick={canOpen ? () => onOpenDetail?.(entry) : undefined}
                                    aria-label={canOpen ? `View details for ${card.name}` : undefined}
                                    sx={{
                                        display: 'block',
                                        width: '100%',
                                        fontWeight: 600,
                                        fontSize: '0.875rem',
                                        lineHeight: 1.3,
                                        color: 'text.primary',
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
                                        '&:hover': canOpen ? { color: 'primary.main' } : undefined,
                                    }}
                                >
                                    {card.name}
                                </Typography>
                                <Typography
                                    sx={{
                                        color: 'text.secondary',
                                        fontSize: '0.75rem',
                                        lineHeight: 1.35,
                                        mt: 0.25,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {metaLine(card, entry.condition)}
                                </Typography>
                            </Box>

                            {canChangeVersion && (
                                <FormControl size="small" sx={{ minWidth: 104, flexShrink: 0 }}>
                                    <Select
                                        value={entry.cardId}
                                        disabled={busy}
                                        onChange={(e) => onChangeVersion?.(entry, e.target.value)}
                                        aria-label={`Version of ${card.name}`}
                                        sx={{
                                            color: 'text.secondary',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            height: 30,
                                            '& .MuiSelect-select': { py: 0.25, px: 1 },
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
                                    minWidth: 64,
                                }}
                            >
                                <Typography
                                    sx={{
                                        color: priced ? 'text.primary' : 'text.disabled',
                                        fontWeight: 700,
                                        fontSize: '0.9375rem',
                                        fontVariantNumeric: 'tabular-nums',
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {priced ? formatCurrency(Number(market).toFixed(2)) : '—'}
                                </Typography>
                                {variant === 'shared' && (
                                    <Typography
                                        sx={{
                                            color: 'text.secondary',
                                            fontSize: '0.75rem',
                                            fontVariantNumeric: 'tabular-nums',
                                            lineHeight: 1.3,
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
                                        gap: 0.75,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            height: 30,
                                            borderRadius: '9px',
                                            bgcolor: 'surface.sunken',
                                        }}
                                    >
                                        <IconButton
                                            size="small"
                                            disabled={busy}
                                            onClick={() => onUpdateQuantity?.(entry, qty - 1)}
                                            aria-label="decrease quantity"
                                            sx={{ p: 0.5, color: 'text.secondary' }}
                                        >
                                            <RemoveIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                        <Typography
                                            sx={{
                                                minWidth: 20,
                                                textAlign: 'center',
                                                fontWeight: 700,
                                                fontSize: '0.8125rem',
                                                color: 'text.primary',
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
                                            sx={{ p: 0.5, color: 'text.secondary' }}
                                        >
                                            <AddIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Box>
                                    {!isWanted && onMove && (
                                        <Button
                                            size="small"
                                            data-testid={`binder-move-${entry.cardId}`}
                                            onClick={() => onMove(entry)}
                                            color="inherit"
                                            sx={{
                                                fontSize: '0.75rem',
                                                minWidth: 0,
                                                px: 1,
                                                minHeight: 30,
                                                color: 'text.secondary',
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
                                        sx={{ color: 'text.disabled', p: 0.6, '&:hover': { color: 'error.main' } }}
                                    >
                                        {busy ? (
                                            <CircularProgress size={14} />
                                        ) : (
                                            <DeleteIcon sx={{ fontSize: 18 }} />
                                        )}
                                    </IconButton>
                                </Box>
                            )}

                            {variant === 'shared' && (
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => onAddToTrade?.(entry)}
                                    sx={{ flexShrink: 0 }}
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
