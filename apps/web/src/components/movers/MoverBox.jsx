import { Box, ButtonBase, Typography } from '@mui/material';
import { CardThumbnail } from '../ui/CardImagePreview.jsx';
import TcgplayerBuyLink from '../ui/TcgplayerBuyLink.jsx';
import { formatMoverAmount, formatMoverMoney, formatMoverPercent } from '../../utils/moverFormat.js';

const unpricedLabel = '—';

/**
 * Shared trend box for ranked movers and Trends search results.
 * Omit [percentChange] / [amountChange] to leave the change line off.
 * Unpriced current Low is an em dash, never $0.00 / €0.00.
 * Pass [productId] to show the TCGplayer affiliate buy link; the box is a
 * div with role="button" so the link can sit inside it.
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
    productId,
    subTypeName,
    onSelect,
    priceSource,
}) => {
    const showChange = percentChange != null
        && amountChange != null
        && percentChange !== 0;
    const changeColor = percentChange > 0 ? 'success.main' : 'error.main';
    const amountLabel = showChange ? formatMoverAmount(amountChange, priceSource) : null;
    const priced = currentLow != null && currentLow !== 0;
    const meta = [setName, finish, copies != null ? `${copies} copies` : null]
        .filter(Boolean)
        .join(' · ');

    return (
        <ButtonBase
            component="div"
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
                borderRadius: '12px',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                transition: 'border-color 120ms ease, background-color 120ms ease',
                '&:hover': {
                    borderColor: 'text.disabled',
                    bgcolor: 'action.hover',
                },
                '&.Mui-focusVisible': {
                    borderColor: 'primary.main',
                },
            }}
        >
            <CardThumbnail imageUrl={imageUrl} fallbackUrl={fallbackUrl} alt={name} size={40} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                    sx={{
                        color: 'text.primary',
                        fontWeight: 600,
                        fontSize: '0.875rem',
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
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {meta}
                </Typography>
                <Box sx={{ display: 'flex', mt: 0.25 }}>
                    <TcgplayerBuyLink productId={productId} subTypeName={subTypeName} />
                </Box>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 0.5 }}>
                <Typography sx={{ color: 'text.primary', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
                    {priced ? formatMoverMoney(currentLow, priceSource) : unpricedLabel}
                </Typography>
                {showChange ? (
                    <Typography variant="body2" sx={{ color: changeColor, fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {`${formatMoverPercent(percentChange)} · ${amountLabel}`}
                    </Typography>
                ) : null}
            </Box>
        </ButtonBase>
    );
};

export default MoverBox;
