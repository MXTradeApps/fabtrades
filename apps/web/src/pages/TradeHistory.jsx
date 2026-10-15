import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    List,
    ListItem,
    IconButton,
    Chip,
    CircularProgress,
    Alert,
    TextField,
    InputAdornment,
    Tooltip,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Snackbar
} from '@mui/material';
import {
    HistoryRounded,
    SwapHorizRounded,
    DeleteOutline as DeleteIconOutline,
    Download as LoadIcon,
    Search as SearchIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserTrades, deleteTrade } from '../services/tradeHistory';
import { useCardData } from '../hooks/useCardData.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import { normalizeTradeList, tradeDisplayName } from '../utils/tradeItems.js';
import { CardThumbnail } from '../components/ui/CardImagePreview.jsx';
import Header from '../components/elements/Header.jsx';
import { Page, PageHeader, Panel, EmptyState } from '../components/layout/Page.jsx';
import SignInDialog from '../components/auth/SignInDialog.jsx';

/** Format an amount with a trade's currency_symbol when present (mobile trades). */
function formatTradeMoney(amount, currencySymbol = '$') {
    const n = Number(amount);
    if (!Number.isFinite(n)) return `${currencySymbol || '$'}0`;
    const symbol = currencySymbol || '$';
    const abs = Math.abs(n).toFixed(2);
    return n < 0 ? `-${symbol}${abs}` : `${symbol}${abs}`;
}

const TradeHistory = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { pricesUpdatedAt: lastUpdatedTimestamp, cardIdLookup } = useCardData();
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDeleteTrade, setConfirmDeleteTrade] = useState(null);
    const [deleteError, setDeleteError] = useState('');
    const [signInOpen, setSignInOpen] = useState(false);

    useEffect(() => {
        if (user) {
            loadTrades();
        }
    }, [user]);

    const loadTrades = async () => {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await getUserTrades();

        if (fetchError) {
            setError(fetchError.message || 'Failed to load trade history');
        } else {
            setTrades(data || []);
        }

        setLoading(false);
    };

    const handleConfirmDelete = async () => {
        const trade = confirmDeleteTrade;
        setConfirmDeleteTrade(null);
        if (!trade) return;

        setDeletingId(trade.id);
        const { error: delError } = await deleteTrade(trade.id);

        if (delError) {
            setDeleteError(delError.message || 'Failed to delete trade');
        } else {
            setTrades(prev => prev.filter(t => t.id !== trade.id));
        }

        setDeletingId(null);
    };

    const handleLoadTrade = (trade) => {
        // Navigate to home with trade data in state
        navigate('/', { state: { loadTrade: trade } });
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
            }
            return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
        }
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
        }
        return date.toLocaleDateString();
    };

    const filteredTrades = trades.filter(trade =>
        tradeDisplayName(trade).toLowerCase().includes(searchQuery.toLowerCase())
    );

    const textColor = 'text.primary';
    const mutedColor = 'text.secondary';

    // Not signed in: explain and offer the sign-in action right here
    if (!user) {
        return (
            <>
                <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
                <Page maxWidth={720}>
                    <Panel sx={{ mt: { xs: 2, md: 6 } }}>
                        <EmptyState
                            icon={<HistoryRounded />}
                            title="Sign In Required"
                            actions={(
                                <>
                                    <Button variant="contained" size="large" onClick={() => setSignInOpen(true)}>
                                        Sign in
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="inherit"
                                        size="large"
                                        startIcon={<ArrowBackIcon />}
                                        onClick={() => navigate('/')}
                                    >
                                        Back to Trading
                                    </Button>
                                </>
                            )}
                        >
                            Sign in to save trades and view your trade history.
                        </EmptyState>
                    </Panel>
                </Page>
                <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
            </>
        );
    }

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />

            <Page maxWidth={1040}>
                <PageHeader
                    title="Trade History"
                    subtitle="Every trade you’ve confirmed. Load one back into the calculator to re-price it."
                    actions={(
                        <Button variant="contained" startIcon={<SwapHorizRounded />} onClick={() => navigate('/')}>
                            New trade
                        </Button>
                    )}
                />

                <TextField
                    fullWidth
                    placeholder="Search trades by name…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    inputProps={{ 'aria-label': 'Search trades' }}
                    sx={{ mb: 3, maxWidth: 520 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: mutedColor }} />
                            </InputAdornment>
                        ),
                    }}
                />

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                )}

                {error && !loading && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {!loading && !error && filteredTrades.length === 0 && (
                    <Panel>
                        {searchQuery ? (
                            <EmptyState icon={<SearchIcon />} title="No trades found">
                                Try a different search term
                            </EmptyState>
                        ) : (
                            <EmptyState
                                icon={<HistoryRounded />}
                                title="No saved trades yet"
                                actions={(
                                    <Button variant="contained" onClick={() => navigate('/')}>
                                        Start Trading
                                    </Button>
                                )}
                            >
                                Build a trade and confirm it to add it to your history
                            </EmptyState>
                        )}
                    </Panel>
                )}

                {!loading && filteredTrades.length > 0 && (
                    <List sx={{ py: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {filteredTrades.map((trade) => {
                            const diffValue = parseFloat(trade.diff);
                            return (
                            <ListItem key={trade.id} sx={{ p: 0 }}>
                                <Panel sx={{ width: '100%', overflow: 'hidden' }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1.5,
                                            px: { xs: 2, sm: 2.5 },
                                            py: 1.75,
                                            borderBottom: 1,
                                            borderColor: 'divider',
                                        }}
                                    >
                                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                            <Typography
                                                variant="h5"
                                                component="h2"
                                                noWrap
                                                sx={{ color: textColor }}
                                            >
                                                {tradeDisplayName(trade)}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: mutedColor, display: 'block', mt: 0.25 }}>
                                                {formatDate(trade.created_at)}
                                            </Typography>
                                        </Box>
                                        {/* Diff colors match the trade calculator:
                                            positive = your side is worth more (primary),
                                            negative = their side is worth more (success) */}
                                        <Chip
                                            size="small"
                                            label={`Diff: ${diffValue > 0 ? '+' : ''}${formatTradeMoney(trade.diff, trade.currency_symbol)}`}
                                            color={diffValue > 0 ? 'primary' : diffValue < 0 ? 'success' : 'default'}
                                            sx={{ flexShrink: 0 }}
                                        />
                                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                            <Tooltip title="Load this trade">
                                                <IconButton
                                                    onClick={() => handleLoadTrade(trade)}
                                                    aria-label="Load this trade"
                                                    sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                                                >
                                                    <LoadIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete this trade">
                                                <IconButton
                                                    onClick={() => setConfirmDeleteTrade(trade)}
                                                    disabled={deletingId === trade.id}
                                                    aria-label="Delete this trade"
                                                    sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                                                >
                                                    {deletingId === trade.id ? (
                                                        <CircularProgress size={20} />
                                                    ) : (
                                                        <DeleteIconOutline />
                                                    )}
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                    <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
                                        <TradeCardLists
                                            haveList={trade.have_list}
                                            wantList={trade.want_list}
                                            haveCash={trade.have_cash}
                                            wantCash={trade.want_cash}
                                            currencySymbol={trade.currency_symbol}
                                            textColor={textColor}
                                            mutedColor={mutedColor}
                                            cardIdLookup={cardIdLookup}
                                        />

                                        {trade.notes ? (
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: mutedColor,
                                                    mt: 1.5,
                                                    px: 1.5,
                                                    py: 1,
                                                    borderRadius: '10px',
                                                    bgcolor: 'surface.sunken',
                                                    whiteSpace: 'pre-wrap',
                                                }}
                                            >
                                                {trade.notes}
                                            </Typography>
                                        ) : null}
                                    </Box>
                                </Panel>
                            </ListItem>
                            );
                        })}
                    </List>
                )}
            </Page>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={Boolean(confirmDeleteTrade)}
                onClose={() => setConfirmDeleteTrade(null)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Delete Trade?</DialogTitle>
                <DialogContent>
                    <Typography>
                        "{confirmDeleteTrade?.name}" will be permanently removed from your history.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={() => setConfirmDeleteTrade(null)}>Cancel</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete error feedback */}
            <Snackbar
                open={Boolean(deleteError)}
                autoHideDuration={4000}
                onClose={() => setDeleteError('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setDeleteError('')}
                    severity="error"
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {deleteError}
                </Alert>
            </Snackbar>
        </>
    );
};

function TradeCardLists({
    haveList,
    wantList,
    haveCash,
    wantCash,
    currencySymbol = '$',
    textColor,
    mutedColor,
    cardIdLookup = {},
}) {
    const haveCards = normalizeTradeList(haveList);
    const wantCards = normalizeTradeList(wantList);
    const cashHave = Number(haveCash) || 0;
    const cashWant = Number(wantCash) || 0;

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 4, rowGap: 2 }}>
            {(haveCards.length > 0 || cashHave > 0) && (
                <TradeSideList
                    label="Gave"
                    cards={haveCards}
                    cash={cashHave}
                    currencySymbol={currencySymbol}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    cardIdLookup={cardIdLookup}
                />
            )}
            {(wantCards.length > 0 || cashWant > 0) && (
                <TradeSideList
                    label="Got"
                    cards={wantCards}
                    cash={cashWant}
                    currencySymbol={currencySymbol}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    cardIdLookup={cardIdLookup}
                />
            )}
        </Box>
    );
}

function TradeSideList({
    label,
    cards,
    cash,
    currencySymbol = '$',
    textColor,
    mutedColor,
    cardIdLookup = {},
}) {
    const { openDetail } = useCardDetail();

    const openCard = (card) => {
        const id = card.uniqueId;
        const printing = (id && cardIdLookup[id]) || null;
        if (printing) openDetail(printing);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <Box
                    aria-hidden
                    sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: label === 'Gave' ? 'primary.main' : 'success.main' }}
                />
                <Typography variant="overline" sx={{ color: mutedColor, lineHeight: 1.4 }}>
                    {label}
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {cards.map((card, index) => {
                    const printing = card.uniqueId && cardIdLookup[card.uniqueId];
                    return (
                    <Box
                        key={`${card.uniqueId || card.name}-${index}`}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}
                    >
                        <CardThumbnail
                            imageUrl={card.imageUrl}
                            fallbackUrl={card.imageUrlFallback}
                            alt={card.name}
                            size={30}
                            onClick={printing ? () => openCard(card) : undefined}
                        />
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography
                                component={printing ? 'button' : 'span'}
                                type={printing ? 'button' : undefined}
                                onClick={printing ? () => openCard(card) : undefined}
                                aria-label={printing ? `View details for ${card.name}` : undefined}
                                variant="body2"
                                sx={{
                                    display: 'block',
                                    maxWidth: '100%',
                                    color: textColor,
                                    fontWeight: 600,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    lineHeight: 1.3,
                                    border: 0,
                                    background: 'none',
                                    p: 0,
                                    m: 0,
                                    textAlign: 'left',
                                    fontFamily: 'inherit',
                                    cursor: printing ? 'pointer' : 'default',
                                }}
                            >
                                {card.quantity}× {card.name}
                                {card.subTypeName ? ` (${card.subTypeName})` : ''}
                            </Typography>
                            <Typography variant="caption" sx={{ color: mutedColor, fontVariantNumeric: 'tabular-nums' }}>
                                {formatTradeMoney(card.price || 0, currencySymbol)} ea
                            </Typography>
                        </Box>
                        <Typography
                            variant="body2"
                            sx={{ color: textColor, fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                        >
                            {formatTradeMoney(
                                Number(card.price || 0) * Number(card.quantity || 1),
                                currencySymbol,
                            )}
                        </Typography>
                    </Box>
                    );
                })}
                {cash > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Typography variant="body2" sx={{ color: textColor, fontWeight: 600, flexGrow: 1 }}>
                            Cash
                        </Typography>
                        <Typography variant="body2" sx={{ color: textColor, fontWeight: 700 }}>
                            {formatTradeMoney(cash, currencySymbol)}
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}

export default TradeHistory;
