import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { 
    Box, 
    Modal, 
    IconButton, 
    CircularProgress,
    Fade
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useThemeMode } from '../../contexts/ThemeContext.jsx';

/**
 * Small thumbnail component for card lists.
 * Cached Chrome loads often fire before React attaches onLoad; assign src after
 * listeners and never hide a decoded bitmap behind opacity 0.
 */
export const CardThumbnail = ({ imageUrl, fallbackUrl, alt, size = 40, onClick }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(imageUrl);
    const imgRef = useRef(null);
    const { isDark } = useThemeMode();

    useLayoutEffect(() => {
        setLoaded(false);
        setError(false);
        setCurrentSrc(imageUrl);
    }, [imageUrl]);

    useLayoutEffect(() => {
        const img = imgRef.current;
        if (!img || !currentSrc || error) return undefined;

        let cancelled = false;
        const markLoaded = () => {
            if (!cancelled) setLoaded(true);
        };
        const onImgError = () => {
            if (cancelled) return;
            if (fallbackUrl && currentSrc !== fallbackUrl) {
                setCurrentSrc(fallbackUrl);
            } else {
                setError(true);
            }
        };

        img.addEventListener('load', markLoaded);
        img.addEventListener('error', onImgError);
        img.src = currentSrc;

        if (img.complete && img.naturalWidth > 0) {
            markLoaded();
        } else if (typeof img.decode === 'function') {
            img.decode().then(markLoaded).catch(() => {});
        }

        return () => {
            cancelled = true;
            img.removeEventListener('load', markLoaded);
            img.removeEventListener('error', onImgError);
        };
    }, [currentSrc, error, fallbackUrl]);

    if (!currentSrc || error) {
        return (
            <Box
                onClick={onClick}
                sx={{
                    width: size,
                    height: size * 1.4,
                    borderRadius: '6px',
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: onClick ? 'pointer' : 'default',
                    border: 1,
                    borderColor: 'divider'
                }}
            >
                <Box
                    component="span"
                    sx={{
                        fontSize: '0.5rem',
                        color: 'text.disabled',
                        textAlign: 'center',
                        lineHeight: 1.1,
                        px: 0.25
                    }}
                >
                    No Image
                </Box>
            </Box>
        );
    }

    return (
        <Box
            onClick={onClick}
            sx={{
                width: size,
                height: size * 1.4,
                borderRadius: size >= 60 ? '8px' : '5px',
                overflow: 'hidden',
                flexShrink: 0,
                cursor: onClick ? 'pointer' : 'default',
                position: 'relative',
                bgcolor: 'action.hover',
                boxShadow: isDark
                    ? '0 0 0 1px rgba(255,255,255,0.06), 0 1px 3px rgba(0, 0, 0, 0.4)'
                    : '0 0 0 1px rgba(44,24,16,0.06), 0 1px 3px rgba(44, 24, 16, 0.12)',
                transition: 'transform 160ms ease',
                '&:hover': onClick ? {
                    transform: 'scale(1.04)',
                } : {}
            }}
        >
            {!loaded && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'action.hover'
                    }}
                >
                    <CircularProgress size={12} />
                </Box>
            )}
            <img
                ref={imgRef}
                alt={alt}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                }}
            />
        </Box>
    );
};

/**
 * Full-screen modal for viewing card image
 */
export const CardImageModal = ({ open, onClose, imageUrl, fallbackUrl, cardName }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(imageUrl);

    // Reset state when modal opens/closes or imageUrl changes
    useEffect(() => {
        if (open) {
            setLoaded(false);
            setError(false);
            setCurrentSrc(imageUrl);
        }
    }, [open, imageUrl]);

    const handleError = () => {
        if (fallbackUrl && currentSrc !== fallbackUrl) {
            setCurrentSrc(fallbackUrl);
        } else {
            setError(true);
        }
    };

    const handleClose = () => {
        onClose();
    };

    if (!imageUrl) return null;

    return (
        <Modal
            open={open}
            onClose={handleClose}
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <Fade in={open}>
                <Box
                    sx={{
                        position: 'relative',
                        outline: 'none'
                    }}
                >
                    {/* Close button */}
                    <IconButton
                        onClick={handleClose}
                        sx={{
                            position: 'absolute',
                            top: -40,
                            right: 0,
                            color: '#ffffff',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.7)'
                            },
                            zIndex: 1
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                    
                    {/* Card image container */}
                    <Box
                        sx={{
                            borderRadius: '4.5% / 3.2%',
                            overflow: 'hidden',
                            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
                            bgcolor: 'background.paper',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {!loaded && !error && (
                            <Box
                                sx={{
                                    width: 280,
                                    height: 392,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: 'surface.sunken'
                                }}
                            >
                                <CircularProgress size={40} />
                            </Box>
                        )}
                        {error && (
                            <Box
                                sx={{
                                    width: 280,
                                    height: 392,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: 'surface.sunken',
                                    color: 'text.secondary',
                                    textAlign: 'center',
                                    px: 3
                                }}
                            >
                                No Card Image Available
                            </Box>
                        )}
                        <img
                            src={currentSrc}
                            alt={cardName}
                            onLoad={() => setLoaded(true)}
                            onError={handleError}
                            style={{
                                maxWidth: '85vw',
                                maxHeight: '85vh',
                                display: loaded ? 'block' : 'none'
                            }}
                        />
                    </Box>
                </Box>
            </Fade>
        </Modal>
    );
};

export default { CardThumbnail, CardImageModal };

