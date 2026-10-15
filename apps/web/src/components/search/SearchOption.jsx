import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { highlightMatch, formatCardType } from '../../utils/searchUtils';
import FoilTag from '../ui/FoilTag.jsx';
import { usePriceType } from '../../contexts/PriceContext.jsx';
import { useCardDetail } from '../../contexts/CardDetailContext.jsx';
import { CardThumbnail } from '../ui/CardImagePreview.jsx';
import { resolvePrinting } from '../../utils/printingsForCard.js';

/**
 * SearchOption Component
 * Renders an individual search result option - full width, compact design
 */
const SearchOption = ({ 
    option, 
    isHighlighted = false,
    searchTerm = '',
    onClick,
    onMouseEnter
}) => {
    const { priceSource } = usePriceType();
    const { openDetail } = useCardDetail();
    const [isHovered, setIsHovered] = useState(false);
    const textSegments = highlightMatch(option.label, searchTerm);
    
    // Get the card type badge
    const cardType = formatCardType(option.subTypeName);
    
    // Get set name and image URL
    const setName = option.setName || option.card?._setName || '';
    const imageUrl = option.card?.imageUrl || '';
    const imageUrlFallback = option.card?.imageUrlFallback || '';
    
    // Market is primary; low is shown as a smaller secondary line.
    const marketPrice = option.card?.marketPrice || 0;
    const lowPrice = option.card?.lowPrice;
    
    // Format price based on price source
    const formatPrice = (amount) => {
        if (priceSource === 'cardmarket') {
            return new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }).format(amount);
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const primaryPrice = priceSource === 'cardmarket'
        ? (option.card?.cardmarketTrend || option.card?.cardmarketLow || 0)
        : marketPrice;
    const secondaryLow = priceSource === 'cardmarket'
        ? option.card?.cardmarketLow
        : lowPrice;

    const handleMouseEnter = () => {
        setIsHovered(true);
        onMouseEnter?.();
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const printing = resolvePrinting(option.card || option);
    const openPrinting = (event) => {
        event.stopPropagation();
        if (printing) openDetail(printing);
    };

    return (
        <Box
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            sx={{
                px: 1,
                py: 0.75,
                cursor: 'pointer',
                borderRadius: '10px',
                bgcolor: (isHighlighted || isHovered) ? 'action.hover' : 'transparent',
                transition: 'background-color 100ms ease',
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                width: '100%',
                boxSizing: 'border-box'
            }}
        >
            {/* Card thumbnail - smaller */}
            <CardThumbnail 
                imageUrl={imageUrl} 
                fallbackUrl={imageUrlFallback}
                alt={option.label} 
                size={30}
                onClick={printing ? openPrinting : undefined}
            />
            
            {/* Card info: name and set - takes remaining space */}
            <Box sx={{ 
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 0
            }}>
                {/* Card name */}
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.75,
                    minWidth: 0
                }}>
                    <Typography
                        component={printing ? 'button' : 'span'}
                        type={printing ? 'button' : undefined}
                        onClick={printing ? openPrinting : undefined}
                        aria-label={printing ? `View details for ${option.card?.name || option.label}` : undefined}
                        sx={{
                            fontSize: '0.84375rem',
                            fontWeight: 550,
                            color: 'text.primary',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.3,
                            border: 0,
                            background: 'none',
                            p: 0,
                            m: 0,
                            textAlign: 'left',
                            fontFamily: 'inherit',
                            cursor: printing ? 'pointer' : 'inherit',
                        }}
                    >
                        {textSegments.map((segment, index) => (
                            <span
                                key={index}
                                style={{
                                    fontWeight: segment.highlight ? 750 : 'inherit',
                                    textDecoration: segment.highlight ? 'underline' : 'none',
                                    textDecorationThickness: segment.highlight ? '1px' : undefined,
                                    textUnderlineOffset: segment.highlight ? '3px' : undefined,
                                }}
                            >
                                {segment.text}
                            </span>
                        ))}
                    </Typography>
                    
                    {/* Card Type Badge - inline, smaller */}
                    {cardType && (
                        <FoilTag subTypeName={option.subTypeName} label={cardType} sx={{ height: 16, fontSize: '0.6rem', px: 0.6 }} />
                    )}
                </Box>
                
                {/* Set name - smaller, subtle text */}
                {setName && (
                    <Typography
                        component="span"
                        sx={{
                            fontSize: '0.72rem',
                            fontWeight: 400,
                            color: 'text.secondary',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.2
                        }}
                    >
                        {setName}
                    </Typography>
                )}
            </Box>
            
            {/* Price is the remaining add control (row click also adds). */}
            <Box
                component="button"
                type="button"
                aria-label={`Add ${option.label}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onClick?.(event);
                }}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    flexShrink: 0,
                    gap: 0.1,
                    border: 0,
                    background: 'none',
                    p: 0,
                    m: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                }}
            >
                <Typography
                    component="span"
                    sx={{
                        fontSize: '0.84375rem',
                        fontWeight: 700,
                        color: 'text.primary',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.2
                    }}
                >
                    {formatPrice(primaryPrice)}
                </Typography>
                {secondaryLow != null && Number(secondaryLow) > 0 && (
                    <Typography
                        component="span"
                        sx={{
                            fontSize: '0.68rem',
                            fontWeight: 400,
                            color: 'text.secondary',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.1
                        }}
                    >
                        Low {formatPrice(secondaryLow)}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default SearchOption;
