import { Box, Link as MuiLink, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useSets } from '../../hooks/useSets.js';
import { homeSetGuides } from '../../utils/seoContent.js';

const linkSx = {
    color: 'text.secondary',
    fontSize: '0.84rem',
    fontWeight: 600,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    '&:hover': { color: 'text.primary', textDecoration: 'underline' },
};

/**
 * Links from the trade calculator to the newest set price guides, all sets and
 * Trending. The calculator fills the screen, so this sits below it: it is how
 * search engines (and anyone who scrolls) get from the home page to the price
 * guides. The same links are prerendered by scripts/generateSeoPages.js.
 */
const SetGuideLinks = () => {
    const { sets } = useSets();
    const guides = homeSetGuides(sets);

    return (
        <Box
            component="nav"
            aria-label="Card price guides"
            sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                columnGap: 2,
                rowGap: 0.75,
                px: { xs: 2, md: 2.5 },
                py: 2,
                borderTop: 1,
                borderColor: 'divider',
            }}
        >
            <Typography
                variant="overline"
                component="h2"
                sx={{ color: 'text.disabled', lineHeight: 1.4, m: 0 }}
            >
                Price guides
            </Typography>
            {guides.map((set) => (
                <MuiLink key={set.slug} component={Link} to={`/sets/${set.slug}`} sx={linkSx}>
                    {set.name}
                </MuiLink>
            ))}
            <MuiLink component={Link} to="/sets" sx={linkSx}>All sets</MuiLink>
            <MuiLink component={Link} to="/trends" sx={linkSx}>Trending cards</MuiLink>
        </Box>
    );
};

export default SetGuideLinks;
