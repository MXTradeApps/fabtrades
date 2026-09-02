import { Box, ButtonBase, Typography } from '@mui/material';
import { CardThumbnail } from '../ui/CardImagePreview.jsx';
import { formatCurrency } from '../../utils/helpers.js';

export const formatMoverMoney = (amount, priceSource) => {
    if (priceSource === 'cardmarket') {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amount);
    }
    return formatCurrency(amount);
};

export const formatMoverPercent = (ratio) => {
    const pct = ratio * 100;
    const digits = Math.abs(pct) >= 10 ? 0 : 1;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(digits)}%`;
};

const unpricedLabel = '—';

/**
 * Shared trend box for ranked movers and Trends search results.
 * Omit [percentChange] / [amountChange] to leave the change line off.
 * Unpriced current Low is an em dash, never $0.00 / €0.00.
 */
const MoverBox = ({
    name,
    setName,
    finish,
    imageUrl,
    fallbackUrl,
    currentLow,
    percentChange,
    amountChange,
    copies,
    onSelect,
    isDark,
    textColor,
    mutedColor,
    priceSource,
}) => {
    const showChange = percentChange != null
        && amountChange != null
        && percentChange !== 0;
    const changeColor = percentChange > 0 ? '#2E7D32' : '#C62828';
    const amountLabel = showChange
        ? `${amountChange >= 0 ? '+' : '−'}${formatMoverMoney(Math.abs(amountChange), priceSource)}`
        : null;
    const priced = currentLow != null && currentLow !== 0;
    const meta = [setName, finish, copies != null ? `${copies} copies` : null]
        .filter(Boolean)
        .join(' · ');

    return (
        <ButtonBase
            data-testid="mover-box"
            onClick={onSelect}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.25,
                py: 1,
                minWidth: 0,
                textAlign: 'left',
                borderRadius: 1.5,
                border: isDark
                    ? '1px solid rgba(200, 113, 55, 0.22)'
                    : '1px solid rgba(139, 69, 19, 0.14)',
                backgroundColor: isDark ? 'rgba(44, 24, 16, 0.55)' : '#ffffff',
                boxShadow: isDark
                    ? '0 1px 3px rgba(0, 0, 0, 0.25)'
                    : '0 1px 3px rgba(44, 24, 16, 0.06)',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                '&:hover': {
                    borderColor: isDark ? 'rgba(212, 165, 116, 0.5)' : 'rgba(139, 69, 19, 0.35)',
                    boxShadow: isDark
                        ? '0 4px 12px rgba(0, 0, 0, 0.35)'
                        : '0 4px 12px rgba(44, 24, 16, 0.1)',
                    transform: 'translateY(-1px)',
                },
            }}
        >
            <CardThumbnail imageUrl={imageUrl} fallbackUrl={fallbackUrl} alt={name} size={40} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                    sx={{
                        color: textColor,
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {name}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        color: mutedColor,
                        fontSize: '0.75rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {meta}
                </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 0.5 }}>
                <Typography sx={{ color: textColor, fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }}>
                    {priced ? formatMoverMoney(currentLow, priceSource) : unpricedLabel}
                </Typography>
                {showChange ? (
                    <Typography variant="body2" sx={{ color: changeColor, fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {`${formatMoverPercent(percentChange)} · ${amountLabel}`}
                    </Typography>
                ) : null}
            </Box>
        </ButtonBase>
    );
};

export const moverBoxGridSx = {
    display: 'grid',
    gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, minmax(0, 1fr))',
        md: 'repeat(3, minmax(0, 1fr))',
        lg: 'repeat(4, minmax(0, 1fr))',
    },
    gap: 1.25,
};

export default MoverBox;
