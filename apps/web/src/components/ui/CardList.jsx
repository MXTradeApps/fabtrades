import React from 'react';
import {
    List,
    ListItem,
    IconButton,
    Chip,
    Select,
    MenuItem,
    FormControl,
    Box,
    Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import StyleIcon from '@mui/icons-material/Style';
import Tooltip from '@mui/material/Tooltip';
import { formatCurrency } from "../../utils/helpers.js";
import { getCardGradient } from "../../utils/searchUtils.js";
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

    const muted = isDark ? 'rgba(212, 165, 116, 0.7)' : 'rgba(93, 58, 26, 0.55)';
    const paperBorder = isDark ? 'rgba(200, 113, 55, 0.25)' : 'rgba(139, 69, 19, 0.15)';
    const textColor = isDark ? '#f5f1ed' : '#2c1810';

    const emptyState = cards.length === 0 && (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            py: { xs: 3, sm: 5 },
            px: 2,
            textAlign: 'center'
        }}>
            <StyleIcon sx={{
                fontSize: 36,
                color: isDark ? 'rgba(212, 165, 116, 0.35)' : 'rgba(139, 69, 19, 0.25)'
            }} />
            <Typography variant="body2" sx={{
                color: isDark ? 'rgba(212, 165, 116, 0.6)' : 'rgba(93, 58, 26, 0.55)',
                maxWidth: '28ch'
            }}>
                {disabled
                    ? 'Loading card prices…'
                    : 'Search above to add cards to this side of the trade'}
            </Typography>
        </Box>
    );

    const quantitySelect = (card, index, { compact = false } = {}) => (
        <FormControl
            size="small"
            sx={{
                minWidth: compact ? 48 : { xs: 50, sm: 55, md: 60, lg: 65, xl: 70 },
                flexShrink: 0,
                '& .MuiOutlinedInput-root': {
                    fontSize: compact
                        ? '0.7rem'
                        : { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                    height: compact ? 26 : { xs: 26, sm: 28, md: 30, lg: 32, xl: 34 }
                }
            }}
            onClick={(event) => event.stopPropagation()}
        >
            <Select
                value={card.quantity || 1}
                onChange={(e) => handleQuantityChange(index, e.target.value)}
                sx={{
                    fontSize: compact
                        ? '0.7rem'
                        : { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                    '& .MuiSelect-select': {
                        py: compact ? 0.25 : { xs: 0.25, sm: 0.5, md: 0.75, lg: 1, xl: 1.25 },
                        px: compact ? 0.75 : { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 }
                    }
                }}
            >
                {quantityOptions.map((qty) => (
                    <MenuItem key={qty} value={qty} sx={{ 
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' }
                    }}>
                        {qty}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );

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
                <List sx={{
                    width: '100%',
                    p: 0,
                    m: 0,
                    '& .MuiListItem-root': {
                        width: '100%',
                        maxWidth: '100%'
                    }
                }}>
                    {cards.map((card, index) => {
                        const gradient = getCardGradient(card.subTypeName, isDark);
                        const printing = resolvePrinting(card, cardIdLookup);
                        return (
                            <ListItem
                                key={`${card.uniqueId || card.name}-${index}`}
                                sx={{
                                    border: isDark 
                                        ? '1px solid rgba(200, 113, 55, 0.2)' 
                                        : '1px solid rgba(139, 69, 19, 0.15)',
                                    borderRadius: 2,
                                    mb: 1,
                                    background: gradient.background,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    p: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                                    position: 'relative',
                                    width: '100%',
                                    boxShadow: isDark 
                                        ? '0 2px 6px rgba(0, 0, 0, 0.2)' 
                                        : '0 2px 6px rgba(139, 69, 19, 0.08)',
                                    '&:hover': {
                                        borderColor: '#d4a574',
                                        boxShadow: isDark 
                                            ? '0 4px 12px rgba(212, 165, 116, 0.2)' 
                                            : '0 4px 12px rgba(139, 69, 19, 0.15)',
                                        transform: 'translateY(-1px)',
                                        background: gradient.backgroundHover,
                                    },
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '4px',
                                        height: '100%',
                                        background: 'linear-gradient(180deg, #8b4513 0%, #d4a574 100%)',
                                        borderTopLeftRadius: 8,
                                        borderBottomLeftRadius: 8,
                                        opacity: 0,
                                        transition: 'opacity 0.25s ease'
                                    },
                                    '&:hover::before': {
                                        opacity: 1
                                    }
                                }}
                            >
                                <CardThumbnail 
                                    imageUrl={card.imageUrl} 
                                    fallbackUrl={card.imageUrlFallback}
                                    alt={card.name}
                                    size={40}
                                    onClick={printing ? () => handleOpenDetail(card) : undefined}
                                />
                                
                                <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {quantitySelect(card, index)}

                                    <Typography
                                        component={printing ? 'button' : 'span'}
                                        type={printing ? 'button' : undefined}
                                        onClick={printing ? () => handleOpenDetail(card) : undefined}
                                        aria-label={printing ? `View details for ${card.name}` : undefined}
                                        variant="body2"
                                        sx={{
                                            fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.95rem', lg: '1rem', xl: '1.125rem' },
                                            fontWeight: 'medium',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: 1,
                                            minWidth: 0,
                                            border: 0,
                                            background: 'none',
                                            p: 0,
                                            m: 0,
                                            textAlign: 'left',
                                            color: 'inherit',
                                            fontFamily: 'inherit',
                                            cursor: printing ? 'pointer' : 'default',
                                            textDecoration: printing ? 'underline' : 'none',
                                            textDecorationColor: 'transparent',
                                            '&:hover': printing ? {
                                                textDecorationColor: 'currentColor',
                                            } : undefined,
                                        }}
                                    >
                                        {card.name}
                                    </Typography>
                                </Box>

                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    flexShrink: 0,
                                    minWidth: 'fit-content'
                                }}>
                                    <Box sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-end',
                                        gap: 0.15,
                                        minWidth: 'fit-content'
                                    }}>
                                        <Tooltip title={card.price ? '' : 'No market price available — not counted in totals'}>
                                            <Chip
                                                label={card.price ? formatPrice(card.price) : 'No price'}
                                                color={card.price ? 'primary' : 'default'}
                                                variant={card.price ? 'filled' : 'outlined'}
                                                size="small"
                                                sx={{
                                                    fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem', lg: '0.8rem', xl: '0.875rem' },
                                                    minWidth: 'fit-content'
                                                }}
                                            />
                                        </Tooltip>
                                        {card.lowPrice != null && Number(card.lowPrice) > 0 && (
                                            <Typography
                                                component="span"
                                                sx={{
                                                    fontSize: { xs: '0.55rem', sm: '0.6rem', md: '0.65rem' },
                                                    color: muted,
                                                    lineHeight: 1.1,
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                Low {formatPrice(card.lowPrice)}
                                            </Typography>
                                        )}
                                    </Box>

                                    <IconButton
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onRemoveCard(index);
                                        }}
                                        size="small"
                                        aria-label={`Delete ${card.name || 'card'}`}
                                        sx={{
                                            color: 'error.main',
                                            p: { xs: 0.25, sm: 0.5, md: 0.75, lg: 1, xl: 1.25 },
                                            '&:hover': {
                                                backgroundColor: 'rgba(244, 67, 54, 0.1)'
                                            }
                                        }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </ListItem>
                        );
                    })}
                </List>
            )}

            {isGrid && cards.length > 0 && (
                <Box
                    sx={{
                        display: 'grid',
                        // Wide enough for price + controls; capped so tiles don't balloon.
                        gridTemplateColumns: isLandscape
                            ? 'repeat(auto-fill, minmax(132px, 148px))'
                            : 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: isLandscape ? 0.85 : 1,
                        width: '100%',
                        pb: 0.5,
                        justifyContent: isLandscape ? 'start' : 'stretch',
                    }}
                >
                    {cards.map((card, index) => {
                        const gradient = getCardGradient(card.subTypeName, isDark);
                        const printing = resolvePrinting(card, cardIdLookup);
                        return (
                            <Box
                                key={`${card.uniqueId || card.name}-${index}`}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    border: `1px solid ${paperBorder}`,
                                    background: gradient.background,
                                    boxShadow: isDark
                                        ? '0 1px 4px rgba(0, 0, 0, 0.2)'
                                        : '0 1px 4px rgba(139, 69, 19, 0.08)',
                                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                                    '&:hover': {
                                        borderColor: '#d4a574',
                                        background: gradient.backgroundHover,
                                    },
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
                                        cursor: printing ? 'pointer' : 'default',
                                        backgroundColor: 'rgba(0, 0, 0, 0.15)',
                                        overflow: 'hidden',
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
                                            <Typography sx={{ color: muted, fontSize: '0.65rem', textAlign: 'center' }}>
                                                No image
                                            </Typography>
                                        </Box>
                                    )}
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            px: 0.5,
                                            py: 0.1,
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            color: '#fff',
                                            backgroundColor: 'rgba(0, 0, 0, 0.78)',
                                            borderBottomRightRadius: 4,
                                        }}
                                    >
                                        {card.quantity || 1}x
                                    </Box>
                                </Box>

                                <Box sx={{
                                    px: 0.7,
                                    py: 0.55,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.35,
                                }}>
                                    <Typography
                                        component={printing ? 'button' : 'span'}
                                        type={printing ? 'button' : undefined}
                                        onClick={printing ? () => handleOpenDetail(card) : undefined}
                                        aria-label={printing ? `View details for ${card.name}` : undefined}
                                        sx={{
                                            color: textColor,
                                            fontWeight: 600,
                                            fontSize: '0.72rem',
                                            lineHeight: 1.2,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            minHeight: '1.7em',
                                            border: 0,
                                            background: 'none',
                                            p: 0,
                                            m: 0,
                                            textAlign: 'left',
                                            fontFamily: 'inherit',
                                            cursor: printing ? 'pointer' : 'default',
                                            textDecoration: printing ? 'underline' : 'none',
                                            textDecorationColor: 'transparent',
                                            '&:hover': printing ? {
                                                textDecorationColor: 'currentColor',
                                            } : undefined,
                                        }}
                                        title={card.name}
                                    >
                                        {card.name}
                                    </Typography>

                                    <Typography
                                        sx={{
                                            color: isDark ? '#e4c09c' : '#8b4513',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            fontVariantNumeric: 'tabular-nums',
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {card.price ? formatPrice(card.price) : 'No price'}
                                    </Typography>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {quantitySelect(card, index, { compact: true })}
                                        <IconButton
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onRemoveCard(index);
                                            }}
                                            size="small"
                                            aria-label={`Delete ${card.name || 'card'}`}
                                            sx={{
                                                color: 'error.main',
                                                p: 0.25,
                                                ml: 'auto',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(244, 67, 54, 0.1)'
                                                }
                                            }}
                                        >
                                            <DeleteIcon sx={{ fontSize: '1rem' }} />
                                        </IconButton>
                                    </Box>
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
