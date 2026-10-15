import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CardList from './CardList.jsx';
import { SearchInput, SearchDialog } from '../search';
import { tk } from "../../theme/tokens.js";

const CardPanel = ({ 
    title, 
    cards, 
    cardOptions, 
    inputValue, 
    onInputChange, 
    onAddCard, 
    onRemoveCard, 
    onUpdateQuantity,
    disabled = false,
    isLandscape = false,
    viewMode = 'list',
    tone,
}) => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [searchDialogOpen, setSearchDialogOpen] = useState(false);
    const cardCount = (cards || []).reduce((sum, card) => sum + (card.quantity || 1), 0);
    const toneColor = tone === 'want' ? 'success.main' : tone === 'have' ? 'primary.main' : null;

    return (
        <Paper 
            sx={{ 
                flex: 1,
                width: '100%',
                maxWidth: '100%',
                minHeight: isLandscape ? 0 : { xs: '240px', sm: '300px' },
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: isLandscape ? '16px' : 0,
                border: isLandscape ? 1 : 0,
                borderColor: 'divider',
                boxShadow: (t) => isLandscape ? tk(t).shadowSm : 'none',
                bgcolor: isLandscape ? 'background.paper' : 'transparent',
                overflow: 'hidden',
            }}
        >
            <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: 1.25,
                px: { xs: 2, sm: 2 },
                pt: isLandscape ? 2 : 1.75,
                pb: 1.5,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    {toneColor && (
                        <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: toneColor, flexShrink: 0 }} />
                    )}
                    <Typography 
                        variant="h5" 
                        component="h2"
                        sx={{ 
                            color: 'text.primary',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {title}
                    </Typography>
                    {cardCount > 0 && (
                        <Typography
                            component="span"
                            sx={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'text.secondary',
                                bgcolor: 'action.hover',
                                borderRadius: 999,
                                px: 0.9,
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {cardCount}
                        </Typography>
                    )}
                </Box>

                <Box sx={{ minWidth: 0 }}>
                    {isSmallScreen ? (
                        <Box
                            onClick={() => !disabled && setSearchDialogOpen(true)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    if (!disabled) setSearchDialogOpen(true);
                                }
                            }}
                            aria-label={`Search cards for ${title}`}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                minHeight: 42,
                                px: 1.5,
                                borderRadius: '10px',
                                bgcolor: 'surface.sunken',
                                cursor: disabled ? 'default' : 'pointer',
                                opacity: disabled ? 0.6 : 1,
                            }}
                        >
                            <SearchIcon sx={{ fontSize: '1.15rem', color: 'text.secondary' }} />
                            <Typography
                                variant="body2"
                                sx={{
                                    color: 'text.secondary',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Search cards to add…
                            </Typography>
                        </Box>
                    ) : (
                        <SearchInput
                            label=""
                            placeholder="Search cards to add…"
                            items={cardOptions || []}
                            value={inputValue || ''}
                            onChange={onInputChange}
                            onSelect={onAddCard}
                            disabled={disabled}
                            fullWidth
                            size="small"
                            placement="bottom"
                            keepOpenOnSelect
                            keepInputOnSelect
                        />
                    )}
                </Box>
            </Box>
            
            <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', px: 1, pb: 1 }}>
                <CardList
                    cards={cards}
                    onRemoveCard={onRemoveCard}
                    onUpdateQuantity={onUpdateQuantity}
                    disabled={disabled}
                    viewMode={viewMode}
                    isLandscape={isLandscape}
                />
            </Box>

            <SearchDialog
                open={searchDialogOpen}
                onClose={() => setSearchDialogOpen(false)}
                title={`Search Cards for ${title}`}
                items={cardOptions || []}
                onSelect={(card) => {
                    if (card) onAddCard(card);
                }}
                keepOpenOnSelect
                keepInputOnSelect
            />
        </Paper>
    );
};

export default CardPanel;
