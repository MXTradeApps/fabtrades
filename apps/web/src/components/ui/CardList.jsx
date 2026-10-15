import React from 'react';
import {
    List,
    ListItem,
    IconButton,
    Select,
    MenuItem,
    FormControl,
    Box,
    Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StyleIcon from '@mui/icons-material/Style';
import Tooltip from '@mui/material/Tooltip';
import { formatCurrency } from "../../utils/helpers.js";
import FoilTag from "./FoilTag.jsx";
import { usePriceType } from "../../contexts/PriceContext.jsx";
import { useThemeMode } from "../../contexts/ThemeContext.jsx";
import { CardThumbnail } from "./CardImagePreview.jsx";
import { useCardDetail } from "../../contexts/CardDetailContext.jsx";
import { useCardData } from "../../hooks/useCardData.jsx";
import { resolvePrinting } from "../../utils/printingsForCard.js";

const CardList = ({ 
    cards, 
    onRemoveCard, 
    onUpdateQuantity, 
    disabled = false,
    viewMode = 'list',
    isLandscape = false,
}) => {
    const { openDetail } = useCardDetail();
    const { cardIdLookup } = useCardData();
    const { priceSource } = usePriceType();
    const { isDark } = useThemeMode();
    const isGrid = viewMode === 'grid';

    // Format price based on source
    const formatPrice = (amount) => {
        if (priceSource === 'cardmarket') {
            return new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }).format(amount);
        }
        return formatCurrency(amount);
    };

    const handleOpenDetail = (card) => {
        const printing = resolvePrinting(card, cardIdLookup);
        if (printing) openDetail(printing);
    };

    const handleQuantityChange = (cardIndex, newQuantity) => {
        if (onUpdateQuantity) {
            onUpdateQuantity(cardIndex, newQuantity);
        }
    };

    // Generate quantity options (1-6)
    const quantityOptions = Array.from({ length: 6 }, (_, i) => i + 1);

    const emptyState = cards.length === 0 && (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.25,
            flexGrow: 1,
            py: { xs: 3, sm: 5 },
            px: 2,
            textAlign: 'center'
        }}>
            <Box sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'action.hover',
                color: 'text.disabled',
            }}>
                <StyleIcon sx={{ fontSize: 22 }} />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: '28ch' }}>
                {disabled
                    ? 'Loading card prices…'
                    : 'Search above to add cards to this side of the trade'}
            </Typography>
        </Box>
    );

    const quantitySelect = (card, index, { compact = false } = {}) => (
        <FormControl
            size="small"
            sx={{ flexShrink: 0 }}
            onClick={(event) => event.stopPropagation()}
        >
            <Select
                value={card.quantity || 1}
                onChange={(e) => handleQuantityChange(index, e.target.value)}
                inputProps={{ 'aria-label': `Quantity of ${card.name || 'card'}` }}
                renderValue={(qty) => `${qty}×`}
                sx={{
                    height: compact ? 26 : 30,
                    fontSize: '0.8125rem',
                    fontWeight: 650,
                    fontVariantNumeric: 'tabular-nums',
                    bgcolor: 'surface.sunken',
                    '& .MuiSelect-select': {
                        py: 0,
                        pl: compact ? 0.9 : 1.1,
                        pr: compact ? '22px !important' : '26px !important',
                    },
                    '& .MuiSelect-icon': { fontSize: '1.1rem', right: 2, color: 'text.secondary' },
                }}
            >
                {quantityOptions.map((qty) => (
                    <MenuItem key={qty} value={qty} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {qty}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );

    const removeButton = (card, index, size = 'small') => (
        <IconButton
            onClick={(event) => {
                event.stopPropagation();
                onRemoveCard(index);
            }}
            size="small"
            aria-label={`Delete ${card.name || 'card'}`}
            sx={{
                color: 'text.disabled',
                p: size === 'small' ? 0.5 : 0.75,
                '&:hover': { color: 'error.main', bgcolor: 'action.hover' },
            }}
        >
            <DeleteOutlineIcon sx={{ fontSize: size === 'small' ? '1.05rem' : '1.2rem' }} />
        </IconButton>
    );

    const nameButtonSx = (printing) => ({
        border: 0,
        background: 'none',
        p: 0,
        m: 0,
        textAlign: 'left',
        color: 'text.primary',
        fontFamily: 'inherit',
        cursor: printing ? 'pointer' : 'default',
        '&:hover': printing ? { color: 'primary.main' } : undefined,
    });

    return (
        <>
        <Box sx={{
            flexGrow: 1,
            overflow: 'auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
        }}>
            {emptyState}

            {!isGrid && cards.length > 0 && (
                <List sx={{ width: '100%', p: 0, m: 0 }}>
                    {cards.map((card, index) => {
                        const printing = resolvePrinting(card, cardIdLookup);
                        return (
                            <ListItem
                                key={`${card.uniqueId || card.name}-${index}`}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'auto minmax(0, 1fr) auto auto',
                                    alignItems: 'center',
                                    columnGap: 1.25,
                                    px: 1,
                                    py: 0.9,
                                    borderRadius: '10px',
                                    transition: 'background-color 120ms ease',
                                    '&:hover': { bgcolor: 'action.hover' },
                                    '& + &': { mt: 0.25 },
                                }}
                            >
                                <CardThumbnail
                                    imageUrl={card.imageUrl}
                                    fallbackUrl={card.imageUrlFallback}
                                    alt={card.name}
                                    size={36}
                                    onClick={printing ? () => handleOpenDetail(card) : undefined}
                                />

                                <Box sx={{ minWidth: 0 }}>
                                    <Typography
                                        component={printing ? 'button' : 'span'}
                                        type={printing ? 'button' : undefined}
                                        onClick={printing ? () => handleOpenDetail(card) : undefined}
                                        aria-label={printing ? `View details for ${card.name}` : undefined}
                                        variant="body2"
                                        sx={{
                                            ...nameButtonSx(printing),
                                            display: 'block',
                                            maxWidth: '100%',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {card.name}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.4, minWidth: 0 }}>
                                        {quantitySelect(card, index, { compact: true })}
                                        <FoilTag subTypeName={card.subTypeName} />
                                    </Box>
                                </Box>

                                <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    <Tooltip title={card.price ? '' : 'No market price available — not counted in totals'}>
                                        <Typography
                                            component="span"
                                            sx={{
                                                display: 'block',
                                                fontWeight: 700,
                                                fontSize: card.price ? '0.9375rem' : '0.75rem',
                                                color: card.price ? 'text.primary' : 'text.disabled',
                                                whiteSpace: 'nowrap',
                                                lineHeight: 1.3,
                                            }}
                                        >
                                            {card.price ? formatPrice(card.price) : 'No price'}
                                        </Typography>
                                    </Tooltip>
                                    {card.lowPrice != null && Number(card.lowPrice) > 0 && (
                                        <Typography
                                            component="span"
                                            sx={{
                                                display: 'block',
                                                fontSize: '0.6875rem',
                                                color: 'text.secondary',
                                                lineHeight: 1.3,
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            Low {formatPrice(card.lowPrice)}
                                        </Typography>
                                    )}
                                </Box>

                                {removeButton(card, index)}
                            </ListItem>
                        );
                    })}
                </List>
            )}

            {isGrid && cards.length > 0 && (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: isLandscape
                            ? 'repeat(auto-fill, minmax(128px, 1fr))'
                            : 'repeat(auto-fill, minmax(116px, 1fr))',
                        gap: 1.25,
                        width: '100%',
                        pb: 0.5,
                    }}
                >
                    {cards.map((card, index) => {
                        const printing = resolvePrinting(card, cardIdLookup);
                        return (
                            <Box
                                key={`${card.uniqueId || card.name}-${index}`}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.75,
                                    minWidth: 0,
                                }}
                            >
                                <Box
                                    component={printing ? 'button' : 'div'}
                                    type={printing ? 'button' : undefined}
                                    onClick={printing ? () => handleOpenDetail(card) : undefined}
                                    aria-label={printing ? `View details for ${card.name || 'card'}` : undefined}
                                    sx={{
                                        position: 'relative',
                                        width: '100%',
                                        aspectRatio: '5 / 7',
                                        p: 0,
                                        border: 0,
                                        borderRadius: '4.5% / 3.2%',
                                        cursor: printing ? 'pointer' : 'default',
                                        bgcolor: 'action.hover',
                                        overflow: 'hidden',
                                        boxShadow: isDark
                                            ? '0 0 0 1px rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.4)'
                                            : '0 0 0 1px rgba(44,24,16,0.06), 0 4px 12px rgba(44,24,16,0.12)',
                                        transition: 'transform 160ms ease',
                                        '&:hover': printing ? { transform: 'translateY(-2px)' } : undefined,
                                    }}
                                >
                                    {card.imageUrl || card.imageUrlFallback ? (
                                        <Box
                                            component="img"
                                            src={card.imageUrl || card.imageUrlFallback}
                                            alt={card.name || ''}
                                            loading="lazy"
                                            onError={(e) => {
                                                if (
                                                    card.imageUrlFallback
                                                    && e.currentTarget.src !== card.imageUrlFallback
                                                ) {
                                                    e.currentTarget.src = card.imageUrlFallback;
                                                }
                                            }}
                                            sx={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                objectPosition: 'top',
                                                display: 'block',
                                            }}
                                        />
                                    ) : (
                                        <Box
                                            sx={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                px: 0.5,
                                            }}
                                        >
                                            <Typography sx={{ color: 'text.disabled', fontSize: '0.65rem', textAlign: 'center' }}>
                                                No image
                                            </Typography>
                                        </Box>
                                    )}
                                    {(card.quantity || 1) > 1 && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                top: 6,
                                                left: 6,
                                                px: 0.75,
                                                height: 20,
                                                display: 'flex',
                                                alignItems: 'center',
                                                borderRadius: 999,
                                                fontSize: '0.6875rem',
                                                fontWeight: 750,
                                                fontVariantNumeric: 'tabular-nums',
                                                color: '#fff',
                                                bgcolor: 'rgba(0, 0, 0, 0.72)',
                                                backdropFilter: 'blur(4px)',
                                            }}
                                        >
                                            {card.quantity}×
                                        </Box>
                                    )}
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: 0.25 }}>
                                    <Typography
                                        component={printing ? 'button' : 'span'}
                                        type={printing ? 'button' : undefined}
                                        onClick={printing ? () => handleOpenDetail(card) : undefined}
                                        aria-label={printing ? `View details for ${card.name}` : undefined}
                                        sx={{
                                            ...nameButtonSx(printing),
                                            fontWeight: 600,
                                            fontSize: '0.75rem',
                                            lineHeight: 1.25,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            minHeight: '2.5em',
                                        }}
                                        title={card.name}
                                    >
                                        {card.name}
                                    </Typography>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                        <Typography
                                            sx={{
                                                color: card.price ? 'text.primary' : 'text.disabled',
                                                fontWeight: 700,
                                                fontSize: '0.8125rem',
                                                fontVariantNumeric: 'tabular-nums',
                                                lineHeight: 1.2,
                                                mr: 'auto',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {card.price ? formatPrice(card.price) : 'No price'}
                                        </Typography>
                                        {quantitySelect(card, index, { compact: true })}
                                        {removeButton(card, index)}
                                    </Box>
                                    <FoilTag subTypeName={card.subTypeName} sx={{ alignSelf: 'flex-start' }} />
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            )}

        </Box>
        </>
    );
};

export default CardList;
