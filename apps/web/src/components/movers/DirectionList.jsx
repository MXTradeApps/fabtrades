import { Box, Typography } from '@mui/material';
import TrendRow from './TrendRow.jsx';
import { artForRow, buyForRow, measureLabel } from './trendListUtils.js';

/**
 * One ranked list (Rising or Falling) of TrendRows. Pass [copies] (printing id
 * to owned count) to show "N copies" on each row and number rows by position,
 * as the Collection Stats page does for a single Binder.
 */
const DirectionList = ({
    kind,
    title,
    rows,
    total,
    hiddenOnPhone,
    emptyCopy,
    priceSource,
    cardIdLookup,
    onSelect,
    copies,
}) => (
    <Box
        data-testid={`movers-list-${kind}`}
        sx={{ display: { xs: hiddenOnPhone ? 'none' : 'block', md: 'block' }, minWidth: 0 }}
    >
        <Typography
            variant="caption"
            sx={{ display: { xs: 'block', md: 'none' }, color: 'text.secondary', mb: 1, fontVariantNumeric: 'tabular-nums' }}
        >
            {total === 1 ? '1 card' : `${total} cards`} · {measureLabel(kind, priceSource)}
        </Typography>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'baseline', gap: 1, mb: 1 }}>
            <Typography
                variant="h4"
                component="h2"
                sx={{ color: kind === 'gainer' ? 'success.main' : 'error.main' }}
            >
                {title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {total === 1 ? '1 card' : `${total} cards`} · {measureLabel(kind, priceSource)}
            </Typography>
        </Box>
        {rows.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
                {emptyCopy}
            </Typography>
        ) : (
            <Box
                sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: '12px',
                    bgcolor: 'background.paper',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {rows.map((row, index) => {
                    const { imageUrl, fallbackUrl } = artForRow(row, cardIdLookup);
                    return (
                        <TrendRow
                            key={`${row.direction}-${row.card_id}`}
                            rank={copies ? index + 1 : row.rank}
                            copies={copies ? copies[row.card_id] : undefined}
                            name={row.name}
                            setName={row.set_name}
                            finish={row.finish}
                            imageUrl={imageUrl}
                            fallbackUrl={fallbackUrl}
                            startLow={Number(row.start_price)}
                            latestLow={Number(row.latest_price)}
                            percentChange={Number(row.percent_change)}
                            amountChange={Number(row.amount_change)}
                            history={row.history}
                            {...buyForRow(row, cardIdLookup)}
                            priceSource={priceSource}
                            onSelect={() => onSelect(row)}
                        />
                    );
                })}
            </Box>
        )}
    </Box>
);

export default DirectionList;
