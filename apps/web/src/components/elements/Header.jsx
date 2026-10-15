import { useState } from 'react';
import {
    Box, Typography, IconButton, Drawer, List, ListItemButton, ListItemIcon,
    ListItemText, Tooltip, ButtonBase,
} from '@mui/material';
import {
    DarkModeOutlined,
    LightModeOutlined,
    SwapHorizRounded,
    CollectionsBookmarkOutlined,
    HistoryRounded,
    BookmarkBorderRounded,
    TrendingUpRounded,
    StyleOutlined,
    PrivacyTipOutlined,
    DescriptionOutlined,
    SupportAgentOutlined,
    MoreHorizRounded,
    Apple,
    Android,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { formatTimestamp } from "../../utils/helpers.js";
import { useThemeMode } from "../../contexts/ThemeContext.jsx";
import { shell } from "../../theme/tokens.js";
import LoginButton from '../auth/LoginButton.jsx';

// Grouped the way people think about the app: the trade at the table, the
// cards they own or want, and the market.
const NAV_SECTIONS = [
    {
        label: 'Trade',
        items: [
            { label: 'Trade Calculator', short: 'Trade', to: '/', icon: SwapHorizRounded, match: (path) => path === '/' },
            { label: 'Trade History', short: 'History', to: '/history', icon: HistoryRounded, match: (path) => path === '/history' },
        ],
    },
    {
        label: 'Collection',
        items: [
            { label: 'My Binders', short: 'Binders', to: '/binder', icon: CollectionsBookmarkOutlined, match: (path) => path.startsWith('/binder') },
            { label: 'Want List', short: 'Wants', to: '/wants', icon: BookmarkBorderRounded, match: (path) => path === '/wants' },
        ],
    },
    {
        label: 'Market',
        items: [
            { label: 'Trends', short: 'Trends', to: '/trends', icon: TrendingUpRounded, match: (path) => path === '/trends' },
            { label: 'Browse Sets', short: 'Sets', to: '/sets', icon: StyleOutlined, match: (path) => path.startsWith('/sets') },
        ],
    },
];

const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
const navItem = (to) => NAV_ITEMS.find((item) => item.to === to);

// The four destinations people hit most on a phone; everything else is under More.
const BOTTOM_NAV = ['/', '/binder', '/wants', '/sets'].map(navItem);

const LEGAL_ITEMS = [
    { label: 'Support', to: '/support', icon: SupportAgentOutlined, match: (path) => path === '/support' },
    { label: 'Privacy Policy', to: '/privacy', icon: PrivacyTipOutlined, match: (path) => path === '/privacy' },
    { label: 'Terms of Use', to: '/terms', icon: DescriptionOutlined, match: (path) => path === '/terms' },
];

const APP_LINKS = [
    {
        label: 'iOS App',
        href: 'https://apps.apple.com/us/app/fabtrades/id6794308687',
        icon: Apple,
    },
    {
        label: 'Android App',
        href: 'https://play.google.com/store/apps/details?id=fabtrades.myapp',
        icon: Android,
    },
];

const Brand = ({ size = 30 }) => (
    <Box
        component={Link}
        to="/"
        sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            minWidth: 0,
            textDecoration: 'none',
            color: 'text.primary',
            borderRadius: 2,
        }}
    >
        <Box
            component="img"
            src="/app_icon.png"
            alt=""
            sx={{ width: size, height: size, borderRadius: '9px', flexShrink: 0 }}
        />
        <Typography
            component="span"
            sx={{
                fontFamily: (t) => t.typography.h1.fontFamily,
                fontWeight: 800,
                fontStretch: '115%',
                fontSize: '1.0625rem',
                letterSpacing: '-0.01em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
            }}
        >
            FAB Trades
        </Typography>
    </Box>
);

const PriceStamp = ({ lastUpdatedTimestamp, sx }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, ...sx }}>
        <Box
            aria-hidden
            sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                flexShrink: 0,
                bgcolor: lastUpdatedTimestamp ? 'success.main' : 'text.disabled',
                boxShadow: (t) => lastUpdatedTimestamp ? `0 0 0 3px ${t.palette.mode === 'dark' ? 'rgba(70,194,133,0.18)' : 'rgba(29,138,85,0.14)'}` : 'none',
            }}
        />
        <Typography
            sx={{
                fontSize: '0.72rem',
                color: 'text.secondary',
                lineHeight: 1.3,
                minWidth: 0,
            }}
        >
            Prices updated {lastUpdatedTimestamp ? formatTimestamp(lastUpdatedTimestamp) : '…'}
        </Typography>
    </Box>
);

const ThemeToggle = () => {
    const { isDark, toggleMode } = useThemeMode();
    return (
        <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
                onClick={toggleMode}
                size="small"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                sx={{ color: 'text.secondary', width: 36, height: 36 }}
            >
                {isDark ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
            </IconButton>
        </Tooltip>
    );
};

const SidebarLink = ({ item, active, dense = false, onClick }) => {
    const { label, to, icon: Icon } = item;
    return (
        <ListItemButton
            component={Link}
            to={to}
            selected={active}
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            sx={{
                minHeight: dense ? 34 : 40,
                px: 1.25,
                py: 0,
                mb: 0.25,
                color: active ? 'text.primary' : 'text.secondary',
                '&:hover': { color: 'text.primary' },
                '&.Mui-selected': { bgcolor: 'action.selected' },
            }}
        >
            <ListItemIcon sx={{ minWidth: 32, color: active ? 'primary.main' : 'inherit' }}>
                <Icon sx={{ fontSize: dense ? '1.05rem' : '1.2rem' }} />
            </ListItemIcon>
            <ListItemText
                primary={label}
                primaryTypographyProps={{
                    fontSize: dense ? '0.8125rem' : '0.875rem',
                    fontWeight: active ? 650 : 500,
                    noWrap: true,
                }}
            />
        </ListItemButton>
    );
};

const SectionLabel = ({ children }) => (
    <Typography
        variant="overline"
        component="div"
        sx={{ color: 'text.disabled', px: 1.25, pt: 2, pb: 0.5, lineHeight: 1.4 }}
    >
        {children}
    </Typography>
);

const AppLinks = ({ onClick }) => (
    <Box sx={{ display: 'flex', gap: 1 }}>
        {APP_LINKS.map(({ label, href, icon: Icon }) => (
            <ButtonBase
                key={href}
                component="a"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                onClick={onClick}
                sx={{
                    flex: 1,
                    gap: 0.75,
                    height: 34,
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    '&:hover': { color: 'text.primary', borderColor: 'text.disabled' },
                }}
            >
                <Icon sx={{ fontSize: '1rem' }} />
                {label.replace(' App', '')}
            </ButtonBase>
        ))}
    </Box>
);

const Sidebar = ({ lastUpdatedTimestamp, pathname }) => (
    <Box
        component="aside"
        sx={{
            display: { xs: 'none', md: 'flex' },
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: shell.sidebarWidth,
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
            zIndex: (t) => t.zIndex.appBar,
        }}
    >
        <Box sx={{ px: 2.25, pt: 2.5, pb: 1 }}>
            <Brand />
        </Box>

        <Box component="nav" aria-label="Main" sx={{ flex: 1, overflowY: 'auto', px: 1.25 }}>
            {NAV_SECTIONS.map((section) => (
                <Box key={section.label}>
                    <SectionLabel>{section.label}</SectionLabel>
                    <List disablePadding>
                        {section.items.map((item) => (
                            <SidebarLink key={item.to} item={item} active={item.match(pathname)} />
                        ))}
                    </List>
                </Box>
            ))}
            <SectionLabel>Help</SectionLabel>
            <List disablePadding>
                {LEGAL_ITEMS.map((item) => (
                    <SidebarLink key={item.to} item={item} active={item.match(pathname)} dense />
                ))}
            </List>
        </Box>

        <Box sx={{ px: 2, pt: 1.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <AppLinks />
            <PriceStamp lastUpdatedTimestamp={lastUpdatedTimestamp} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
                <LoginButton variant="sidebar" />
                <ThemeToggle />
            </Box>
        </Box>
    </Box>
);

const MobileTopBar = () => (
    <Box
        component="header"
        sx={{
            display: { xs: 'flex', md: 'none' },
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: `calc(${shell.topBarHeight}px + env(safe-area-inset-top, 0px))`,
            pt: 'env(safe-area-inset-top, 0px)',
            px: 2,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(19,17,16,0.86)' : 'rgba(246,243,239,0.88)',
            backdropFilter: 'saturate(160%) blur(14px)',
            borderBottom: 1,
            borderColor: 'divider',
            zIndex: (t) => t.zIndex.appBar,
        }}
    >
        <Brand size={28} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ThemeToggle />
            <LoginButton variant="compact" />
        </Box>
    </Box>
);

const BottomTab = ({ label, icon: Icon, active, ...rest }) => (
    <ButtonBase
        aria-current={active ? 'page' : undefined}
        sx={{
            flex: 1,
            flexDirection: 'column',
            gap: 0.35,
            height: shell.bottomNavHeight,
            color: active ? 'text.primary' : 'text.secondary',
            fontSize: '0.6875rem',
            fontWeight: active ? 650 : 500,
            borderRadius: 2,
        }}
        {...rest}
    >
        <Box
            sx={{
                width: 52,
                height: 28,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                bgcolor: active ? 'action.selected' : 'transparent',
                color: active ? 'primary.main' : 'inherit',
                transition: 'background-color 160ms ease',
            }}
        >
            <Icon sx={{ fontSize: '1.3rem' }} />
        </Box>
        {label}
    </ButtonBase>
);

const MobileBottomNav = ({ pathname, onMore, moreActive }) => (
    <Box
        component="nav"
        aria-label="Main"
        sx={{
            display: { xs: 'flex', md: 'none' },
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            px: 0.5,
            pb: 'env(safe-area-inset-bottom, 0px)',
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(27,24,22,0.92)' : 'rgba(255,255,255,0.92)',
            backdropFilter: 'saturate(160%) blur(14px)',
            borderTop: 1,
            borderColor: 'divider',
            zIndex: (t) => t.zIndex.appBar,
        }}
    >
        {BOTTOM_NAV.map((item) => (
            <BottomTab
                key={item.to}
                component={Link}
                to={item.to}
                label={item.short}
                icon={item.icon}
                active={item.match(pathname)}
            />
        ))}
        <BottomTab label="More" icon={MoreHorizRounded} active={moreActive} onClick={onMore} />
    </Box>
);

const MoreSheet = ({ open, onClose, pathname, lastUpdatedTimestamp }) => {
    const items = [...NAV_ITEMS.filter((item) => !BOTTOM_NAV.includes(item)), ...LEGAL_ITEMS];
    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    pb: 'env(safe-area-inset-bottom, 0px)',
                    maxHeight: '85vh',
                },
            }}
        >
            <Box sx={{ px: 2, pt: 1, pb: 2.5 }}>
                <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mb: 1.5 }} />
                <List disablePadding>
                    {items.map((item) => (
                        <SidebarLink key={item.to} item={item} active={item.match(pathname)} onClick={onClose} />
                    ))}
                </List>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <AppLinks onClick={onClose} />
                    <PriceStamp lastUpdatedTimestamp={lastUpdatedTimestamp} sx={{ px: 0.5 }} />
                </Box>
            </Box>
        </Drawer>
    );
};

const Header = ({ lastUpdatedTimestamp }) => {
    const { pathname } = useLocation();
    const [moreOpen, setMoreOpen] = useState(false);
    const moreActive = [...NAV_ITEMS.filter((item) => !BOTTOM_NAV.includes(item)), ...LEGAL_ITEMS]
        .some((item) => item.match(pathname));

    return (
        <>
            <Sidebar lastUpdatedTimestamp={lastUpdatedTimestamp} pathname={pathname} />
            <MobileTopBar />
            <MobileBottomNav pathname={pathname} moreActive={moreActive} onMore={() => setMoreOpen(true)} />
            <MoreSheet
                open={moreOpen}
                onClose={() => setMoreOpen(false)}
                pathname={pathname}
                lastUpdatedTimestamp={lastUpdatedTimestamp}
            />
        </>
    );
};

export default Header;
