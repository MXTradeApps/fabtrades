import { Box, ButtonBase, Typography } from '@mui/material';
import { CardThumbnail } from '../ui/CardImagePreview.jsx';
import Sparkline from './Sparkline.jsx';
import TcgplayerBuyLink from '../ui/TcgplayerBuyLink.jsx';
import {
    formatMoverAmount,
    formatMoverMoney,
    formatMoverPercent,
    sparklineValues,
} from '../../utils/moverFormat.js';

/**
 * One ranked Trending row: rank, art, full name (wraps, never truncates),
 * set · finish, "was → now", a TCGplayer affiliate buy link when the
 * printing has a product id, 7/30-day sparkline, and the change.
 *
 * The row renders as a div with role="button" (not a <button>) so the buy
 * link can sit inside it; the link stops propagation so it never opens details.
 */
const TrendRow = ({
    rank,
    name,
    setName,
    finish,
    imageUrl,
    fallbackUrl,
    startLow,
    latestLow,
    percentChange,
    amountChange,
    history,
    copies,
    productId,
    subTypeName,
    priceSource,
    onSelect,
}) => {
    const up = percentChange > 0;
    const color = up ? 'success.main' : 'error.main';
    const meta = [setName, finish, copies ? `${copies} ${copies === 1 ? 'copy' : 'copies'}` : null]
        .filter(Boolean)
        .join(' · ');

    return (
        <ButtonBase
            component="div"
            data-testid="trend-row"
            onClick={onSelect}
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '40px minmax(0, 1fr) auto',
                    sm: '18px 40px minmax(0, 1fr) 84px auto',
                },
                columnGap: 1.5,
                alignItems: 'center',
                width: '100%',
                px: { xs: 1.5, sm: 1.75 },
                py: 1.25,
                textAlign: 'left',
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
                transition: 'background-color 120ms ease',
                '&:hover': { bgcolor: 'action.hover' },
                '&.Mui-focusVisible': { bgcolor: 'action.focus' },
            }}
        >
            <Typography
                component="span"
                sx={{
                    display: { xs: 'none', sm: 'block' },
                    color: 'text.secondary',
                    fontSize: '0.78rem',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                {rank}
            </Typography>
            <CardThumbnail imageUrl={imageUrl} fallbackUrl={fallbackUrl} alt={name} size={40} />
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: 'text.primary', fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.3 }}>
                    {name}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem', lineHeight: 1.35 }}>
                    {meta}
                </Typography>
                <Typography
                    sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.25, fontVariantNumeric: 'tabular-nums' }}
                >
                    was {formatMoverMoney(startLow, priceSource)} →{' '}
                    <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
                        {formatMoverMoney(latestLow, priceSource)}
                    </Box>
                </Typography>
                <Box sx={{ display: 'flex', mt: 0.5 }}>
                    <TcgplayerBuyLink productId={productId} subTypeName={subTypeName} />
                </Box>
            </Box>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Sparkline values={sparklineValues(history, latestLow)} color={color} />
            </Box>
            <Box sx={{ textAlign: 'right', pl: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                <Typography sx={{ color, fontWeight: 800, fontSize: '1rem', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                    {formatMoverPercent(percentChange)}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {formatMoverAmount(amountChange, priceSource)}
                </Typography>
            </Box>
        </ButtonBase>
    );
};

export default TrendRow;
