import React, { useEffect, useRef } from 'react';
import { Paper, Box, Typography } from '@mui/material';
import SearchOption from './SearchOption';
import { tk } from '../../theme/tokens.js';

/**
 * SearchDropdown Component
 * Displays filtered search results in a dropdown
 */
const SearchDropdown = ({
    isOpen,
    items = [],
    highlightedIndex,
    searchTerm = '',
    onSelect,
    onHighlight,
    dropdownRef,
    placement = 'bottom',
    keepOpenOnSelect = false
}) => {
    const highlightedRef = useRef(null);

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightedRef.current) {
            highlightedRef.current.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }, [highlightedIndex]);

    if (!isOpen) return null;

    return (
        <Paper
            ref={dropdownRef}
            sx={{
                position: 'absolute',
                top: placement === 'bottom' ? 'calc(100% + 6px)' : 'auto',
                bottom: placement === 'top' ? 'calc(100% + 6px)' : 'auto',
                left: 0,
                right: 0,
                zIndex: 1300,
                maxHeight: '360px',
                overflowY: 'auto',
                p: 0.75,
                borderRadius: '14px',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                boxShadow: (t) => tk(t).shadowLg,
            }}
        >
            {items.length === 0 ? (
                <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                    <Typography 
                        variant="body2" 
                        sx={{ color: 'text.secondary' }}
                    >
                        {searchTerm ? 'No cards found' : 'Start typing to search...'}
                    </Typography>
                </Box>
            ) : (
                items.map((item, index) => (
                    <div
                        key={item.value || index}
                        ref={index === highlightedIndex ? highlightedRef : null}
                        onMouseDown={keepOpenOnSelect ? (event) => event.preventDefault() : undefined}
                    >
                        <SearchOption
                            option={item}
                            isHighlighted={index === highlightedIndex}
                            searchTerm={searchTerm}
                            onClick={() => onSelect(item)}
                            onMouseEnter={() => onHighlight(index)}
                        />
                    </div>
                ))
            )}
        </Paper>
    );
};

export default SearchDropdown;
