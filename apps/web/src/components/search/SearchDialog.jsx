import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    IconButton,
    Typography,
    Box
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchInput from './SearchInput';

/**
 * SearchDialog Component
 * Full-screen search dialog for mobile devices
 */
const SearchDialog = ({
    open,
    onClose,
    title = 'Search',
    items = [],
    onSelect,
    keepOpenOnSelect = false,
    keepInputOnSelect = false
}) => {
    const [searchValue, setSearchValue] = useState('');

    // Reset search when dialog closes
    useEffect(() => {
        if (!open) {
            setSearchValue('');
        }
    }, [open]);

  const handleSelect = (item) => {
    onSelect?.(item);
    if (!keepInputOnSelect) {
      setSearchValue('');
    }
    if (!keepOpenOnSelect) {
      onClose();
    }
  };

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            PaperProps={{ sx: { borderRadius: 0, border: 0, bgcolor: 'background.default' } }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    pt: 'env(safe-area-inset-top, 0px)',
                    minHeight: 56,
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                }}
            >
                <IconButton
                    onClick={onClose}
                    aria-label="close"
                    sx={{ color: 'text.primary' }}
                >
                    <CloseIcon />
                </IconButton>
                <Typography variant="h5" component="h2" sx={{ flexGrow: 1, color: 'text.primary' }} noWrap>
                    {title}
                </Typography>
            </Box>

            <DialogContent sx={{ p: 2 }}>
                <SearchInput
                    label=""
                    placeholder="Search by card name…"
                    items={items}
                    value={searchValue}
                    onChange={(e, val) => setSearchValue(val)}
                    onSelect={handleSelect}
                    fullWidth
                    placement="bottom"
                    autoFocus
          keepOpenOnSelect={keepOpenOnSelect}
          keepInputOnSelect={keepInputOnSelect}
                />
                
                <Box sx={{ mt: 3, px: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Tap a result to add it. The list stays open so you can add several cards in a row.
                    </Typography>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default SearchDialog;
