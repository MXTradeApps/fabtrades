import { Box, Typography } from '@mui/material';
import { tcgplayerAffiliateUrl } from '../../utils/tcgplayerAffiliate.js';
import tcgplayerMark from '../../assets/marketplaces/tcgplayer-mark.svg';

/**
 * Quiet affiliate buy link for set/card listings.
 * Opens the TCGplayer product page via the Impact partner redirect.
 */
const TcgplayerBuyLink = ({ productId, subTypeName }) => {
        const href = tcgplayerAffiliateUrl(productId, { subTypeName });

    if (!href) return null;

    const color = 'text.secondary';
    const hoverColor = 'primary.main';

    return (
        <Box
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label="Buy from TCGplayer"
            title="Buy from TCGplayer"
            onClick={(e) => e.stopPropagation()}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.35,
                flexShrink: 0,
                textDecoration: 'none',
                opacity: 0.85,
                color,
                transition: 'opacity 120ms ease, color 120ms ease',
                '&:hover': {
                    opacity: 1,
                    color: hoverColor
                },
                '&:focus-visible': {
                    outlineOffset: 2,
                    borderRadius: 0.5
                }
            }}
        >
            <Box
                component="img"
                src={tcgplayerMark}
                alt=""
                aria-hidden
                sx={{
                    height: 10,
                    width: 'auto',
                    display: 'block',
                    flexShrink: 0,
                    borderRadius: '1px',
                    opacity: 0.9
                }}
            />
            <Typography
                component="span"
                sx={{
                    fontSize: '0.625rem',
                    fontWeight: 500,
                    letterSpacing: '0.01em',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    color: 'inherit'
                }}
            >
                Buy from TCGplayer
            </Typography>
        </Box>
    );
};

export default TcgplayerBuyLink;
