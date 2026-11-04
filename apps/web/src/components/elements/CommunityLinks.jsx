import { Box, Link as MuiLink, Typography } from '@mui/material';
import { OpenInNewRounded } from '@mui/icons-material';
import DiscordIcon from '../ui/DiscordIcon.jsx';
import { DISCORD_INVITE_URL, FAB_TOOLS_URL, FABLOODLE_URL } from '../../utils/appLinks.js';

const DISCORD_BLURPLE = '#5865F2';

const external = { target: '_blank', rel: 'noopener noreferrer' };

const FamilyLink = ({ href, children }) => {
    if (!href) return <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{children}</Box>;
    return (
        <MuiLink
            href={href}
            {...external}
            underline="hover"
            sx={{ fontWeight: 600, color: 'primary.main', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
        >
            {children}
            <OpenInNewRounded aria-hidden sx={{ fontSize: '0.8em' }} />
        </MuiLink>
    );
};

// "Join our Discord" plus the FAB Tools family line. Lives at the foot of the
// desktop sidebar and in the phone More sheet, so it is on every page.
const CommunityLinks = ({ onClick, sx }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, ...sx }}>
        {DISCORD_INVITE_URL ? (
            <MuiLink
                href={DISCORD_INVITE_URL}
                {...external}
                underline="hover"
                onClick={onClick}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    fontSize: '0.875rem',
                    fontWeight: 650,
                    color: (t) => (t.palette.mode === 'dark' ? '#8891F7' : DISCORD_BLURPLE),
                    alignSelf: 'flex-start',
                }}
            >
                <DiscordIcon size={18} />
                Join our Discord
            </MuiLink>
        ) : null}
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.5 }}>
            Part of the FAB Tools family with{' '}
            <FamilyLink href={FAB_TOOLS_URL}>FAB Tools</FamilyLink> and{' '}
            <FamilyLink href={FABLOODLE_URL}>Fabloodle</FamilyLink>.
        </Typography>
    </Box>
);

export default CommunityLinks;
