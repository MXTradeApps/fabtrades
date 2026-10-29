import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { Check as CheckIcon, ContentCopy as ContentCopyIcon, Link as LinkIcon } from '@mui/icons-material';
import { SALE_POST_PERCENTS, buildTradePost } from '../../utils/salePost.js';
import { shortenTradeLink } from '../../utils/tradeLinks.js';

const pricedOnLabel = () =>
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * "Share Trade" on the web trade screen: a WTT or WTS post to paste into
 * Discord or a Facebook group. The trade link is copied separately (it is too
 * long to sit in the post); pasted on its own it opens (and unfurls a
 * preview of) the trade on fabtrades.net. The short `/t/` form is requested as
 * soon as the dialog opens; a click that beats it still copies the short link,
 * by handing the clipboard a promise (Safari rejects a write made after an
 * `await` outside the click).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Array} props.items - "Cards I Have", as post items
 * @param {Array} props.wants - "Cards I Want", as post items
 * @param {(mode: 'wtt'|'wts') => string|null} props.getLink - The shared trade
 *   URL for a mode; WTS links only the cards being sold.
 * @param {(url: string) => Promise<string>} [props.shorten] - Long URL to short;
 *   resolves to the long URL when shortening fails.
 */
export default function ShareTradeDialog({ open, onClose, items, wants, getLink, shorten = shortenTradeLink }) {
    const [mode, setMode] = useState(items.length > 0 && wants.length === 0 ? 'wts' : 'wtt');
    const [percent, setPercent] = useState(100);
    const [copied, setCopied] = useState(() => new Set());

    const longLink = useMemo(() => getLink(mode) || '', [getLink, mode]);
    // One request per long link, shared by the effect and an early click.
    const pending = useRef(new Map());
    const shortLinkFor = (url) => {
        if (!pending.current.has(url)) {
            pending.current.set(url, shorten(url).then((short) => short || url, () => url));
        }
        return pending.current.get(url);
    };
    const [shortLinks, setShortLinks] = useState({});
    const shortLink = shortLinks[longLink];

    useEffect(() => {
        if (!longLink) return undefined;
        let live = true;
        shortLinkFor(longLink).then((short) => {
            if (live) setShortLinks((prev) => ({ ...prev, [longLink]: short }));
        });
        return () => {
            live = false;
        };
        // shortLinkFor only reads a ref and the `shorten` prop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [longLink, shorten]);
    const messages = useMemo(
        () => buildTradePost({ mode, wants, items, percent, pricedOn: pricedOnLabel() }),
        [mode, wants, items, percent],
    );

    const update = (fn) => {
        fn();
        setCopied(new Set());
    };

    const copy = async (key, text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied((prev) => new Set(prev).add(key));
        } catch {
            // Clipboard can be blocked; the preview stays selectable.
        }
    };

    const copyLink = async () => {
        if (shortLink) return copy('link', shortLink);
        const text = shortLinkFor(longLink);
        try {
            if (navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'text/plain': text.then((t) => new Blob([t], { type: 'text/plain' })) }),
                ]);
            } else {
                await navigator.clipboard.writeText(await text);
            }
            setCopied((prev) => new Set(prev).add('link'));
        } catch {
            // Clipboard can be blocked; the link stays selectable below.
        }
        return undefined;
    };

    const copyLabel = (index) => {
        const done = copied.has(index);
        if (messages.length === 1) return done ? 'Copied' : 'Copy post';
        return done ? `Copied part ${index + 1}` : `Copy part ${index + 1} of ${messages.length}`;
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="share-trade-dialog">
            <DialogTitle>Share Trade</DialogTitle>
            <DialogContent>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 2 }}>
                    Paste it into Discord or a Facebook group. Copy the link too to share a preview of the trade.
                </Typography>
                <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={mode}
                    onChange={(_, value) => value && update(() => setMode(value))}
                    sx={{ mb: 2 }}
                >
                    <ToggleButton value="wtt" data-testid="share-trade-mode-wtt">WTT</ToggleButton>
                    <ToggleButton value="wts" data-testid="share-trade-mode-wts">WTS</ToggleButton>
                </ToggleButtonGroup>
                {mode === 'wts' && (
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 0.75 }}>Asking price</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                            {SALE_POST_PERCENTS.map((p) => (
                                <Chip
                                    key={p}
                                    data-testid={`share-trade-percent-${p}`}
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
                            data-testid={`share-trade-preview-${index}`}
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
                            onClick={() => copy(index, message)}
                            data-testid={`share-trade-copy-${index}`}
                        >
                            {copyLabel(index)}
                        </Button>
                    </Box>
                ))}
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <Button
                        startIcon={copied.has('link') ? <CheckIcon /> : <LinkIcon />}
                        onClick={copyLink}
                        disabled={!longLink}
                        data-testid="share-trade-copy-link"
                        sx={{ flexShrink: 0 }}
                    >
                        {copied.has('link') ? 'Link copied' : 'Copy link'}
                    </Button>
                    {longLink && (
                        <Typography
                            data-testid="share-trade-link"
                            sx={{ fontSize: '0.75rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'all' }}
                        >
                            {shortLink ? shortLink.replace(/^https?:\/\//, '') : 'Making a short link…'}
                        </Typography>
                    )}
                </Box>
                <Button onClick={onClose}>Done</Button>
            </DialogActions>
        </Dialog>
    );
}
