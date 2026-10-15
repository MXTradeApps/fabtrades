import brandPalette from '../../../../packages/contracts/brand_palette.json';

// Design tokens for the web app. Brand hues come from the shared contract
// (packages/contracts/brand_palette.json) so web and mobile stay recognisably
// the same product; the neutrals here are web-only and carry a slight warm
// bias toward the brand brown instead of a flat grey.
//
// Layout concept: a quiet trading desk. Neutral surfaces, one copper accent,
// numbers set in tabular figures so prices line up down every list.
export const brand = brandPalette.tokens;

export const fonts = {
    display: '"Archivo", "Onest", system-ui, -apple-system, "Segoe UI", sans-serif',
    body: '"Onest", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export const tokens = {
    light: {
        bg: '#F6F3EF',
        surface: '#FFFFFF',
        sunken: '#F0EBE5',
        hover: 'rgba(44, 24, 16, 0.05)',
        selected: 'rgba(139, 69, 19, 0.09)',
        border: 'rgba(44, 24, 16, 0.10)',
        borderStrong: 'rgba(44, 24, 16, 0.18)',
        text: '#1E1612',
        textMuted: '#6A5A4E',
        textFaint: '#9A8C80',
        accent: brand.brown,
        accentHover: brand.brownDeep,
        accentSoft: 'rgba(139, 69, 19, 0.10)',
        accentText: brand.brown,
        onAccent: '#FFFFFF',
        tan: brand.tanDeep,
        gain: '#1D8A55',
        loss: '#C9372C',
        warn: '#B86E00',
        info: '#1F6FB2',
        overlay: 'rgba(30, 22, 18, 0.45)',
        shadowSm: '0 1px 2px rgba(30, 22, 18, 0.06), 0 1px 1px rgba(30, 22, 18, 0.03)',
        shadowMd: '0 4px 16px -4px rgba(30, 22, 18, 0.12), 0 2px 4px rgba(30, 22, 18, 0.04)',
        shadowLg: '0 24px 48px -12px rgba(30, 22, 18, 0.25), 0 4px 12px rgba(30, 22, 18, 0.06)',
    },
    dark: {
        bg: '#131110',
        surface: '#1B1816',
        sunken: '#24201C',
        hover: 'rgba(243, 237, 231, 0.06)',
        selected: 'rgba(216, 131, 74, 0.14)',
        border: 'rgba(243, 237, 231, 0.09)',
        borderStrong: 'rgba(243, 237, 231, 0.17)',
        text: '#F3EDE7',
        textMuted: '#B5A99E',
        textFaint: '#7F746B',
        accent: '#D8834A',
        accentHover: '#E7A174',
        accentSoft: 'rgba(216, 131, 74, 0.15)',
        accentText: '#E7A174',
        onAccent: brand.espressoDeep,
        tan: brand.tanBright,
        gain: '#46C285',
        loss: '#F06A62',
        warn: '#E8A23B',
        info: '#62AEEA',
        overlay: 'rgba(0, 0, 0, 0.6)',
        shadowSm: '0 1px 2px rgba(0, 0, 0, 0.35)',
        shadowMd: '0 8px 24px -8px rgba(0, 0, 0, 0.55), 0 2px 4px rgba(0, 0, 0, 0.3)',
        shadowLg: '0 28px 56px -12px rgba(0, 0, 0, 0.7), 0 4px 12px rgba(0, 0, 0, 0.35)',
    },
};

// Shell dimensions shared by the app chrome and full-height pages.
export const shell = {
    sidebarWidth: 248,
    topBarHeight: 56,
    bottomNavHeight: 64,
};

// Tokens for whichever theme is active. Falls back by palette mode so
// components still render under a bare MUI theme (tests use createTheme()).
export const tk = (theme) => theme?.tokens ?? tokens[theme?.palette?.mode] ?? tokens.light;
