import { useEffect, useState } from 'react';
import {
    Button,
    Menu,
    MenuItem,
    Avatar,
    Box,
    Typography,
    CircularProgress,
    Tooltip,
} from '@mui/material';
import {
    Logout as LogoutIcon,
    History as HistoryIcon,
    Login as LoginIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SignInDialog from './SignInDialog.jsx';

const LoginButton = ({ variant = 'compact' }) => {
    const navigate = useNavigate();
    const { user, loading, signOut, authError } = useAuth();
    const [anchorEl, setAnchorEl] = useState(null);
    const [signingOut, setSigningOut] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);
    const open = Boolean(anchorEl);
    const isSidebar = variant === 'sidebar';

    // After a failed OAuth redirect (common for misconfigured Apple), open the
    // dialog so the error is visible instead of a silent unsigned-in landing.
    useEffect(() => {
        if (authError && !user) setSignInOpen(true);
    }, [authError, user]);

    const handleClick = (event) => {
        if (!user) {
            setSignInOpen(true);
        } else {
            setAnchorEl(event.currentTarget);
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSignOut = async () => {
        setSigningOut(true);
        handleClose();
        await signOut();
        setSigningOut(false);
    };

    const handleViewHistory = () => {
        handleClose();
        navigate('/history');
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, height: 36 }}>
                <CircularProgress size={20} sx={{ color: 'text.secondary' }} />
            </Box>
        );
    }

    const avatarUrl = user?.user_metadata?.avatar_url;
    const displayName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email?.split('@')[0] ||
        'User';

    return (
        <>
            {user ? (
                <Tooltip title="Account">
                    <Button
                        onClick={handleClick}
                        size="small"
                        color="inherit"
                        sx={{
                            color: 'text.primary',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            gap: 1,
                            minHeight: 36,
                            minWidth: 0,
                            px: isSidebar ? 0.75 : 0.5,
                            flex: isSidebar ? 1 : 'none',
                            overflow: 'hidden',
                        }}
                        disabled={signingOut}
                    >
                        <Avatar
                            src={avatarUrl}
                            alt={displayName}
                            sx={{
                                width: 28,
                                height: 28,
                                fontSize: '0.8rem',
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                            }}
                        >
                            {displayName.charAt(0).toUpperCase()}
                        </Avatar>
                        {isSidebar && (
                            <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.8125rem', minWidth: 0 }}>
                                {displayName}
                            </Typography>
                        )}
                    </Button>
                </Tooltip>
            ) : (
                <Tooltip title="Sign in to sync binder and trade history">
                    <Button
                        onClick={handleClick}
                        size="small"
                        variant={isSidebar ? 'contained' : 'outlined'}
                        color={isSidebar ? 'primary' : 'inherit'}
                        startIcon={<LoginIcon sx={{ fontSize: '1rem !important' }} />}
                        sx={{
                            minHeight: 36,
                            flex: isSidebar ? 1 : 'none',
                            px: 1.5,
                            ...(isSidebar ? {} : { color: 'text.primary' }),
                        }}
                    >
                        Sign in
                    </Button>
                </Tooltip>
            )}

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                PaperProps={{
                    sx: { mt: 1, minWidth: 190 },
                }}
            >
                <MenuItem
                    onClick={handleViewHistory}
                    sx={{ gap: 1.5 }}
                >
                    <HistoryIcon fontSize="small" />
                    <Typography fontSize="inherit">View History</Typography>
                </MenuItem>
                <MenuItem
                    onClick={handleSignOut}
                    sx={{ gap: 1.5, color: 'error.main' }}
                >
                    <LogoutIcon fontSize="small" />
                    <Typography fontSize="inherit">Sign Out</Typography>
                </MenuItem>
            </Menu>

            <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
        </>
    );
};

export default LoginButton;
