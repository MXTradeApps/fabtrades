import { InputAdornment, IconButton } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';

/**
 * Trailing clear (x) for search/filter fields. Hidden when the field is empty.
 */
const SearchClearAdornment = ({
    value,
    onClear,
    disabled = false,
    color,
    dense = false,
    isDark = false,
}) => {
    if (!value || disabled) return null;

    return (
        <InputAdornment position="end">
            <IconButton
                type="button"
                size="small"
                onClick={onClear}
                edge="end"
                aria-label="clear search"
                sx={{
                    p: dense ? 0.35 : 0.5,
                    color,
                    '&:hover': {
                        backgroundColor: isDark
                            ? 'rgba(212, 165, 116, 0.12)'
                            : 'rgba(139, 69, 19, 0.08)',
                    },
                }}
            >
                <ClearIcon sx={{ fontSize: dense ? '0.95rem' : '1.1rem' }} />
            </IconButton>
        </InputAdornment>
    );
};

export default SearchClearAdornment;
