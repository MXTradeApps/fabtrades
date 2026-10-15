import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Typography,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { usePriceType } from '../../contexts/PriceContext.jsx';
import { useCardDetail } from '../../contexts/CardDetailContext.jsx';
import { useCardData } from '../../hooks/useCardData.jsx';
import { recentMovers } from '../../services/fabDb.js';
import { splitMoversByDirection } from '../../utils/recentMovers.js';
import MoverBox from './MoverBox.jsx';
import { moverBoxGridSx } from './moverBoxStyles.js';

const sourceLabel = (priceSource) =>
    priceSource === 'cardmarket' ? 'CardMarket' : 'TCGplayer';

const artForRow = (row, cardIdLookup) => {
    const printing = cardIdLookup?.[row.card_id];
    return {
        imageUrl: printing?.imageUrl || row.image_url || '',
        fallbackUrl: printing?.imageUrlFallback || row.image_url || '',
    };
};

/**
 * Trends-only catalog-wide recent movers. Does not import or render the set catalog.
 */
const RecentMoversSection = () => {
    const { priceSource } = usePriceType();
    const { openDetail } = useCardDetail();
    const { cardIdLookup } = useCardData();

    const [catalogRows, setCatalogRows] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [catalogError, setCatalogError] = useState(null);

    const textColor = 'text.primary';
    const mutedColor = 'text.secondary';
    const upColor = 'success.main';
    const downColor = 'error.main';

    useEffect(() => {
        let cancelled = false;
        setCatalogRows([]);
        setCatalogLoading(true);
        setCatalogError(null);
        recentMovers(priceSource)
            .then((rows) => {
                if (cancelled) return;
                setCatalogRows(Array.isArray(rows) ? rows : []);
            })
            .catch((error) => {
                if (cancelled) return;
                setCatalogError(error);
            })
            .finally(() => {
                if (!cancelled) setCatalogLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [priceSource]);

    const openRow = (row) => {
        const printing = cardIdLookup?.[row.card_id];
        if (printing) openDetail(printing);
    };

    const label = sourceLabel(priceSource);
    const chrome = {
        textColor,
        mutedColor,
        upColor,
        downColor,
        priceSource,
        cardIdLookup,
        onSelect: openRow,
    };

    return (
        <Box>
            <MoversBlock
                heading="Catalog-wide recent movers"
                rows={catalogRows}
                loading={catalogLoading}
                error={catalogError}
                sourceLabel={label}
                {...chrome}
                onRetry={() => {
                    setCatalogLoading(true);
                    setCatalogError(null);
                    recentMovers(priceSource)
                        .then((rows) => setCatalogRows(Array.isArray(rows) ? rows : []))
                        .catch(setCatalogError)
                        .finally(() => setCatalogLoading(false));
                }}
            />
            <Typography variant="caption" sx={{ color: mutedColor, display: 'block', mt: 1 }}>
                Observed catalog Lows, not a sale. Values follow {label}.
            </Typography>
        </Box>
    );
};

const MoversBlock = ({
    heading,
    rows,
    loading,
    error,
    sourceLabel: label,
    textColor,
    mutedColor,
    upColor,
    downColor,
    priceSource,
    cardIdLookup,
    onRetry,
    onSelect,
}) => {
    const { gainers, losers } = splitMoversByDirection(rows);

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="overline" component="h2" sx={{ color: mutedColor, display: 'block', mb: 1.5 }}>
                {heading}
            </Typography>
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={28} />
                </Box>
            ) : error ? (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="body2" sx={{ color: textColor, mb: 1 }}>
                        Couldn’t load recent movers from {label}.
                    </Typography>
                    <Button onClick={onRetry}>Retry</Button>
                </Box>
            ) : (
                <>
                    <DirectionList
                        kind="gainer"
                        title="Gainers"
                        description="Biggest recent Low increases"
                        Icon={TrendingUpIcon}
                        rows={gainers}
                        color={upColor}
                        emptyCopy={`No recent gainers on ${label}.`}
                        priceSource={priceSource}
                        cardIdLookup={cardIdLookup}
                        onSelect={onSelect}
                    />
                    <DirectionList
                        kind="loser"
                        title="Losers"
                        description="Biggest recent Low decreases"
                        Icon={TrendingDownIcon}
                        rows={losers}
                        color={downColor}
                        emptyCopy={`No recent losers on ${label}.`}
                        priceSource={priceSource}
                        cardIdLookup={cardIdLookup}
                        onSelect={onSelect}
                    />
                </>
            )}
        </Box>
    );
};

const DirectionList = ({
    kind,
    title,
    description,
    Icon,
    rows,
    color,
    emptyCopy,
    textColor,
    mutedColor,
    priceSource,
    cardIdLookup,
    onSelect,
}) => (
    <Box sx={{ mb: 4 }}>
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                columnGap: 1,
                rowGap: 0.5,
                mb: 1.5,
            }}
        >
            <Box
                sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    display: 'grid',
                    placeItems: 'center',
                    color,
                    bgcolor: kind === 'gainer' ? 'rgba(70, 194, 133, 0.14)' : 'rgba(240, 106, 98, 0.14)',
                }}
            >
                <Icon sx={{ fontSize: 18 }} />
            </Box>
            <Typography variant="h4" component="h3" sx={{ color: textColor }}>
                {title}
            </Typography>
            <Typography
                variant="body2"
                component="span"
                sx={{ color: mutedColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
                ({rows.length})
            </Typography>
            <Typography variant="body2" sx={{ color: mutedColor, width: { xs: '100%', sm: 'auto' } }}>
                {description}
            </Typography>
        </Box>
        {rows.length === 0 ? (
            <Typography variant="body2" sx={{ color: mutedColor, py: 1 }}>
                {emptyCopy}
            </Typography>
        ) : (
            <Box
                data-testid={`movers-grid-${kind}`}
                sx={moverBoxGridSx}
            >
                {rows.map((row) => {
                    const { imageUrl, fallbackUrl } = artForRow(row, cardIdLookup);
                    return (
                        <MoverBox
                            key={`${row.direction}-${row.card_id}`}
                            name={row.name}
                            setName={row.set_name}
                            finish={row.finish}
                            imageUrl={imageUrl}
                            fallbackUrl={fallbackUrl}
                            currentLow={row.latest_low}
                            percentChange={row.percent_change}
                            amountChange={row.amount_change}
                            onSelect={() => onSelect(row)}
                            priceSource={priceSource}
                        />
                    );
                })}
            </Box>
        )}
    </Box>
);

export default RecentMoversSection;
