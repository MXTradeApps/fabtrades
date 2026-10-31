import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    FormControl,
    MenuItem,
    Select,
    Snackbar,
    Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useCardData } from '../hooks/useCardData.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import Header from '../components/elements/Header.jsx';
import { Page, PageHeader, Panel, EmptyState } from '../components/layout/Page.jsx';
import {
    SortRounded,
    LinkOffRounded,
    CollectionsBookmarkOutlined,
    FileDownloadOutlined,
} from '@mui/icons-material';
import { createBinder, deleteBinder, getBinderShare, getPublicBinder, upsertEntries } from '../services/binder.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import SignInDialog from '../components/auth/SignInDialog.jsx';
import BinderExportDialog from '../components/binder/BinderExportDialog.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { addCardToTradeDraft } from '../utils/tradeDraft.js';
import BinderCardGrid from '../components/binder/BinderCardGrid.jsx';
import { sharedBinderTitle } from '../utils/binderNames.js';

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

/**
 * Read-only public binder view at `/b/:token`.
 */
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
    const [exportOpen, setExportOpen] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);
    const [copiedBinderId, setCopiedBinderId] = useState(null);
    const [isOwnBinder, setIsOwnBinder] = useState(false);

    // Hide "Copy" on the viewer's own shared Binder.
    useEffect(() => {
        if (!user) {
            setIsOwnBinder(false);
            return undefined;
        }
        let cancelled = false;
        getBinderShare().then(({ data }) => {
            if (!cancelled) setIsOwnBinder(Boolean(data?.token) && data.token === String(token).trim());
        });
        return () => {
            cancelled = true;
        };
    }, [user, token]);


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
                setToast(createError?.message || 'Could not copy this Binder');
                return;
            }
        }
        if (!binder) {
            setToast('Could not copy this Binder');
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
            setToast(copyError.message || 'Could not copy the cards');
            return;
        }
        setExportOpen(false);
        setCopiedBinderId(binder.clientId);
        setToast(`Copied to your Binders as "${binder.name}"`);
    }, [user, token, ownerName, entries]);

    // Signing in leaves the page; finish a copy the viewer started signed out.
    useEffect(() => {
        if (!user || loading || error || entries.length === 0) return;
        if (!takePendingCopy(token)) return;
        handleCopyBinder();
    }, [user, loading, error, entries, token, handleCopyBinder]);

    const openEntryDetail = (entry) => {
        const live = catalogById.get(entry.cardId);
        if (live?._uniqueId) openDetail(live);
    };

    const sorted = useMemo(() => {
        const list = [...entries];
        list.sort((a, b) => compareEntries(a, b, sort, resolveCard));
        return list;
    }, [entries, sort, resolveCard]);

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
        setToast(`Added ${shortName} to trade calculator`);
    };

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />

            <Page>
                <PageHeader
                    title={sharedBinderTitle(ownerName)}
                    subtitle={!loading && !error ? (
                        <>
                            {entries.length} {entries.length === 1 ? 'card' : 'cards'}
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

                {!loading && !error && (
                    sorted.length === 0 ? (
                        <Panel>
                            <EmptyState icon={<CollectionsBookmarkOutlined />} title="This binder is empty." />
                        </Panel>
                    ) : (
                        <BinderCardGrid
                            entries={sorted}
                            resolveCard={resolveCard}
                            resetKey={`${token}|${sort}`}
                            onOpenDetail={openEntryDetail}
                            onAddToTrade={handleAddToTrade}
                        />
                    )
                )}
            </Page>

            {exportOpen && (
                <BinderExportDialog
                    open
                    onClose={() => setExportOpen(false)}
                    title={sharedBinderTitle(ownerName)}
                    entries={entries}
                    resolveCard={catalogCard}
                    defaultSort={sort}
                    onCopyBinder={isOwnBinder ? null : handleCopyBinder}
                    copyNeedsSignIn={!user}
                    onToast={setToast}
                />
            )}

            <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />

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
                    severity="success"
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
