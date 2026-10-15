import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { createTheme, alpha } from '@mui/material/styles';
import { brand, fonts, tokens } from '../theme/tokens.js';

const ThemeContext = createContext();

export const useThemeMode = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useThemeMode must be used within a ThemeModeProvider');
    }
    return context;
};

const buildTheme = (mode) => {
    const t = tokens[mode];
    const isDark = mode === 'dark';

    // Soft, low-contrast elevation. MUI wants 25 entries; anything past the
    // first few maps to the large overlay shadow.
    const shadows = ['none', t.shadowSm, t.shadowSm, t.shadowMd, t.shadowMd, t.shadowMd];
    while (shadows.length < 25) shadows.push(t.shadowLg);

    const focusRing = `0 0 0 3px ${alpha(t.accent, isDark ? 0.35 : 0.22)}`;

    return createTheme({
        tokens: t,
        palette: {
            mode,
            primary: {
                main: t.accent,
                light: isDark ? '#E7A174' : brand.brownBright,
                dark: isDark ? '#B86A35' : brand.brownDeep,
                contrastText: t.onAccent,
            },
            secondary: {
                main: t.tan,
                light: brand.tanBright,
                dark: brand.tanDeep,
                contrastText: brand.espressoDeep,
            },
            success: { main: t.gain, contrastText: isDark ? '#0E1A13' : '#FFFFFF' },
            error: { main: t.loss, contrastText: '#FFFFFF' },
            warning: { main: t.warn, contrastText: isDark ? '#1A1206' : '#FFFFFF' },
            info: { main: t.info, contrastText: '#FFFFFF' },
            background: {
                default: t.bg,
                paper: t.surface,
            },
            surface: {
                main: t.surface,
                sunken: t.sunken,
                hover: t.hover,
            },
            text: {
                primary: t.text,
                secondary: t.textMuted,
                disabled: t.textFaint,
            },
            divider: t.border,
            action: {
                hover: t.hover,
                selected: t.selected,
                focus: alpha(t.accent, 0.16),
            },
        },
        typography: {
            fontFamily: fonts.body,
            fontSize: 14,
            h1: { fontFamily: fonts.display, fontWeight: 750, fontStretch: '112%', fontSize: '2.25rem', lineHeight: 1.1, letterSpacing: '-0.02em' },
            h2: { fontFamily: fonts.display, fontWeight: 750, fontStretch: '112%', fontSize: '1.75rem', lineHeight: 1.15, letterSpacing: '-0.015em' },
            h3: { fontFamily: fonts.display, fontWeight: 700, fontStretch: '110%', fontSize: '1.375rem', lineHeight: 1.2, letterSpacing: '-0.01em' },
            h4: { fontFamily: fonts.display, fontWeight: 700, fontStretch: '108%', fontSize: '1.25rem', lineHeight: 1.25, letterSpacing: '-0.01em' },
            h5: { fontFamily: fonts.display, fontWeight: 700, fontStretch: '106%', fontSize: '1.0625rem', lineHeight: 1.3 },
            h6: { fontFamily: fonts.display, fontWeight: 650, fontSize: '0.9375rem', lineHeight: 1.35 },
            subtitle1: { fontWeight: 600, fontSize: '0.9375rem' },
            subtitle2: { fontWeight: 600, fontSize: '0.8125rem' },
            body1: { fontSize: '0.9375rem', lineHeight: 1.55 },
            body2: { fontSize: '0.84375rem', lineHeight: 1.5 },
            caption: { fontSize: '0.75rem', lineHeight: 1.4 },
            overline: { fontSize: '0.6875rem', fontWeight: 650, letterSpacing: '0.08em', lineHeight: 1.6 },
            button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
        },
        shape: {
            borderRadius: 10,
        },
        shadows,
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        backgroundColor: t.bg,
                        color: t.text,
                        fontFeatureSettings: '"ss01" on',
                    },
                },
            },
            MuiPaper: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: { backgroundImage: 'none' },
                    rounded: { borderRadius: 14 },
                    outlined: { borderColor: t.border },
                },
            },
            MuiCard: {
                defaultProps: { variant: 'outlined' },
                styleOverrides: {
                    root: { borderRadius: 14, borderColor: t.border, boxShadow: t.shadowSm },
                },
            },
            MuiButtonBase: {
                defaultProps: { disableRipple: false },
            },
            MuiButton: {
                defaultProps: { disableElevation: true },
                styleOverrides: {
                    root: {
                        borderRadius: 10,
                        fontWeight: 600,
                        transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease',
                        '&.Mui-focusVisible': { boxShadow: focusRing },
                    },
                    sizeSmall: { minHeight: 32, padding: '4px 12px', fontSize: '0.8125rem' },
                    sizeMedium: { minHeight: 40, padding: '8px 16px' },
                    sizeLarge: { minHeight: 48, padding: '10px 22px', fontSize: '0.9375rem' },
                    containedPrimary: {
                        '&:hover': { backgroundColor: t.accentHover },
                    },
                    outlined: {
                        borderColor: t.borderStrong,
                        '&:hover': { borderColor: t.textFaint, backgroundColor: t.hover },
                    },
                    outlinedPrimary: {
                        borderColor: alpha(t.accent, 0.45),
                        '&:hover': { borderColor: t.accent, backgroundColor: t.accentSoft },
                    },
                    text: {
                        '&:hover': { backgroundColor: t.hover },
                    },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 10,
                        '&.Mui-focusVisible': { boxShadow: focusRing },
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        fontWeight: 600,
                        borderRadius: 8,
                        fontVariantNumeric: 'tabular-nums',
                    },
                    filled: {
                        '&.MuiChip-colorPrimary': { backgroundColor: t.accentSoft, color: t.accentText },
                        '&.MuiChip-colorSuccess': { backgroundColor: alpha(t.gain, isDark ? 0.16 : 0.12), color: t.gain },
                        '&.MuiChip-colorError': { backgroundColor: alpha(t.loss, isDark ? 0.16 : 0.12), color: t.loss },
                        '&.MuiChip-colorWarning': { backgroundColor: alpha(t.warn, isDark ? 0.16 : 0.12), color: t.warn },
                        '&.MuiChip-colorInfo': { backgroundColor: alpha(t.info, isDark ? 0.16 : 0.12), color: t.info },
                        '&.MuiChip-colorSecondary': { backgroundColor: alpha(t.tan, isDark ? 0.16 : 0.14), color: isDark ? t.tan : brand.brownDeep },
                    },
                    outlined: {
                        borderColor: t.borderStrong,
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: 10,
                        backgroundColor: t.sunken,
                        transition: 'box-shadow 120ms ease, background-color 120ms ease',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: t.borderStrong },
                        '&.Mui-focused': { backgroundColor: t.surface, boxShadow: focusRing },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: t.accent, borderWidth: 1 },
                        '&.Mui-disabled': { opacity: 0.6 },
                    },
                },
            },
            // Labels sit above the filled input instead of notching its border.
            MuiTextField: {
                defaultProps: { InputLabelProps: { shrink: true } },
                styleOverrides: {
                    root: {
                        '&:has(> .MuiInputLabel-root)': { marginTop: '26px !important' },
                        '& .MuiOutlinedInput-notchedOutline legend': { maxWidth: '0 !important' },
                    },
                },
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: { color: t.textMuted },
                    shrink: {
                        '&.MuiInputLabel-outlined': {
                            transform: 'translate(2px, -22px) scale(0.86)',
                            fontWeight: 600,
                            color: t.textMuted,
                        },
                        '&.Mui-focused': { color: t.text },
                    },
                },
            },
            MuiAutocomplete: {
                styleOverrides: {
                    paper: {
                        borderRadius: 14,
                        border: `1px solid ${t.border}`,
                        boxShadow: t.shadowLg,
                        marginTop: 6,
                    },
                    listbox: { padding: 6 },
                    option: {
                        borderRadius: 8,
                        '&.Mui-focused': { backgroundColor: `${t.hover} !important` },
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        borderRadius: 20,
                        border: `1px solid ${t.border}`,
                        boxShadow: t.shadowLg,
                    },
                },
            },
            MuiBackdrop: {
                styleOverrides: {
                    root: {
                        '&:not(.MuiBackdrop-invisible)': {
                            backgroundColor: t.overlay,
                            backdropFilter: 'blur(4px)',
                        },
                    },
                },
            },
            MuiDialogTitle: {
                styleOverrides: {
                    root: {
                        fontFamily: fonts.display,
                        fontWeight: 700,
                        fontStretch: '108%',
                        fontSize: '1.25rem',
                        letterSpacing: '-0.01em',
                        padding: '20px 24px 8px',
                    },
                },
            },
            MuiDialogActions: {
                styleOverrides: {
                    root: { padding: '12px 24px 20px', gap: 8 },
                },
            },
            MuiTooltip: {
                defaultProps: { arrow: false, enterDelay: 300 },
                styleOverrides: {
                    tooltip: {
                        backgroundColor: isDark ? '#F3EDE7' : '#1E1612',
                        color: isDark ? '#1E1612' : '#F6F3EF',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        borderRadius: 8,
                        padding: '6px 10px',
                    },
                },
            },
            MuiPopover: {
                styleOverrides: {
                    paper: {
                        borderRadius: 14,
                        border: `1px solid ${t.border}`,
                        boxShadow: t.shadowLg,
                    },
                },
            },
            MuiMenu: {
                styleOverrides: {
                    list: { padding: 6 },
                },
            },
            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        minHeight: 38,
                        fontSize: '0.875rem',
                    },
                },
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 10,
                        '&.Mui-selected': { backgroundColor: t.selected },
                        '&.Mui-selected:hover': { backgroundColor: t.selected },
                    },
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: { borderRadius: 12, alignItems: 'center' },
                    standard: { border: `1px solid ${t.border}` },
                },
            },
            MuiSnackbar: {
                styleOverrides: {
                    // Keep toasts above the mobile tab bar.
                    anchorOriginBottomCenter: {
                        '@media (max-width: 899.95px)': {
                            bottom: 'calc(var(--shell-bottom) + 12px)',
                        },
                    },
                },
            },
            MuiSnackbarContent: {
                styleOverrides: {
                    root: { borderRadius: 12 },
                },
            },
            MuiTabs: {
                styleOverrides: {
                    root: { minHeight: 44 },
                    indicator: { height: 2, borderRadius: 2 },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 600,
                        minHeight: 44,
                        fontSize: '0.875rem',
                    },
                },
            },
            MuiToggleButtonGroup: {
                styleOverrides: {
                    root: {
                        backgroundColor: t.sunken,
                        borderRadius: 10,
                        padding: 3,
                        gap: 2,
                    },
                    grouped: {
                        border: 0,
                        borderRadius: '8px !important',
                        margin: 0,
                    },
                },
            },
            MuiToggleButton: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 600,
                        border: 0,
                        color: t.textMuted,
                        '&.Mui-selected': {
                            backgroundColor: t.surface,
                            color: t.text,
                            boxShadow: t.shadowSm,
                        },
                        '&.Mui-selected:hover': { backgroundColor: t.surface },
                    },
                },
            },
            MuiDivider: {
                styleOverrides: {
                    root: { borderColor: t.border },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: { borderColor: t.border },
                    head: { color: t.textMuted, fontWeight: 600, fontSize: '0.75rem' },
                },
            },
            MuiLinearProgress: {
                styleOverrides: {
                    root: { borderRadius: 4 },
                },
            },
            MuiSkeleton: {
                styleOverrides: {
                    root: { backgroundColor: t.hover },
                },
            },
            MuiAvatar: {
                styleOverrides: {
                    root: { fontWeight: 600 },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: { backgroundImage: 'none', borderColor: t.border },
                },
            },
            MuiSwitch: {
                styleOverrides: {
                    track: { borderRadius: 10 },
                },
            },
        },
    });
};

const lightTheme = buildTheme('light');
const darkTheme = buildTheme('dark');

const readSavedMode = () => {
    try {
        return localStorage.getItem('fabtrades-theme-mode');
    } catch {
        return null;
    }
};

export const ThemeModeProvider = ({ children }) => {
    // Saved preference wins; default to dark.
    const [mode, setMode] = useState(() => readSavedMode() || 'dark');

    useEffect(() => {
        try {
            localStorage.setItem('fabtrades-theme-mode', mode);
        } catch {
            // Storage blocked (private mode); the toggle still works for this visit.
        }
    }, [mode]);

    // Mirror the mode and tokens onto <html> so plain CSS (index.css,
    // scrollbars, selection) follows the same palette as MUI.
    useLayoutEffect(() => {
        const root = document.documentElement;
        root.dataset.theme = mode;
        root.style.colorScheme = mode;
        Object.entries(tokens[mode]).forEach(([name, value]) => {
            root.style.setProperty(`--c-${name}`, value);
        });
    }, [mode]);

    const toggleMode = () => {
        setMode(prevMode => prevMode === 'light' ? 'dark' : 'light');
    };

    const theme = useMemo(() => {
        return mode === 'dark' ? darkTheme : lightTheme;
    }, [mode]);

    const value = {
        mode,
        setMode,
        toggleMode,
        theme,
        isDark: mode === 'dark'
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
