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

const DiscordIcon = () => (
    <svg width="20" height="20" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" />
    </svg>
);

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
