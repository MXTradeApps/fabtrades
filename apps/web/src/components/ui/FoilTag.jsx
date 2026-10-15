import { Box, useTheme } from '@mui/material';
import { formatCardType } from '../../utils/searchUtils.js';
import { foilTagStyle } from '../../utils/foilStyle.js';

/**
 * Small foiling label ("Rainbow Foil", "Cold Foil"…). Renders nothing for
 * normal printings. Pass `label` to override the derived text.
 */
const FoilTag = ({ subTypeName, label, sx }) => {
    const isDark = useTheme().palette.mode === 'dark';
    const text = label ?? formatCardType(subTypeName);
    if (!text) return null;
    const style = foilTagStyle(subTypeName, isDark) || { bgcolor: 'action.hover', color: 'text.secondary' };
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 18,
                px: 0.75,
                borderRadius: '6px',
                fontSize: '0.65rem',
                fontWeight: 650,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                ...style,
                ...sx,
            }}
        >
            {text}
        </Box>
    );
};

export default FoilTag;
