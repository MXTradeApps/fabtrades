import { Box, Typography } from '@mui/material';
import { tk } from '../../theme/tokens.js';

// Standard page frame inside the app shell: consistent gutters, a readable
// max width, and room above the mobile tab bar.
export const Page = ({ children, maxWidth = 1280, sx, ...rest }) => (
    <Box
        component="main"
        sx={{
            width: '100%',
            maxWidth,
            mx: 'auto',
            px: { xs: 2, sm: 3, md: 4 },
            pt: { xs: 2.5, md: 4 },
            pb: { xs: 4, md: 6 },
            ...sx,
        }}
        {...rest}
    >
        {children}
    </Box>
);

// Page title block. `actions` sit to the right on wide screens and wrap below
// the title on phones.
export const PageHeader = ({ title, subtitle, eyebrow, actions, children, sx }) => (
    <Box
        sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 2,
            mb: { xs: 2.5, md: 3.5 },
            ...sx,
        }}
    >
        <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
            {eyebrow ? (
                <Box sx={{ mb: 1, color: 'text.secondary' }}>{eyebrow}</Box>
            ) : null}
            <Typography
                variant="h1"
                sx={{
                    fontSize: { xs: '1.75rem', md: '2.25rem' },
                    color: 'text.primary',
                    textWrap: 'balance',
                }}
            >
                {title}
            </Typography>
            {subtitle ? (
                <Typography
                    variant="body1"
                    component="div"
                    sx={{ color: 'text.secondary', mt: 0.75, maxWidth: '65ch' }}
                >
                    {subtitle}
                </Typography>
            ) : null}
            {children}
        </Box>
        {actions ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                {actions}
            </Box>
        ) : null}
    </Box>
);

// Small uppercase heading used to label groups of content within a page.
export const SectionTitle = ({ children, icon, count, aside, sx }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, minWidth: 0, ...sx }}>
        {icon ? <Box sx={{ display: 'flex', color: 'text.secondary' }}>{icon}</Box> : null}
        <Typography variant="h5" component="h2" sx={{ color: 'text.primary' }}>
            {children}
        </Typography>
        {count != null ? (
            <Typography
                component="span"
                sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    bgcolor: 'action.hover',
                    borderRadius: 999,
                    px: 0.9,
                    py: 0.1,
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                {count}
            </Typography>
        ) : null}
        {aside ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 0 }} noWrap>
                {aside}
            </Typography>
        ) : null}
    </Box>
);

// Rounded panel for grouping content. Use sparingly: lists and grids often
// read better without one.
export const Panel = ({ children, sx, ...rest }) => (
    <Box
        sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: '14px',
            boxShadow: (t) => tk(t).shadowSm,
            ...sx,
        }}
        {...rest}
    >
        {children}
    </Box>
);

// Centered empty / sign-in / error state.
export const EmptyState = ({ icon, title, children, actions, sx }) => (
    <Box
        sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 1,
            py: { xs: 5, md: 7 },
            px: 3,
            ...sx,
        }}
    >
        {icon ? (
            <Box
                sx={{
                    width: 52,
                    height: 52,
                    borderRadius: '14px',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'action.selected',
                    color: 'primary.main',
                    mb: 1,
                    '& svg': { fontSize: '1.6rem' },
                }}
            >
                {icon}
            </Box>
        ) : null}
        {title ? (
            <Typography variant="h4" component="h2" sx={{ color: 'text.primary' }}>
                {title}
            </Typography>
        ) : null}
        {children ? (
            <Typography variant="body2" component="div" sx={{ color: 'text.secondary', maxWidth: '46ch' }}>
                {children}
            </Typography>
        ) : null}
        {actions ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, mt: 2 }}>
                {actions}
            </Box>
        ) : null}
    </Box>
);
