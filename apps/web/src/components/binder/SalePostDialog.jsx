import { useMemo, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { Check as CheckIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import { SALE_POST_PERCENTS, buildTradePost } from '../../utils/salePost.js';

const MODE_LABELS = { 'wtt-wts': 'WTT/WTS', wtt: 'WTT', wts: 'WTS' };

const pricedOnLabel = () =>
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * "Post for sale": formats Binder cards as a WTS post for Discord or Facebook.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Array<{ name: string, finish?: string, condition?: string, quantity: number, price?: number|null }>} props.items
 * @param {(() => Promise<string|null>)|null} [props.getLink] - Resolves the shared
 *   Binder URL; omit when the open Binder cannot be linked.
 * @param {Array|null} [props.wants] - Cards the poster is looking for. When given,
 *   the dialog writes a WTT/WTS post with a "Looking for" section and `items` as "Have".
 */
export default function SalePostDialog({ open, onClose, items, getLink = null, wants = null }) {
    const isTrade = Array.isArray(wants);
    const [mode, setMode] = useState(isTrade ? 'wtt-wts' : 'wts');
    const [platform, setPlatform] = useState('discord');
    const [percent, setPercent] = useState(100);
    const [link, setLink] = useState('');
    const [linkBusy, setLinkBusy] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [copied, setCopied] = useState(() => new Set());

    const countCards = (list) => list.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const cards = countCards(items);
    const wantCards = isTrade ? countCards(wants) : 0;
    const messages = useMemo(
        () => buildTradePost({ mode, wants: wants || [], platform, items, percent, pricedOn: pricedOnLabel(), link }),
        [mode, wants, platform, items, percent, link],
    );
    const plural = (n) => (n === 1 ? '1 card' : `${n} cards`);
    const intro = !isTrade
        ? `${plural(cards)}, priced and formatted to paste into a selling channel or group.`
        : mode === 'wts'
            ? `${plural(cards)} you have, priced and formatted to paste into a selling channel or group.`
            : `${plural(wantCards)} you're looking for and ${plural(cards)} you have, formatted to paste into a trading channel or group.`;

    const update = (fn) => {
        fn();
        setCopied(new Set());
    };

    const toggleLink = async (on) => {
        if (!on) {
            update(() => setLink(''));
            return;
        }
        setLinkBusy(true);
        setLinkError('');
        const url = await getLink().catch(() => null);
        setLinkBusy(false);
        if (url) update(() => setLink(url));
        else setLinkError('Could not get a link. Try again.');
    };

    const copy = async (index) => {
        try {
            await navigator.clipboard.writeText(messages[index]);
            setCopied((prev) => new Set(prev).add(index));
        } catch {
            // Clipboard can be blocked; the preview stays selectable.
        }
    };

    const copyLabel = (index) => {
        const done = copied.has(index);
        if (messages.length === 1) return done ? 'Copied' : 'Copy post';
        return done ? `Copied part ${index + 1}` : `Copy part ${index + 1} of ${messages.length}`;
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="sale-post-dialog">
            <DialogTitle>{isTrade ? 'Trade post' : 'Post for sale'}</DialogTitle>
            <DialogContent>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 2 }}>
                    {intro}
                </Typography>
                {isTrade && (
                    <ToggleButtonGroup
                        exclusive
                        fullWidth
                        size="small"
                        value={mode}
                        onChange={(_, value) => value && update(() => setMode(value))}
                        sx={{ mb: 1.5 }}
                    >
                        {Object.entries(MODE_LABELS).map(([value, label]) => (
                            <ToggleButton key={value} value={value} data-testid={`sale-post-mode-${value}`}>
                                {label}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                )}
                <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={platform}
                    onChange={(_, value) => value && update(() => setPlatform(value))}
                    sx={{ mb: 2 }}
                >
                    <ToggleButton value="discord" data-testid="sale-post-discord">Discord</ToggleButton>
                    <ToggleButton value="facebook" data-testid="sale-post-facebook">Facebook</ToggleButton>
                </ToggleButtonGroup>
                {mode !== 'wtt' && (
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 0.75 }}>Asking price</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                            {SALE_POST_PERCENTS.map((p) => (
                                <Chip
                                    key={p}
                                    data-testid={`sale-post-percent-${p}`}
                                    label={p === 100 ? 'Market' : `${p}%`}
                                    color={percent === p ? 'primary' : 'default'}
                                    variant={percent === p ? 'filled' : 'outlined'}
                                    onClick={() => update(() => setPercent(p))}
                                />
                            ))}
                        </Box>
                    </Box>
                )}
                {messages.length === 0 && (
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 1.5 }}>
                        Add cards you have to the trade to post them for sale.
                    </Typography>
                )}
                {getLink && (
                    <Box sx={{ mb: 1.5 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(link)}
                                    disabled={linkBusy}
                                    onChange={(e) => toggleLink(e.target.checked)}
                                />
                            }
                            label="Add a link to my Binder"
                        />
                        <Typography sx={{ color: linkError ? 'error.main' : 'text.secondary', fontSize: '0.8rem' }}>
                            {linkError || 'Buyers can see every card and price on fabtrades.net'}
                        </Typography>
                    </Box>
                )}
                {messages.length > 1 && (
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 1 }}>
                        Discord allows 2,000 characters per message, so this post is split into{' '}
                        {messages.length} parts. Paste them in order.
                    </Typography>
                )}
                {messages.map((message, index) => (
                    <Box key={index} sx={{ mb: 2 }}>
                        <Box
                            component="pre"
                            data-testid={`sale-post-preview-${index}`}
                            sx={{
                                m: 0,
                                mb: 1,
                                p: 1.5,
                                borderRadius: 1.5,
                                border: 1,
                                borderColor: 'divider',
                                bgcolor: 'action.hover',
                                fontFamily: 'inherit',
                                fontSize: '0.8rem',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                maxHeight: 280,
                                overflowY: 'auto',
                            }}
                        >
                            {message}
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={copied.has(index) ? <CheckIcon /> : <ContentCopyIcon />}
                            onClick={() => copy(index)}
                            data-testid={`sale-post-copy-${index}`}
                        >
                            {copyLabel(index)}
                        </Button>
                    </Box>
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Done</Button>
            </DialogActions>
        </Dialog>
    );
}
