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
                    borderRadius: 1,
                    backgroundColor: isDark ? 'rgba(200, 113, 55, 0.15)' : 'rgba(139, 69, 19, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: onClick ? 'pointer' : 'default',
                    border: isDark ? '1px solid rgba(200, 113, 55, 0.2)' : '1px solid rgba(139, 69, 19, 0.15)'
                }}
            >
                <Box
                    component="span"
                    sx={{
                        fontSize: '0.5rem',
                        color: isDark ? 'rgba(212, 165, 116, 0.5)' : 'rgba(139, 69, 19, 0.4)',
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
                borderRadius: 1,
                overflow: 'hidden',
                flexShrink: 0,
                cursor: onClick ? 'pointer' : 'default',
                position: 'relative',
                boxShadow: isDark 
                    ? '0 2px 4px rgba(0, 0, 0, 0.3)' 
                    : '0 2px 4px rgba(44, 24, 16, 0.15)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': onClick ? {
                    transform: 'scale(1.05)',
                    boxShadow: isDark 
                        ? '0 4px 8px rgba(0, 0, 0, 0.5)' 
                        : '0 4px 8px rgba(44, 24, 16, 0.25)'
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
                        backgroundColor: isDark ? 'rgba(44, 24, 16, 0.5)' : 'rgba(245, 241, 237, 0.5)'
                    }}
                >
                    <CircularProgress size={12} sx={{ color: isDark ? '#c87137' : '#8b4513' }} />
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
    const { isDark } = useThemeMode();

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
                            borderRadius: 3,
                            overflow: 'hidden',
                            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
                            border: `3px solid ${isDark ? '#d4a574' : '#8b4513'}`,
                            backgroundColor: isDark ? '#2c1810' : '#ffffff',
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
                                    backgroundColor: isDark ? '#2c1810' : '#f5f1ed'
                                }}
                            >
                                <CircularProgress size={48} sx={{ color: isDark ? '#d4a574' : '#8b4513' }} />
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
                                    backgroundColor: isDark ? '#2c1810' : '#f5f1ed',
                                    color: isDark ? '#d4a574' : '#5d3a1a',
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

