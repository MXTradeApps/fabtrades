import { useMemo, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    MenuItem,
    Radio,
    Select,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    Check as CheckIcon,
    ChatBubbleOutline as ChatIcon,
    ContentCopy as ContentCopyIcon,
    DescriptionOutlined as TextIcon,
    FileDownloadOutlined as DownloadIcon,
    TableChartOutlined as TableIcon,
} from '@mui/icons-material';
import {
    EXPORT_FORMATS,
    EXPORT_SORTS,
    PRICE_SOURCES,
    buildCardListExport,
    buildExportItems,
    cardListExportFilename,
    downloadTextFile,
} from '../../utils/binderListExport.js';

const FORMAT_ICONS = { text: TextIcon, discord: ChatIcon, csv: TableIcon };

const sectionLabel = { fontWeight: 700, fontSize: '0.9rem', mb: 1 };

const FORMAT_STORAGE_KEY = 'fabtrades.binderExportFormat';
const DISCORD_LIMIT = 2000;

function readSavedFormat() {
    try {
        const saved = window.localStorage.getItem(FORMAT_STORAGE_KEY);
        return EXPORT_FORMATS.some((f) => f.id === saved) ? saved : 'text';
    } catch {
        return 'text';
    }
}

function saveFormat(format) {
    try {
        window.localStorage.setItem(FORMAT_STORAGE_KEY, format);
    } catch {
        // Storage can be blocked; the choice just isn't remembered.
    }
}

const cardCount = (list) => list.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
const cardsLabel = (n) => `${n} ${n === 1 ? 'card' : 'cards'}`;

/**
 * "Export card list" for a Binder: pick a format, sort, prices and
 * condition, preview it, then copy or download.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title Binder name (heading of text exports and the file name)
 * @param {Object[]} props.entries Binder entries
 * @param {Object[]|null} [props.filteredEntries] the entries the current search or
 *   filters show, when they hide some; exported by default
 * @param {string} [props.defaultSort] the Binder's current sort
 * @param {(entry: Object) => Object|null} props.resolveCard live catalog lookup
 * @param {(() => Promise<void>)|null} [props.onCopyBinder] shown as "Copy all N cards"
 *   when set (someone else's shared Binder)
 * @param {boolean} [props.copyNeedsSignIn] label the copy button "Sign in to copy"
 * @param {(message: string) => void} [props.onToast]
 */
export default function BinderExportDialog({
    open,
    onClose,
    title,
    entries,
    filteredEntries = null,
    defaultSort = 'nameAsc',
    resolveCard,
    onCopyBinder = null,
    copyNeedsSignIn = false,
    onToast = () => {},
}) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [format, setFormat] = useState(readSavedFormat);
    const [sort, setSort] = useState(
        EXPORT_SORTS.some((s) => s.id === defaultSort) ? defaultSort : 'nameAsc',
    );
    const [onlyFiltered, setOnlyFiltered] = useState(true);
    const [includePrices, setIncludePrices] = useState(true);
    const [priceSource, setPriceSource] = useState('market');
    const [includeCondition, setIncludeCondition] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copyingBinder, setCopyingBinder] = useState(false);

    const hasConditions = useMemo(
        () => entries.some((entry) => entry.condition && entry.condition !== 'NM'),
        [entries],
    );
    const source = filteredEntries && onlyFiltered ? filteredEntries : entries;
    const items = useMemo(
        () => buildExportItems({ entries: source, resolveCard, includeCondition: includeCondition && hasConditions }),
        [source, resolveCard, includeCondition, hasConditions],
    );
    const text = useMemo(
        () => buildCardListExport({
            items,
            title,
            format,
            sort,
            includePrices,
            priceSource,
            includeCondition: includeCondition && hasConditions,
        }),
        [items, title, format, sort, includePrices, priceSource, includeCondition, hasConditions],
    );
    const exportCount = cardCount(source);
    const overDiscordLimit = format === 'discord' && text.length > DISCORD_LIMIT;

    const change = (setter) => (value) => {
        setter(value);
        setCopied(false);
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            onToast(`Copied ${cardsLabel(exportCount)}`);
        } catch {
            onToast('Could not copy. Select the preview and copy it instead.');
        }
    };

    const download = () => {
        downloadTextFile(
            text,
            cardListExportFilename(title, format),
            format === 'csv' ? 'text/csv' : 'text/plain',
        );
        onToast(`Exported ${cardsLabel(exportCount)}`);
    };

    const copyBinder = async () => {
        setCopyingBinder(true);
        try {
            await onCopyBinder();
        } finally {
            setCopyingBinder(false);
        }
    };

    const formatPicker = (
        <Box sx={{ display: 'grid', gap: 1, mb: 2 }} role="radiogroup" aria-label="Export format">
            {EXPORT_FORMATS.map((opt) => {
                const Icon = FORMAT_ICONS[opt.id];
                const selected = format === opt.id;
                return (
                    <Box
                        key={opt.id}
                        component="label"
                        data-testid={`binder-export-format-${opt.id}`}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1,
                            py: 0.25,
                            borderRadius: 2,
                            border: 1,
                            borderColor: selected ? 'primary.main' : 'divider',
                            cursor: 'pointer',
                        }}
                    >
                        <Radio
                            size="small"
                            checked={selected}
                            onChange={() => {
                                change(setFormat)(opt.id);
                                saveFormat(opt.id);
                            }}
                            value={opt.id}
                            inputProps={{ 'aria-label': opt.label }}
                        />
                        <Icon fontSize="small" sx={{ color: 'text.secondary' }} />
                        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{opt.label}</Typography>
                        <Typography
                            sx={{ color: 'text.secondary', fontSize: '0.8rem', display: { xs: 'none', sm: 'block' } }}
                        >
                            {opt.description}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    );

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            fullScreen={fullScreen}
            data-testid="binder-export-dialog"
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DownloadIcon /> Export Card List
            </DialogTitle>
            <DialogContent>
                {onCopyBinder && (
                    <Box
                        sx={{
                            p: 1.5,
                            mb: 2,
                            borderRadius: 2,
                            border: 1,
                            borderColor: 'primary.main',
                            bgcolor: 'action.hover',
                        }}
                    >
                        <Typography sx={{ fontWeight: 700, mb: 0.25 }}>Make a personal copy</Typography>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 1.25 }}>
                            Adds a new private Binder with all of these cards to your collection. Nothing is
                            added to your Trade Binder.
                        </Typography>
                        <Button
                            fullWidth
                            variant="contained"
                            data-testid="binder-export-copy-binder"
                            startIcon={copyingBinder ? <CircularProgress size={16} color="inherit" /> : <ContentCopyIcon />}
                            disabled={copyingBinder || entries.length === 0}
                            onClick={copyBinder}
                        >
                            {copyNeedsSignIn ? 'Sign in to copy' : `Copy all ${cardsLabel(cardCount(entries))}`}
                        </Button>
                    </Box>
                )}

                <Typography sx={sectionLabel}>Export format</Typography>
                {formatPicker}

                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1, mb: 1 }}>
                    <Typography sx={{ ...sectionLabel, mb: 0 }}>
                        Preview
                        <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', ml: 1 }}>
                            {cardsLabel(exportCount)}
                        </Box>
                    </Typography>
                    {filteredEntries && (
                        <FormControlLabel
                            sx={{ ml: 'auto', mr: 0 }}
                            control={(
                                <Checkbox
                                    size="small"
                                    checked={onlyFiltered}
                                    onChange={(e) => change(setOnlyFiltered)(e.target.checked)}
                                    inputProps={{ 'data-testid': 'binder-export-only-filtered' }}
                                />
                            )}
                            label={(
                                <Typography sx={{ fontSize: '0.85rem' }}>
                                    Only the cards shown ({cardCount(filteredEntries)} of {cardCount(entries)})
                                </Typography>
                            )}
                        />
                    )}
                </Box>
                {overDiscordLimit && (
                    <Typography
                        data-testid="binder-export-discord-limit"
                        sx={{ color: 'warning.main', fontSize: '0.8rem', mb: 1 }}
                    >
                        This is {text.length.toLocaleString()} characters. Discord allows 2,000 per message,
                        so paste it in parts or download the file.
                    </Typography>
                )}
                <Box
                    component="pre"
                    data-testid="binder-export-preview"
                    sx={{
                        m: 0,
                        mb: 2,
                        p: 1.5,
                        borderRadius: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'action.hover',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: '0.78rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: { xs: 160, sm: 180 },
                        overflowY: 'auto',
                    }}
                >
                    {items.length ? text : 'This Binder has no cards to export.'}
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1 }}>
                    <Box sx={{ flex: '1 1 200px' }}>
                        <Typography sx={sectionLabel}>Sort by</Typography>
                        <FormControl fullWidth size="small">
                            <Select
                                value={sort}
                                onChange={(e) => change(setSort)(e.target.value)}
                                inputProps={{ 'aria-label': 'Sort by', 'data-testid': 'binder-export-sort' }}
                            >
                                {EXPORT_SORTS.map((opt) => (
                                    <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                    <Box sx={{ flex: '1 1 160px' }}>
                        <Typography sx={sectionLabel}>Price source</Typography>
                        <FormControl fullWidth size="small" disabled={!includePrices}>
                            <Select
                                value={priceSource}
                                onChange={(e) => change(setPriceSource)(e.target.value)}
                                inputProps={{ 'aria-label': 'Price source', 'data-testid': 'binder-export-price-source' }}
                            >
                                {PRICE_SOURCES.map((opt) => (
                                    <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2 }}>
                    <FormControlLabel
                        control={(
                            <Checkbox
                                checked={includePrices}
                                onChange={(e) => change(setIncludePrices)(e.target.checked)}
                                inputProps={{ 'data-testid': 'binder-export-prices' }}
                            />
                        )}
                        label="Include prices"
                    />
                    {hasConditions && (
                        <FormControlLabel
                            control={(
                                <Checkbox
                                    checked={includeCondition}
                                    onChange={(e) => change(setIncludeCondition)(e.target.checked)}
                                    inputProps={{ 'data-testid': 'binder-export-condition' }}
                                />
                            )}
                            label="Include condition (NM, LP, etc.)"
                        />
                    )}
                </Box>
            </DialogContent>
            <DialogActions
                sx={{
                    px: 3,
                    pb: 2,
                    gap: 1,
                    borderTop: fullScreen ? 1 : 0,
                    borderColor: 'divider',
                    pt: fullScreen ? 1.5 : 1,
                    flexDirection: fullScreen ? 'column-reverse' : 'row',
                    alignItems: 'stretch',
                    '& > :not(style) ~ :not(style)': { ml: 0 },
                }}
            >
                <Button onClick={onClose} color="inherit" fullWidth={fullScreen}>Cancel</Button>
                <Button
                    variant="outlined"
                    data-testid="binder-export-copy"
                    startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                    disabled={items.length === 0}
                    onClick={copy}
                    fullWidth={fullScreen}
                >
                    {copied ? 'Copied' : 'Copy to Clipboard'}
                </Button>
                <Button
                    variant="contained"
                    data-testid="binder-export-download"
                    startIcon={<DownloadIcon />}
                    disabled={items.length === 0}
                    onClick={download}
                    fullWidth={fullScreen}
                >
                    Export List
                </Button>
            </DialogActions>
        </Dialog>
    );
}
