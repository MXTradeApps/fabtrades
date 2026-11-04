import { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    TextField,
    Typography,
} from '@mui/material';
import {
    Close as CloseIcon,
    Visibility,
    VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext.jsx';
import DiscordIcon from '../ui/DiscordIcon.jsx';

const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-2.9-11.3-7.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.5l.1.1 6.2 5.2C39.1 37.3 44 33 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
);

const AppleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.6.8-3.3 2-1.4 2.5-.4 6.1 1 8.1.7 1 1.5 2.1 2.6 2 1 0 1.4-.7 2.7-.7s1.6.7 2.7.7c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.2zm-2-6.1c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.7-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z" />
    </svg>
);

const PROVIDERS = [
    { id: 'apple', label: 'Apple', icon: <AppleIcon />, color: '#000000' },
    { id: 'google', label: 'Google', icon: <GoogleIcon />, color: '#ffffff', textColor: '#1f1f1f', border: true },
    { id: 'discord', label: 'Discord', icon: <DiscordIcon />, color: '#5865F2' },
];

/**
 * Multi-provider sign-in dialog mirroring mobile's SignInSheet:
 * Apple / Google / Discord OAuth plus optional email sign-in and sign-up.
 */
const SignInDialog = ({ open, onClose }) => {
    const {
        signInWithProvider,
        signInWithEmail,
        signUpWithEmail,
        authError,
        clearAuthError,
    } = useAuth();
    const { isDark } = useThemeMode();

    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [obscure, setObscure] = useState(true);

    useEffect(() => {
        if (open && authError) setError(authError);
    }, [open, authError]);

    const resetFeedback = () => {
        setError('');
        setInfo('');
        clearAuthError?.();
    };

    const handleClose = ({ force = false } = {}) => {
        if (busy && !force) return;
        setBusy(null);
        setShowEmailForm(false);
        setIsSignUp(false);
        setEmail('');
        setPassword('');
        resetFeedback();
        onClose?.();
    };

    const handleOAuth = async (provider) => {
        resetFeedback();
        setBusy(provider);
        const { error: oauthError } = await signInWithProvider(provider);
        if (oauthError) {
            setError(oauthError.message || `Couldn't sign in with ${provider}.`);
            setBusy(null);
            return;
        }
        // Redirect flow — dialog can close; session arrives after return.
        handleClose({ force: true });
    };

    const handleEmailSubmit = async (event) => {
        event.preventDefault();
        resetFeedback();
        setBusy('email');

        if (isSignUp) {
            const { data, error: signUpError } = await signUpWithEmail(email, password);
            setBusy(null);
            if (signUpError) {
                setError(signUpError.message || "Couldn't create account.");
                return;
            }
            // Confirmation required when there is no session yet.
            if (!data?.session) {
                setInfo(
                    'Check your email to confirm your account, then sign in here.',
                );
                setIsSignUp(false);
                return;
            }
            handleClose({ force: true });
            return;
        }

        const { error: signInError } = await signInWithEmail(email, password);
        setBusy(null);
        if (signInError) {
            setError(signInError.message || "Couldn't sign in.");
            return;
        }
        handleClose({ force: true });
    };

    return (
        <Dialog open={open} onClose={() => handleClose()} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ pr: 6, pt: 3 }}>
                <Box
                    component="img"
                    src="/app_icon.png"
                    alt=""
                    sx={{ width: 40, height: 40, borderRadius: '11px', display: 'block', mb: 1.5 }}
                />
                Sync your collection
                <IconButton
                    aria-label="close"
                    onClick={() => handleClose()}
                    disabled={Boolean(busy)}
                    sx={{ position: 'absolute', right: 12, top: 12, color: 'text.secondary' }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    Sign in to keep your binder, want list, and trade history on every
                    device you use.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {PROVIDERS.map((provider) => (
                        <Button
                            key={provider.id}
                            variant="outlined"
                            fullWidth
                            disabled={Boolean(busy)}
                            onClick={() => handleOAuth(provider.id)}
                            startIcon={
                                busy === provider.id ? (
                                    <CircularProgress size={18} color="inherit" />
                                ) : (
                                    provider.icon
                                )
                            }
                            sx={{
                                justifyContent: 'center',
                                minHeight: 46,
                                px: 2,
                                '& .MuiButton-startIcon': { position: 'absolute', left: 16 },
                                textTransform: 'none',
                                fontWeight: 600,
                                backgroundColor: provider.color,
                                color: provider.textColor || '#ffffff',
                                borderColor: provider.border
                                    ? (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)')
                                    : provider.color,
                                '&:hover': {
                                    backgroundColor: provider.color,
                                    filter: 'brightness(0.95)',
                                    borderColor: provider.border
                                        ? (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)')
                                        : provider.color,
                                },
                            }}
                        >
                            Continue with {provider.label}
                        </Button>
                    ))}
                </Box>

                <Button
                    fullWidth
                    sx={{ mt: 1.5, textTransform: 'none' }}
                    disabled={Boolean(busy)}
                    onClick={() => {
                        setShowEmailForm((v) => !v);
                        resetFeedback();
                    }}
                >
                    {showEmailForm ? 'Hide email sign-in' : 'Sign in with email'}
                </Button>

                {showEmailForm && (
                    <Box component="form" onSubmit={handleEmailSubmit} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            label="Email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={Boolean(busy)}
                            sx={{ mb: 1.25 }}
                        />
                        <TextField
                            fullWidth
                            label="Password"
                            type={obscure ? 'password' : 'text'}
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={Boolean(busy)}
                            sx={{ mb: 1.5 }}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            edge="end"
                                            onClick={() => setObscure((v) => !v)}
                                            aria-label={obscure ? 'Show password' : 'Hide password'}
                                        >
                                            {obscure ? <Visibility /> : <VisibilityOff />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            fullWidth
                            disabled={Boolean(busy)}
                            startIcon={
                                busy === 'email' ? (
                                    <CircularProgress size={18} color="inherit" />
                                ) : null
                            }
                        >
                            {isSignUp ? 'Create account' : 'Sign in'}
                        </Button>
                        <Button
                            fullWidth
                            sx={{ mt: 1, textTransform: 'none' }}
                            disabled={Boolean(busy)}
                            onClick={() => {
                                setIsSignUp((v) => !v);
                                resetFeedback();
                            }}
                        >
                            {isSignUp
                                ? 'Already have an account? Sign in'
                                : 'Need an account? Sign up'}
                        </Button>
                    </Box>
                )}

                {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
                {info && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                        {info}
                    </Alert>
                )}

                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 2, textAlign: 'center' }}
                >
                    We only ever read your name, email, and avatar.
                </Typography>
            </DialogContent>
        </Dialog>
    );
};

export default SignInDialog;
