import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, ButtonBase, TablePagination, Typography } from '@mui/material';
import { tk } from '../../theme/tokens.js';
import { formatCurrency } from '../../utils/helpers.js';
import {
    BINDER_PAGE_SIZE,
    BINDER_PAGE_SIZE_OPTIONS,
    paginate,
} from '../../utils/paginate.js';

/** Card art: CDN first, then catalog/TCG fallback when the CDN 404s. */
function CardArt({ imageUrl, fallbackUrl, alt }) {
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
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1,
                    textAlign: 'center',
                    color: 'text.secondary',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                }}
            >
                {alt}
            </Box>
        );
    }

    return (
        <Box
            component="img"
            src={src}
            alt={alt || ''}
            loading="lazy"
            decoding="async"
            onError={handleError}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
    );
}

/**
 * Read-only card-image grid for a shared binder. Each tile shows the card art,
 * copies held, price, and an Add to trade action.
 */
export default function BinderCardGrid({
    entries = [],
    resolveCard,
    resetKey,
    onOpenDetail,
    onAddToTrade,
    rowKey = (entry) => entry.cardId,
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

    return (
        <Box data-testid="binder-card-grid">
            <Box
                component="ul"
                sx={{
                    listStyle: 'none',
                    m: 0,
                    p: 0,
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: 'repeat(2, minmax(0, 1fr))',
                        sm: 'repeat(auto-fill, minmax(170px, 1fr))',
                    },
                    gap: { xs: 1.5, sm: 2 },
                }}
            >
                {sliced.rows.map((entry) => {
                    const card = resolveCard(entry);
                    const qty = entry.quantity || 1;
                    const market = card.market;
                    const priced = Number(market) > 0;
                    const meta = [card.finish, entry.condition].filter(Boolean).join(' · ');

                    return (
                        <Box
                            component="li"
                            key={rowKey(entry)}
                            data-testid={`binder-card-tile-${entry.cardId}`}
                            sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
                        >
                            <ButtonBase
                                onClick={() => onOpenDetail?.(entry)}
                                aria-label={`View ${card.name}`}
                                sx={{
                                    position: 'relative',
                                    display: 'block',
                                    width: '100%',
                                    aspectRatio: '63 / 88',
                                    borderRadius: '4.5% / 3.2%',
                                    overflow: 'hidden',
                                    bgcolor: 'surface.sunken',
                                    boxShadow: (t) => tk(t).shadowSm,
                                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        boxShadow: (t) => tk(t).shadowMd,
                                    },
                                }}
                            >
                                <CardArt
                                    imageUrl={card.imageUrl}
                                    fallbackUrl={card.imageUrlFallback}
                                    alt={card.name}
                                />
                                {qty > 1 && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 6,
                                            right: 6,
                                            px: 0.75,
                                            py: 0.25,
                                            borderRadius: '6px',
                                            bgcolor: 'rgba(0, 0, 0, 0.72)',
                                            color: '#fff',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            fontVariantNumeric: 'tabular-nums',
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {qty}×
                                    </Box>
                                )}
                            </ButtonBase>

                            <Box sx={{ pt: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                    <Typography
                                        noWrap
                                        title={card.name}
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            fontWeight: 650,
                                            fontSize: '0.875rem',
                                            color: 'text.primary',
                                        }}
                                    >
                                        {card.name}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            flexShrink: 0,
                                            fontWeight: 700,
                                            fontSize: '0.875rem',
                                            fontVariantNumeric: 'tabular-nums',
                                            color: priced ? 'text.primary' : 'text.disabled',
                                        }}
                                    >
                                        {priced ? formatCurrency(Number(market).toFixed(2)) : '—'}
                                    </Typography>
                                </Box>
                                {meta && (
                                    <Typography
                                        noWrap
                                        sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.4 }}
                                    >
                                        {meta}
                                    </Typography>
                                )}
                                <Button
                                    size="small"
                                    variant="contained"
                                    fullWidth
                                    onClick={() => onAddToTrade?.(entry)}
                                    sx={{ mt: 0.75 }}
                                >
                                    Add to trade
                                </Button>
                            </Box>
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
                    sx={{
                        mt: 2,
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
                        '.MuiTablePagination-input .MuiOutlinedInput-notchedOutline': { border: 0 },
                    }}
                />
            )}
        </Box>
    );
}
