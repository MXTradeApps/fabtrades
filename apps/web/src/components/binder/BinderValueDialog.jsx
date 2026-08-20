import { useMemo } from 'react';
import {
    Box,
    Dialog,
    DialogContent,
    IconButton,
    Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { formatCatalogPrice } from '../cardDetail/CardDetailPrices.jsx';
import {
    buildBinderValueSnapshot,
    snapshotEntryFromBinder,
} from '../../utils/binderValueSnapshot.js';

const PriceRow = ({ label, amount, currency, unpricedCopies, isDark }) => (
    <Box
        sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 1,
            py: 0.35,
        }}
    >
        <Typography
            sx={{
                fontSize: '0.85rem',
                color: isDark ? 'rgba(212, 165, 116, 0.8)' : 'rgba(93, 58, 26, 0.75)',
            }}
        >
            {label}
            {unpricedCopies > 0 ? ` · ${unpricedCopies} unpriced` : ''}
        </Typography>
        <Typography
            sx={{
                fontSize: '0.85rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: isDark ? '#f5f1ed' : '#2c1810',
            }}
        >
            {formatCatalogPrice(amount, currency)}
        </Typography>
    </Box>
);

const Group = ({ title, children, isDark }) => (
    <Box sx={{ mb: 2 }}>
        <Typography
            sx={{
                fontWeight: 800,
                fontSize: '0.75rem',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: isDark ? '#e4c09c' : '#8b4513',
                mb: 0.5,
            }}
        >
            {title}
        </Typography>
        {children}
    </Box>
);

/**
 * Overlay inspect of the Binder total. [entries] are live Binder rows so qty
 * edits behind the dialog refresh the snapshot without a network fetch.
 */
const BinderValueDialog = ({
    open,
    onClose,
    headline,
    entries = [],
    catalogById,
    isDark = false,
}) => {
    const snapshot = useMemo(() => {
        const rows = (entries || []).map((entry) =>
            snapshotEntryFromBinder(
                entry,
                catalogById instanceof Map ? catalogById.get(entry.cardId) : catalogById?.[entry.cardId],
            ),
        );
        return buildBinderValueSnapshot(rows, {
            source: 'tcgplayer',
            headline: 'tcgMarketOnly',
        });
    }, [entries, catalogById]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            aria-labelledby="binder-value-title"
        >
            <DialogContent sx={{ position: 'relative', pt: 2.5, pb: 2.5 }}>
                <IconButton
                    aria-label="Close"
                    onClick={onClose}
                    sx={{ position: 'absolute', top: 8, right: 8 }}
                >
                    <CloseIcon />
                </IconButton>
                <Typography
                    id="binder-value-title"
                    variant="h6"
                    sx={{ fontWeight: 800, pr: 5, color: isDark ? '#f5f1ed' : '#2c1810' }}
                >
                    Binder value
                </Typography>
                <Typography
                    sx={{
                        fontSize: '0.8rem',
                        color: isDark ? 'rgba(212, 165, 116, 0.8)' : 'rgba(93, 58, 26, 0.7)',
                        mb: 0.5,
                    }}
                >
                    TCGplayer
                </Typography>
                <Typography
                    data-testid="binder-value-headline"
                    sx={{
                        fontWeight: 800,
                        fontSize: '1.6rem',
                        color: '#2e7d32',
                        mb: 2,
                    }}
                >
                    {headline}
                </Typography>

                <Group title="TCGplayer (USD)" isDark={isDark}>
                    <PriceRow
                        label="Market"
                        amount={snapshot.tcgMarket.amount}
                        currency="USD"
                        unpricedCopies={snapshot.tcgMarket.unpricedCopies}
                        isDark={isDark}
                    />
                    <PriceRow
                        label="Low"
                        amount={snapshot.tcgLow.amount}
                        currency="USD"
                        unpricedCopies={snapshot.tcgLow.unpricedCopies}
                        isDark={isDark}
                    />
                </Group>
                <Group title="CardMarket (EUR)" isDark={isDark}>
                    <PriceRow
                        label="Trend"
                        amount={snapshot.cmTrend.amount}
                        currency="EUR"
                        unpricedCopies={snapshot.cmTrend.unpricedCopies}
                        isDark={isDark}
                    />
                    <PriceRow
                        label="Low"
                        amount={snapshot.cmLow.amount}
                        currency="EUR"
                        unpricedCopies={snapshot.cmLow.unpricedCopies}
                        isDark={isDark}
                    />
                </Group>

                <Group title="Stock" isDark={isDark}>
                    <Typography sx={{ fontSize: '0.85rem', color: isDark ? '#f5f1ed' : '#2c1810' }}>
                        {snapshot.copies} copies · {snapshot.distinctPrintings} Printings
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: isDark ? '#f5f1ed' : '#2c1810' }}>
                        {snapshot.foilCopies} foil · {snapshot.regularCopies} Regular
                    </Typography>
                    {snapshot.tcgUnpricedCopies > 0 && (
                        <Typography
                            sx={{
                                fontSize: '0.8rem',
                                color: isDark ? 'rgba(212, 165, 116, 0.8)' : 'rgba(93, 58, 26, 0.7)',
                            }}
                        >
                            {snapshot.tcgUnpricedCopies} unpriced on TCGplayer
                        </Typography>
                    )}
                    {snapshot.cmUnpricedCopies > 0 && (
                        <Typography
                            sx={{
                                fontSize: '0.8rem',
                                color: isDark ? 'rgba(212, 165, 116, 0.8)' : 'rgba(93, 58, 26, 0.7)',
                            }}
                        >
                            {snapshot.cmUnpricedCopies} unpriced on CardMarket
                        </Typography>
                    )}
                </Group>

                {snapshot.topPrintings.length > 0 && (
                    <Group title="Top Printings" isDark={isDark}>
                        {snapshot.topPrintings.map((row) => (
                            <Box
                                key={row.printingId}
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 1,
                                    py: 0.5,
                                }}
                            >
                                <Box>
                                    <Typography
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: '0.85rem',
                                            color: isDark ? '#f5f1ed' : '#2c1810',
                                        }}
                                    >
                                        {row.name}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: '0.75rem',
                                            color: isDark
                                                ? 'rgba(212, 165, 116, 0.8)'
                                                : 'rgba(93, 58, 26, 0.7)',
                                        }}
                                    >
                                        {row.finish} · ×{row.quantity}
                                    </Typography>
                                </Box>
                                <Typography
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        fontVariantNumeric: 'tabular-nums',
                                        color: isDark ? '#f5f1ed' : '#2c1810',
                                    }}
                                >
                                    {formatCatalogPrice(row.contribution, 'USD')}
                                </Typography>
                            </Box>
                        ))}
                    </Group>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default BinderValueDialog;
