import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    FormControl,
    IconButton,
    InputAdornment,
    MenuItem,
    Select,
    Snackbar,
    TextField,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useCardData } from '../hooks/useCardData.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import Header from '../components/elements/Header.jsx';
import { Page, PageHeader, Panel, EmptyState } from '../components/layout/Page.jsx';
import {
    Clear as ClearIcon,
    CollectionsBookmarkOutlined,
    FileDownloadOutlined,
    FilterListRounded,
    LinkOffRounded,
    Search as SearchIcon,
    SortRounded,
} from '@mui/icons-material';
import { createBinder, deleteBinder, getBinderShare, getPublicBinder, upsertEntries } from '../services/binder.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import SignInDialog from '../components/auth/SignInDialog.jsx';
import BinderExportDialog from '../components/binder/BinderExportDialog.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { addCardToTradeDraft } from '../utils/tradeDraft.js';
import BinderCardGrid from '../components/binder/BinderCardGrid.jsx';
import { sharedBinderTitle } from '../utils/binderNames.js';
import BinderFilters, {
    ActiveFilterBar,
    BinderFiltersDrawer,
    BinderFiltersSidebar,
} from '../components/binder/BinderFilters.jsx';
import { useBinderFilters } from '../hooks/useBinderFilters.js';
import { cardMatchesSearch, matchesBinderFilters } from '../utils/binderFilters.js';

const FAB_CDN_BASE = 'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large';

const SORT_OPTIONS = [
    { id: 'priceDesc', label: 'Price (high → low)' },
    { id: 'priceAsc', label: 'Price (low → high)' },
    { id: 'nameAsc', label: 'Name (A–Z)' },
    { id: 'numberAsc', label: 'Collector #' },
];

function fabCdnUrl(collectorNumber, finish) {
    if (!collectorNumber) return '';
    const code = String(collectorNumber).split(/\s*\/\/\s*|\s*\/\s*/)[0].trim();
    if (!code) return '';
    const sub = (finish || '').toLowerCase();
    let suffix = '';
    if (sub.includes('cold foil')) suffix = '-CF';
    else if (sub.includes('rainbow foil')) suffix = '-RF';
    return `${FAB_CDN_BASE}/${code}${suffix}.webp`;
}

function compareEntries(a, b, sort, resolveCard) {
    const ca = resolveCard(a);
    const cb = resolveCard(b);
    switch (sort) {
        case 'priceDesc': {
            const pa = ca.market || 0;
            const pb = cb.market || 0;
            return pb - pa || ca.name.localeCompare(cb.name);
        }
        case 'priceAsc': {
            const pa = ca.market || 0;
            const pb = cb.market || 0;
            return pa - pb || ca.name.localeCompare(cb.name);
        }
        case 'numberAsc': {
            const an = ca.collectorNumber || '';
            const bn = cb.collectorNumber || '';
            if (!an && !bn) return ca.name.localeCompare(cb.name);
            if (!an) return 1;
            if (!bn) return -1;
            return an.localeCompare(bn, undefined, { numeric: true }) ||
                ca.name.localeCompare(cb.name);
        }
        case 'nameAsc':
        default:
            return ca.name.localeCompare(cb.name);
    }
}

const PENDING_COPY_KEY = 'fabtrades.pendingBinderCopy';

function writePendingCopy(token) {
    try {
        window.sessionStorage.setItem(PENDING_COPY_KEY, token);
    } catch {
        // Without storage the viewer just taps Copy again after signing in.
    }
}

function takePendingCopy(token) {
    try {
        if (window.sessionStorage.getItem(PENDING_COPY_KEY) !== token) return false;
        window.sessionStorage.removeItem(PENDING_COPY_KEY);
        return true;
    } catch {
        return false;
    }
}

/**
 * Read-only public binder view at `/b/:token`.
 */
const SharedBinder = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { openDetail } = useCardDetail();
    const { cards, pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();

    const [entries, setEntries] = useState([]);
    const [ownerName, setOwnerName] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sort, setSort] = useState('priceDesc');
    const [toast, setToast] = useState('');
    const [toastSeverity, setToastSeverity] = useState('success');
    const [exportOpen, setExportOpen] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);
    const [copiedBinderId, setCopiedBinderId] = useState(null);
    // null while a signed-in viewer's ownership is still being checked.
    const [isOwnBinder, setIsOwnBinder] = useState(false);

    const showToast = useCallback((message, severity = 'success') => {
        setToastSeverity(severity);
        setToast(message);
    }, []);

    // Hide "Copy" on the viewer's own shared Binder.
    useEffect(() => {
        if (!user) {
            setIsOwnBinder(false);
            return undefined;
        }
        let cancelled = false;
        setIsOwnBinder(null);
        getBinderShare().then(({ data }) => {
            if (!cancelled) setIsOwnBinder(Boolean(data?.token) && data.token === String(token).trim());
        });
        return () => {
            cancelled = true;
        };
    }, [user, token]);

    const [searchQuery, setSearchQuery] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            const { data, error: fetchError } = await getPublicBinder(token);
            if (cancelled) return;
            if (fetchError) {
                setError(fetchError.message || 'This binder link is unavailable');
                setEntries([]);
                setOwnerName(null);
            } else {
                setEntries(data.entries || []);
                setOwnerName(data.ownerName || null);
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const catalogById = useMemo(() => {
        const map = new Map();
        for (const card of cards) {
            if (card._uniqueId) map.set(card._uniqueId, card);
        }
        return map;
    }, [cards]);

    const resolveCard = useCallback(
        (entry) => {
            const stub = entry.card || {};
            const live = catalogById.get(entry.cardId);
            const finish =
                live?.subTypeName ||
                stub.subTypeName ||
                (stub.isFoil ? 'Foil' : 'Normal');
            const collectorNumber = live?.extNumber || stub.collectorNumber || '';
            const cdn = fabCdnUrl(collectorNumber, finish);
            const tcgFallback = live?.imageUrlFallback || stub.imageUrl || '';

            return {
                name: live?.name || stub.name || 'Unknown card',
                imageUrl: cdn || live?.imageUrl || stub.imageUrl || '',
                imageUrlFallback: tcgFallback && tcgFallback !== cdn ? tcgFallback : '',
                collectorNumber,
                rarity: live?.extRarity || stub.rarity || '',
                pitch: live?.extPitchValue || stub.pitch || null,
                finish,
                setName: live?._setName || stub.setName || '',
                typeLine: [
                    live?.extCardType || stub.cardType,
                    live?.extCardSubType || live?.extClass || stub.cardClass,
                ]
                    .filter(Boolean)
                    .join(' — '),
                market: Number(live?.marketPrice) || Number(stub.tcgMarket) || 0,
                low:
                    Number(live?.lowPrice) ||
                    (stub.tcgLow != null ? Number(stub.tcgLow) : null) ||
                    null,
            };
        },
        [catalogById],
    );

    const catalogCard = useCallback((entry) => catalogById.get(entry.cardId), [catalogById]);

    // A personal copy goes into a new standard Binder, so none of it is for trade.
    const handleCopyBinder = useCallback(async () => {
        if (!user) {
            writePendingCopy(token);
            setSignInOpen(true);
            return;
        }
        const baseName = sharedBinderTitle(ownerName);
        let binder = null;
        for (let n = 1; n <= 20 && !binder; n += 1) {
            const { data, error: createError } = await createBinder({
                name: n === 1 ? baseName : `${baseName} (${n})`,
            });
            if (data) binder = data;
            else if (createError?.reason !== 'duplicate') {
                showToast(createError?.message || 'Could not copy this Binder', 'error');
                return;
            }
        }
        if (!binder) {
            showToast('Could not copy this Binder', 'error');
            return;
        }
        const { error: copyError } = await upsertEntries(entries.map((entry) => ({
            cardId: entry.cardId,
            quantity: entry.quantity,
            condition: entry.condition,
            binderId: binder.clientId,
            card: entry.stub || entry.card,
        })));
        if (copyError) {
            // Don't leave an empty Binder behind to collide with the retry.
            await deleteBinder({ clientId: binder.clientId });
            showToast(copyError.message || 'Could not copy the cards', 'error');
            return;
        }
        setExportOpen(false);
        setCopiedBinderId(binder.clientId);
        showToast(`Copied to your Binders as "${binder.name}"`);
    }, [user, token, ownerName, entries, showToast]);

    // Signing in leaves the page; finish a copy the viewer started signed out.
    useEffect(() => {
        if (!user || loading || error || entries.length === 0 || isOwnBinder === null) return;
        if (!takePendingCopy(token) || isOwnBinder) return;
        handleCopyBinder();
    }, [user, loading, error, entries, token, isOwnBinder, handleCopyBinder]);

    const openEntryDetail = (entry) => {
        const live = catalogById.get(entry.cardId);
        if (live?._uniqueId) openDetail(live);
    };

    const matchesSearch = useCallback(
        (entry, card) => cardMatchesSearch(card, searchQuery),
        [searchQuery],
    );
    const {
        filters,
        options: filterOptions,
        activeCount: filterCount,
        toggle: toggleFilter,
        clear: clearFilters,
        logoByGroupId,
    } = useBinderFilters(entries, resolveCard, matchesSearch);

    const sorted = useMemo(() => {
        const list = entries.filter((entry) => {
            const card = resolveCard(entry);
            return matchesBinderFilters(card, filters) && cardMatchesSearch(card, searchQuery);
        });
        list.sort((a, b) => compareEntries(a, b, sort, resolveCard));
        return list;
    }, [entries, searchQuery, filters, sort, resolveCard]);

    const totalCopies = entries.reduce((sum, entry) => sum + (entry.quantity || 1), 0);
    const shownCopies = sorted.reduce((sum, entry) => sum + (entry.quantity || 1), 0);
    const narrowed = Boolean(searchQuery.trim()) || filterCount > 0;
    const showFilters = !loading && !error && entries.length > 0;
    const filterPanel = (
        <BinderFilters
            options={filterOptions}
            filters={filters}
            onToggle={toggleFilter}
            onClear={clearFilters}
            activeCount={filterCount}
            logoByGroupId={logoByGroupId}
        />
    );

    const totalValue = useMemo(
        () =>
            entries.reduce((sum, entry) => {
                const price = resolveCard(entry).market;
                return sum + price * (entry.quantity || 1);
            }, 0),
        [entries, resolveCard],
    );

    const handleAddToTrade = (entry) => {
        const live = catalogById.get(entry.cardId);
        const stub = entry.card || {};
        const name = live?.displayName || live?.name || stub.name || 'Card';
        const subTypeName =
            live?.subTypeName ||
            stub.subTypeName ||
            (stub.isFoil ? 'Foil' : 'Normal');
        const price =
            Number(live?.marketPrice) ||
            Number(stub.tcgMarket) ||
            0;

        addCardToTradeDraft('want', {
            uniqueId: entry.cardId || live?._uniqueId || null,
            name,
            subTypeName,
            quantity: 1,
            price,
        });

        const shortName = live?.name || stub.name || 'Card';
        showToast(`Added ${shortName} to trade calculator`);
    };

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />

            <Page>
                <PageHeader
                    title={sharedBinderTitle(ownerName)}
                    subtitle={!loading && !error ? (
                        <>
                            {totalCopies} {totalCopies === 1 ? 'card' : 'cards'}
                            {' · '}
                            <Box component="span" sx={{ color: 'text.primary', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(totalValue.toFixed(2))}
                            </Box>
                            {' · Add cards straight to your trade calculator.'}
                        </>
                    ) : null}
                    actions={!loading && !error ? (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                                variant="outlined"
                                color="inherit"
                                data-testid="shared-binder-export"
                                startIcon={<FileDownloadOutlined />}
                                onClick={() => setExportOpen(true)}
                                disabled={entries.length === 0}
                                sx={{ minHeight: 40 }}
                            >
                                Export
                            </Button>
                            <FormControl size="small" sx={{ minWidth: 190 }}>
                                <Select
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value)}
                                    aria-label="Sort binder"
                                    startAdornment={<SortRounded sx={{ fontSize: '1.1rem', color: 'text.secondary', mr: 1 }} />}
                                    sx={{ minHeight: 40 }}
                                >
                                    {SORT_OPTIONS.map((opt) => (
                                        <MenuItem key={opt.id} value={opt.id}>
                                            {opt.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    ) : null}
                />

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress size={36} />
                    </Box>
                )}

                {!loading && error && (
                    <Panel>
                        <EmptyState icon={<LinkOffRounded />} title="Binder unavailable">
                            {error}
                        </EmptyState>
                    </Panel>
                )}

                {!loading && !error && entries.length === 0 && (
                    <Panel>
                        <EmptyState icon={<CollectionsBookmarkOutlined />} title="This binder is empty." />
                    </Panel>
                )}

                {showFilters && (
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                        <BinderFiltersSidebar>{filterPanel}</BinderFiltersSidebar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <TextField
                                    data-testid="shared-binder-search"
                                    size="small"
                                    fullWidth
                                    placeholder="Search this binder…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    inputProps={{ 'aria-label': 'Search this binder' }}
                                    sx={{ '& .MuiOutlinedInput-root': { minHeight: 40 } }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: searchQuery ? (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    aria-label="clear search"
                                                    onClick={() => setSearchQuery('')}
                                                    sx={{ p: 0.35, color: 'text.secondary' }}
                                                >
                                                    <ClearIcon sx={{ fontSize: '0.95rem' }} />
                                                </IconButton>
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                />
                                <Button
                                    data-testid="binder-filters-open"
                                    variant="outlined"
                                    color="inherit"
                                    startIcon={<FilterListRounded />}
                                    onClick={() => setFiltersOpen(true)}
                                    sx={{
                                        display: { xs: 'inline-flex', md: 'none' },
                                        flexShrink: 0,
                                        minHeight: 40,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {filterCount > 0 ? `Filters (${filterCount})` : 'Filters'}
                                </Button>
                            </Box>

                            <ActiveFilterBar
                                options={filterOptions}
                                filters={filters}
                                onToggle={toggleFilter}
                                onClearAll={() => {
                                    clearFilters();
                                    setSearchQuery('');
                                }}
                                shownCount={shownCopies}
                                totalCount={totalCopies}
                                narrowed={narrowed}
                            />

                            {sorted.length === 0 ? (
                                <Panel>
                                    <EmptyState
                                        icon={<SearchIcon />}
                                        title="No matching cards in this binder"
                                        actions={filterCount > 0 && (
                                            <Button variant="outlined" color="inherit" onClick={clearFilters}>
                                                Clear filters
                                            </Button>
                                        )}
                                    >
                                        {filterCount > 0
                                            ? 'Clear the filters or search to see more cards.'
                                            : 'Clear the search or try a different name.'}
                                    </EmptyState>
                                </Panel>
                            ) : (
                                <BinderCardGrid
                                    entries={sorted}
                                    resolveCard={resolveCard}
                                    resetKey={`${token}|${sort}|${searchQuery}|${JSON.stringify(filters)}`}
                                    onOpenDetail={openEntryDetail}
                                    onAddToTrade={handleAddToTrade}
                                />
                            )}
                        </Box>
                    </Box>
                )}
            </Page>

            {exportOpen && (
                <BinderExportDialog
                    open
                    onClose={() => setExportOpen(false)}
                    title={sharedBinderTitle(ownerName)}
                    entries={entries}
                    filteredEntries={narrowed ? sorted : null}
                    resolveCard={catalogCard}
                    defaultSort={sort}
                    onCopyBinder={isOwnBinder === false ? handleCopyBinder : null}
                    copyNeedsSignIn={!user}
                    onToast={setToast}
                />
            )}

            <SignInDialog
                open={signInOpen}
                onClose={() => {
                    setSignInOpen(false);
                    // Dismissed without signing in: don't copy on some later sign-in.
                    if (!user) takePendingCopy(token);
                }}
            />

            {showFilters && (
                <BinderFiltersDrawer
                    open={filtersOpen}
                    onClose={() => setFiltersOpen(false)}
                    shownCount={shownCopies}
                >
                    {filterPanel}
                </BinderFiltersDrawer>
            )}

            <Snackbar
                open={Boolean(toast)}
                autoHideDuration={copiedBinderId ? 6000 : 2500}
                onClose={() => {
                    setToast('');
                    setCopiedBinderId(null);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setToast('')}
                    severity={toastSeverity}
                    variant="filled"
                    sx={{ width: '100%' }}
                    action={copiedBinderId ? (
                        <Button
                            color="inherit"
                            size="small"
                            data-testid="shared-binder-open-copy"
                            onClick={() => navigate(`/binder?b=${encodeURIComponent(copiedBinderId)}`)}
                        >
                            Open
                        </Button>
                    ) : null}
                >
                    {toast}
                </Alert>
            </Snackbar>
        </>
    );
};

export default SharedBinder;
