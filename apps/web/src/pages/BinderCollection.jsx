import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputAdornment,
    MenuItem,
    Select,
    Snackbar,
    Switch,
    TextField,
    Typography,
    useTheme,
} from '@mui/material';
import {
    BookmarkBorderRounded,
    CollectionsBookmarkOutlined,
    FileDownloadOutlined,
    FileUploadOutlined,
    InsightsOutlined,
    SortRounded,
    StyleOutlined,
    Add as AddIcon,
    ArrowBack as ArrowBackIcon,
    Clear as ClearIcon,
    ContentCopy as ContentCopyIcon,
    Search as SearchIcon,
    Share as ShareIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEntitlement } from '../contexts/EntitlementContext.jsx';
import { useCardData } from '../hooks/useCardData.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import Header from '../components/elements/Header.jsx';
import { Page, Panel, EmptyState } from '../components/layout/Page.jsx';
import { tk } from '../theme/tokens.js';
import { SearchDialog } from '../components/search/index.js';
import SignInDialog from '../components/auth/SignInDialog.jsx';
import FabraryImportDialog from './BinderSettings.jsx';
import {
    ensureBinderShare,
    getBinderEntries,
    getBinders,
    regenerateBinderShare,
    removeEntry,
    setBinderShareEnabled,
    upsertEntry,
    createBinder,
    renameBinder,
    deleteBinder,
    clearBinder,
    applyBinderMove,
    countableLiveBinders,
    isWantListBinder,
    TRADE_BINDER_ID,
    WANT_BINDER_ID,
} from '../services/binder.js';
import { formatCurrency } from '../utils/helpers.js';
import { formatBinderAsText } from '../utils/binderText.js';
import {
    buildFabraryExportRows,
    downloadCsv,
    fabraryExportFilename,
    toFabraryCsv,
} from '../utils/fabraryExport.js';
import BinderGrid from '../components/binder/BinderGrid.jsx';
import BinderEntryList from '../components/binder/BinderEntryList.jsx';
import { setOpenBinderId } from '../utils/openBinder.js';

const FAB_CDN_BASE = 'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large';

/** Matches mobile `CardSort` labels / ordering. Default is price high → low. */
const SORT_OPTIONS = [
    { id: 'priceDesc', label: 'Price (high → low)' },
    { id: 'priceAsc', label: 'Price (low → high)' },
    { id: 'nameAsc', label: 'Name (A–Z)' },
    { id: 'numberAsc', label: 'Collector #' },
];

function compareBinderEntries(a, b, sort, resolveCard) {
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

function ownedIdentity(entry) {
    return `${entry.cardId}|${entry.binderId || TRADE_BINDER_ID}|${entry.condition || 'NM'}`;
}

/** Same CDN pattern as useCardData — rebuild when the stub URL is stale/empty. */
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

/**
 * Shared Binder / Want List page. Parameterized by `isWanted` the same way
 * mobile uses a single BinderEntry model for both lists.
 */
const BinderCollection = ({ isWanted = false }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isPro } = useEntitlement();
    const { openDetail } = useCardDetail();
    const { cards, cardGroups, pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();

    const [allOwned, setAllOwned] = useState([]);
    const [wants, setWants] = useState([]);
    const [binders, setBinders] = useState([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const openBinderId = isWanted ? null : searchParams.get('b');
    const setOpenBinder = useCallback((id) => {
        if (isWanted) return;
        if (!id) {
            setSearchParams({}, { replace: true });
            return;
        }
        setSearchParams({ b: id });
    }, [isWanted, setSearchParams]);
    const [loading, setLoading] = useState(Boolean(user));
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sort, setSort] = useState('priceDesc');
    const [addOpen, setAddOpen] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);
    const [busyCardId, setBusyCardId] = useState(null);
    const [toast, setToast] = useState('');
    const [shareOpen, setShareOpen] = useState(false);
    const [share, setShare] = useState(null);
    const [shareBusy, setShareBusy] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [pendingClear, setPendingClear] = useState(null);
    const [clearBusy, setClearBusy] = useState(false);
    const [importOpen, setImportOpen] = useState(false);

    const viewingWants = isWanted || openBinderId === WANT_BINDER_ID;
    const listLabel = viewingWants ? 'Want List' : 'Binder';
    const pageTitle = isWanted ? 'Want List' : 'My Binders';

    const palette = tk(useTheme());
    const textColor = palette.text;
    const mutedColor = palette.textMuted;

    const loadEntries = useCallback(async () => {
        setError(null);
        const { data, error: fetchError } = await getBinderEntries();
        if (fetchError) {
            setError(fetchError.message || `Failed to load ${listLabel.toLowerCase()}`);
            setAllOwned([]);
            setWants([]);
        } else {
            setAllOwned(data.binder || []);
            setWants(data.wants || []);
        }
        setLoading(false);
    }, [listLabel]);

    const loadBinders = useCallback(async () => {
        if (isWanted) return;
        const { data } = await getBinders();
        setBinders(data?.binders || []);
    }, [isWanted]);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        loadEntries();
        loadBinders();
    }, [user, loadEntries, loadBinders]);

    const entries = useMemo(() => {
        if (viewingWants) return wants;
        if (openBinderId) {
            return allOwned.filter((e) => (e.binderId || TRADE_BINDER_ID) === openBinderId);
        }
        return allOwned;
    }, [viewingWants, wants, allOwned, openBinderId]);

    useEffect(() => {
        setOpenBinderId(isWanted ? null : openBinderId);
    }, [isWanted, openBinderId]);

    const catalogById = useMemo(() => {
        const map = new Map();
        for (const card of cards) {
            if (card._uniqueId) map.set(card._uniqueId, card);
        }
        return map;
    }, [cards]);

    /** cardId → sibling printings (Normal / Rainbow Foil / …) from catalog groups. */
    const editionsByCardId = useMemo(() => {
        const map = new Map();
        for (const group of cardGroups || []) {
            const editions = group.editions || [];
            for (const edition of editions) {
                if (edition.uniqueId) map.set(edition.uniqueId, editions);
            }
        }
        return map;
    }, [cardGroups]);

    const cardOptions = useMemo(
        () =>
            cards.map((card) => ({
                label: card.displayName,
                value: card._uniqueDisplayId,
                subTypeName: card.subTypeName,
                setName: card._setName || '',
                card,
            })),
        [cards],
    );

    /** Merge a binder stub with live catalog row for fresher prices / type lines. */
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
                // Prefer CDN (rebuilt from set code); fall back to TCG / stub.
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
                mid: Number(live?.midPrice) || null,
                high: Number(live?.highPrice) || null,
            };
        },
        [catalogById],
    );

    const openEntryDetail = (entry) => {
        const live = catalogById.get(entry.cardId);
        if (live?._uniqueId) openDetail(live);
    };

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const list = q
            ? entries.filter((entry) => {
                const card = resolveCard(entry);
                return (
                    card.name.toLowerCase().includes(q) ||
                    card.setName.toLowerCase().includes(q) ||
                    card.finish.toLowerCase().includes(q) ||
                    card.collectorNumber.toLowerCase().includes(q) ||
                    card.typeLine.toLowerCase().includes(q)
                );
            })
            : [...entries];
        list.sort((a, b) => compareBinderEntries(a, b, sort, resolveCard));
        return list;
    }, [entries, searchQuery, sort, resolveCard]);

    const totalValue = useMemo(
        () =>
            entries.reduce((sum, entry) => {
                const price = resolveCard(entry).market;
                return sum + price * (entry.quantity || 1);
            }, 0),
        [entries, resolveCard],
    );

    const showingGrid = !isWanted && !openBinderId;
    const openBinder = binders.find((b) => b.clientId === openBinderId)
        || (openBinderId === WANT_BINDER_ID
            ? { clientId: WANT_BINDER_ID, name: 'Want List' }
            : undefined);

    const handleAddCard = async (option) => {
        const catalogCard = option?.card;
        if (!catalogCard?._uniqueId) return;

        const cardId = catalogCard._uniqueId;
        const binderId = viewingWants ? undefined : (openBinderId || TRADE_BINDER_ID);
        const existing = entries.find((e) => e.cardId === cardId);

        setBusyCardId(cardId);
        const nextQty = existing ? existing.quantity + 1 : 1;
        const { data, error: upsertError } = await upsertEntry({
            cardId,
            isWanted: viewingWants,
            quantity: nextQty,
            condition: existing?.condition || 'NM',
            binderId,
            card: catalogCard,
            addedAt: existing?.addedAt,
        });
        setBusyCardId(null);

        if (upsertError) {
            setToast(upsertError.message || 'Failed to add card');
            return;
        }

        if (viewingWants) {
            setWants((prev) => {
                const without = prev.filter((e) => e.cardId !== cardId);
                return [data, ...without];
            });
        } else {
            const key = ownedIdentity({
                cardId,
                binderId,
                condition: existing?.condition || 'NM',
            });
            setAllOwned((prev) => {
                const without = prev.filter((e) => ownedIdentity(e) !== key);
                return [data, ...without];
            });
        }
        setToast(`Added ${catalogCard.name} to ${listLabel}`);
    };

    const updateQuantity = async (entry, quantity) => {
        setBusyCardId(entry.cardId);
        if (quantity <= 0) {
            const { error: delError } = await removeEntry(entry.cardId, viewingWants, {
                binderId: entry.binderId,
                condition: entry.condition,
            });
            setBusyCardId(null);
            if (delError) {
                setToast(delError.message || 'Failed to remove card');
                return;
            }
            if (viewingWants) {
                setWants((prev) => prev.filter((e) => e.cardId !== entry.cardId));
            } else {
                const key = ownedIdentity(entry);
                setAllOwned((prev) => prev.filter((e) => ownedIdentity(e) !== key));
            }
            return;
        }

        const { data, error: upsertError } = await upsertEntry({
            cardId: entry.cardId,
            isWanted: viewingWants,
            quantity,
            condition: entry.condition,
            binderId: entry.binderId,
            card: entry.stub || entry.card,
            addedAt: entry.addedAt,
        });
        setBusyCardId(null);

        if (upsertError) {
            setToast(upsertError.message || 'Failed to update quantity');
            return;
        }
        if (viewingWants) {
            setWants((prev) => prev.map((e) => (e.cardId === entry.cardId ? data : e)));
        } else {
            const key = ownedIdentity(entry);
            setAllOwned((prev) => prev.map((e) => (ownedIdentity(e) === key ? data : e)));
        }
    };

    /**
     * Swap printing (e.g. Normal → Rainbow Foil). Keeps qty/condition; merges
     * into an existing row for the target printing when one is already present.
     */
    const changeVersion = async (entry, newCardId) => {
        if (!newCardId || newCardId === entry.cardId) return;
        const newCard = catalogById.get(newCardId);
        if (!newCard) {
            setToast('That printing is not in the catalog');
            return;
        }

        const mergeTarget = entries.find((e) => e.cardId === newCardId);
        const qty = entry.quantity || 1;
        const condition = entry.condition || 'NM';

        setBusyCardId(entry.cardId);

        const { data: upserted, error: upsertError } = await upsertEntry({
            cardId: newCardId,
            isWanted: viewingWants,
            quantity: mergeTarget ? mergeTarget.quantity + qty : qty,
            condition: mergeTarget?.condition || condition,
            binderId: viewingWants ? undefined : (openBinderId || TRADE_BINDER_ID),
            card: newCard,
            addedAt: mergeTarget?.addedAt || entry.addedAt,
        });

        if (upsertError) {
            setBusyCardId(null);
            setToast(upsertError.message || 'Failed to change version');
            return;
        }

        const { error: delError } = await removeEntry(entry.cardId, viewingWants, {
            binderId: entry.binderId,
            condition: entry.condition,
        });
        setBusyCardId(null);

        if (delError) {
            setToast(delError.message || 'Version updated, but the old printing lingered');
            await loadEntries();
            return;
        }

        if (viewingWants) {
            setWants((prev) => {
                const withoutOld = prev.filter((e) => e.cardId !== entry.cardId);
                const withoutTarget = withoutOld.filter((e) => e.cardId !== newCardId);
                return [upserted, ...withoutTarget];
            });
        } else {
            const oldKey = ownedIdentity(entry);
            const nextKey = ownedIdentity(upserted);
            setAllOwned((prev) => {
                const withoutOld = prev.filter((e) => ownedIdentity(e) !== oldKey);
                const withoutTarget = withoutOld.filter((e) => ownedIdentity(e) !== nextKey);
                return [upserted, ...withoutTarget];
            });
        }
        setToast(`Changed to ${newCard.subTypeName || 'new version'}`);
    };

    const handleRemove = async (entry) => {
        if (!entry) return;
        setBusyCardId(entry.cardId);
        const { error: delError } = await removeEntry(entry.cardId, viewingWants, {
            binderId: entry.binderId,
            condition: entry.condition,
        });
        setBusyCardId(null);
        if (delError) {
            setToast(delError.message || 'Failed to remove card');
            return;
        }
        if (viewingWants) {
            setWants((prev) => prev.filter((e) => e.cardId !== entry.cardId));
        } else {
            const key = ownedIdentity(entry);
            setAllOwned((prev) => prev.filter((e) => ownedIdentity(e) !== key));
        }
    };

    const promptName = (title, initial = '') => {
        const next = window.prompt(title, initial);
        return next;
    };

    const handleExportFabrary = () => {
        const rows = buildFabraryExportRows({
            owned: allOwned,
            wants,
            resolveCard: (entry) => catalogById.get(entry.cardId),
        });
        if (rows.length === 0) {
            setToast('Nothing to export');
            return;
        }
        downloadCsv(toFabraryCsv(rows), fabraryExportFilename());
        setToast(`Exported ${rows.length} printings for Fabrary`);
    };

    const handleCreateBinder = async () => {
        const name = promptName('New Binder');
        if (name == null) return;
        const { data, error: createError } = await createBinder({
            name,
            isPro,
            liveCount: countableLiveBinders(binders).length,
        });
        if (createError) {
            setToast(createError.reason === 'duplicate'
                ? 'A Binder with that name already exists'
                : (createError.message || 'Could not create Binder'));
            return;
        }
        setBinders((prev) => [...prev, data]);
    };

    const handleRenameBinder = async (binder) => {
        const name = promptName('Rename Binder', binder.name);
        if (name == null) return;
        const { data, error: renameError } = await renameBinder({
            clientId: binder.clientId,
            name,
        });
        if (renameError) {
            setToast(renameError.reason === 'duplicate'
                ? 'A Binder with that name already exists'
                : (renameError.message || 'Could not rename'));
            return;
        }
        setBinders((prev) => prev.map((b) => (b.clientId === data.clientId ? data : b)));
    };

    const handleDeleteBinder = (binder) => {
        setPendingDelete(binder);
    };

    const pendingDeleteCopies = pendingDelete
        ? allOwned
            .filter((e) =>
                !e.isWanted &&
                (e.binderId || TRADE_BINDER_ID) === pendingDelete.clientId,
            )
            .reduce((sum, e) => sum + (Number(e.quantity) || 0), 0)
        : 0;

    const confirmDeleteBinder = async () => {
        const binder = pendingDelete;
        if (!binder) return;
        const { error: deleteError } = await deleteBinder({
            clientId: binder.clientId,
        });
        if (deleteError) {
            const message = deleteError.reason === 'trade'
                ? 'Trade Binder cannot be deleted'
                : deleteError.reason === 'want'
                    ? 'Want List cannot be deleted'
                    : (deleteError.message || 'Could not delete Binder');
            setToast(message);
            setPendingDelete(null);
            return;
        }
        setBinders((prev) => prev.filter((b) => b.clientId !== binder.clientId));
        setAllOwned((prev) => prev.filter((e) =>
            (e.binderId || TRADE_BINDER_ID) !== binder.clientId,
        ));
        setPendingDelete(null);
    };

    const handleClearBinder = (binder) => {
        const clientId = binder?.clientId
            || (viewingWants ? WANT_BINDER_ID : null);
        if (!clientId) return;
        setPendingClear({
            clientId,
            name: binder?.name
                || (clientId === WANT_BINDER_ID ? 'Want List' : 'Binder'),
        });
    };

    const pendingClearCopies = pendingClear
        ? (isWantListBinder(pendingClear)
            ? wants
            : allOwned.filter((e) =>
                !e.isWanted &&
                (e.binderId || TRADE_BINDER_ID) === pendingClear.clientId,
            ))
            .reduce((sum, e) => sum + (Number(e.quantity) || 0), 0)
        : 0;

    const confirmClearBinder = async () => {
        const binder = pendingClear;
        if (!binder) return;
        setClearBusy(true);
        const { error: clearError } = await clearBinder({
            clientId: binder.clientId,
            isWanted: isWantListBinder(binder),
        });
        setClearBusy(false);
        if (clearError) {
            setToast(clearError.message || 'Could not clear Binder');
            setPendingClear(null);
            return;
        }
        if (isWantListBinder(binder)) {
            setWants([]);
        } else {
            setAllOwned((prev) => prev.filter((e) =>
                (e.binderId || TRADE_BINDER_ID) !== binder.clientId,
            ));
        }
        setPendingClear(null);
        setToast(`Cleared ${binder.name}`);
    };

    const handleMove = async (entry) => {
        const dests = binders.filter((b) =>
            b.clientId !== (openBinderId || TRADE_BINDER_ID) && !isWantListBinder(b),
        );
        if (!dests.length) {
            setToast('No other Binder to move into');
            return;
        }
        const names = dests.map((b) => b.name).join(', ');
        const picked = window.prompt(`Move to Binder (${names})`, dests[0].name);
        if (!picked) return;
        const dest = dests.find((b) => b.name.toLowerCase() === picked.trim().toLowerCase())
            || dests.find((b) => b.clientId === picked);
        if (!dest) {
            setToast('Want List is not a Binder destination');
            return;
        }
        let qty = entry.quantity || 1;
        if (qty > 1) {
            const raw = window.prompt(`How many copies to move? (1–${qty})`, String(Math.min(2, qty)));
            if (raw == null) return;
            qty = Number(raw);
        }
        const { error: moveError } = await applyBinderMove({
            binders,
            entries: allOwned,
            fromBinderId: openBinderId || TRADE_BINDER_ID,
            toBinderId: dest.clientId,
            printingId: entry.cardId,
            condition: entry.condition || 'NM',
            quantity: qty,
        });
        if (moveError) {
            setToast(moveError.message || 'Could not move');
            return;
        }
        await loadEntries();
        await loadBinders();
    };

    const openShareDialog = async () => {
        setShareOpen(true);
        setShareBusy(true);
        const { data, error: shareError } = await ensureBinderShare();
        setShareBusy(false);
        if (shareError) {
            setToast(shareError.message || 'Could not create share link');
            setShareOpen(false);
            return;
        }
        setShare(data);
    };

    const copyShareLink = async () => {
        if (!share?.url) return;
        try {
            await navigator.clipboard.writeText(share.url);
            setToast('Link copied');
        } catch {
            setToast('Could not copy link');
        }
    };

    const copyBinderAsText = async () => {
        const text = formatBinderAsText({
            name: viewingWants ? 'Want List' : (openBinder?.name || 'Binder'),
            entries: entries.map((entry) => {
                const card = resolveCard(entry);
                return {
                    quantity: entry.quantity,
                    name: card.name,
                    collectorNumber: card.collectorNumber,
                    finish: card.finish,
                    condition: entry.condition || 'NM',
                    setName: card.setName,
                };
            }),
        });
        try {
            await navigator.clipboard.writeText(text);
            setToast('Binder copied as text');
        } catch {
            setToast('Could not copy binder');
        }
    };

    const toggleShareEnabled = async (enabled) => {
        setShareBusy(true);
        const { data, error: shareError } = await setBinderShareEnabled(enabled);
        setShareBusy(false);
        if (shareError) {
            setToast(shareError.message || 'Could not update sharing');
            return;
        }
        setShare(data);
        setToast(enabled ? 'Sharing enabled' : 'Sharing turned off');
    };

    const handleRegenerateShare = async () => {
        setShareBusy(true);
        const { data, error: shareError } = await regenerateBinderShare();
        setShareBusy(false);
        if (shareError) {
            setToast(shareError.message || 'Could not regenerate link');
            return;
        }
        setShare(data);
        setToast('New link created — old link no longer works');
    };

    if (!user) {
        return (
            <>
                <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />
                <Page maxWidth={720}>
                    <Panel sx={{ mt: { xs: 2, md: 6 } }}>
                        <EmptyState
                            icon={isWanted ? <BookmarkBorderRounded /> : <CollectionsBookmarkOutlined />}
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
                            Sign in to sync your {listLabel.toLowerCase()} across devices.
                        </EmptyState>
                    </Panel>
                </Page>
                <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
            </>
        );
    }

    const openCount = entries.reduce((sum, entry) => sum + (entry.quantity || 1), 0);
    const showBreadcrumb = !isWanted && Boolean(openBinderId);
    const headerTitle = isWanted
        ? pageTitle
        : (openBinderId ? (openBinder?.name || (viewingWants ? 'Want List' : 'Binder')) : pageTitle);

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />

            <Page>
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        gap: 2,
                        mb: 3,
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: '1 1 300px' }}>
                        {showBreadcrumb && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, ml: -0.75 }}>
                                <IconButton
                                    size="small"
                                    data-testid="binder-back"
                                    aria-label="Back to all binders"
                                    onClick={() => setOpenBinder(null)}
                                    sx={{ color: 'text.secondary' }}
                                >
                                    <ArrowBackIcon sx={{ fontSize: '1.1rem' }} />
                                </IconButton>
                                <Typography
                                    component="button"
                                    type="button"
                                    data-testid="binder-home-title"
                                    onClick={() => setOpenBinder(null)}
                                    sx={{
                                        border: 0,
                                        background: 'none',
                                        p: 0,
                                        fontFamily: 'inherit',
                                        fontSize: '0.84375rem',
                                        fontWeight: 600,
                                        color: 'text.secondary',
                                        cursor: 'pointer',
                                        '&:hover': { color: 'text.primary' },
                                    }}
                                >
                                    {pageTitle}
                                </Typography>
                                <Typography component="span" sx={{ color: 'text.disabled', fontSize: '0.84375rem' }}>/</Typography>
                            </Box>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                            <Typography
                                variant="h1"
                                data-testid={showBreadcrumb ? 'binder-open-name' : 'binder-home-title'}
                                noWrap={showBreadcrumb}
                                sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, color: 'text.primary', minWidth: 0 }}
                            >
                                {headerTitle}
                            </Typography>
                            {isWanted && (
                                <Chip
                                    data-testid="binder-count-chip"
                                    size="small"
                                    label={`${entries.length}`}
                                    sx={{ height: 24, fontSize: '0.75rem' }}
                                />
                            )}
                        </Box>
                        {(showingGrid || openBinderId || isWanted) && (
                            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.75 }}>
                                {showingGrid
                                    ? 'Organize your collection into binders. Open one to search, sort and edit its cards.'
                                    : `${openCount} ${openCount === 1 ? 'card' : 'cards'}`}
                                {!showingGrid && viewingWants && totalValue > 0 && (
                                    <>
                                        {' · '}
                                        <Box component="span" sx={{ color: 'text.primary', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                                            {formatCurrency(totalValue.toFixed(2))}
                                        </Box>
                                    </>
                                )}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {!viewingWants && !showingGrid && entries.length > 0 && (
                            <Button
                                data-testid="collection-stats"
                                variant="outlined"
                                color="inherit"
                                startIcon={<InsightsOutlined />}
                                onClick={() => {
                                    setOpenBinderId(openBinderId);
                                    navigate('/binder/stats');
                                }}
                            >
                                Collection Stats
                            </Button>
                        )}
                        {!isWanted && openBinderId === TRADE_BINDER_ID && (
                            <Button
                                variant="outlined"
                                color="inherit"
                                startIcon={<ShareIcon />}
                                onClick={openShareDialog}
                            >
                                Share
                            </Button>
                        )}
                        {!showingGrid && entries.length > 0 && (
                            <Button
                                variant="text"
                                color="error"
                                data-testid="binder-clear"
                                onClick={() => handleClearBinder(
                                    viewingWants
                                        ? { clientId: WANT_BINDER_ID, name: 'Want List' }
                                        : openBinder,
                                )}
                            >
                                {viewingWants ? 'Clear Want List' : 'Clear Binder'}
                            </Button>
                        )}
                        {showingGrid && (
                            <>
                                <Button
                                    variant="outlined"
                                    color="inherit"
                                    data-testid="import-fabrary"
                                    startIcon={<FileUploadOutlined />}
                                    onClick={() => setImportOpen(true)}
                                >
                                    Import from Fabrary
                                </Button>
                                <Button
                                    variant="outlined"
                                    color="inherit"
                                    data-testid="export-fabrary"
                                    startIcon={<FileDownloadOutlined />}
                                    onClick={handleExportFabrary}
                                    disabled={allOwned.length === 0 && wants.length === 0}
                                >
                                    Export for Fabrary
                                </Button>
                                <Button
                                    variant="contained"
                                    data-testid="binder-create"
                                    startIcon={<AddIcon />}
                                    onClick={handleCreateBinder}
                                >
                                    New Binder
                                </Button>
                            </>
                        )}
                    </Box>
                </Box>

                    {showingGrid && (
                        <BinderGrid
                            binders={binders}
                            entries={[...allOwned, ...wants]}
                            resolveCard={resolveCard}
                            onOpen={(binder) => setOpenBinder(binder.clientId)}
                            onRename={handleRenameBinder}
                            onDelete={handleDeleteBinder}
                            onClear={handleClearBinder}
                        />
                    )}

                    {!showingGrid && (
                    <>
                    <Box
                        sx={{
                            mb: 2,
                            position: 'relative',
                            zIndex: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        }}
                    >
                        <TextField
                            data-testid="collection-search"
                            size="small"
                            fullWidth
                            placeholder={viewingWants ? 'Search Want List…' : 'Search Binder…'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            inputProps={{ 'aria-label': viewingWants ? 'Search Want List' : 'Search Binder' }}
                            sx={{
                                flexGrow: 1,
                                minWidth: { xs: '100%', sm: 0 },
                                '& .MuiOutlinedInput-root': { minHeight: 40 },
                            }}
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
                        <FormControl
                            size="small"
                            sx={{
                                minWidth: { xs: 0, sm: 190 },
                                flex: { xs: 1, sm: 'none' },
                                '& .MuiOutlinedInput-root': { minHeight: 40 },
                            }}
                        >
                            <Select
                                value={sort}
                                displayEmpty
                                onChange={(e) => setSort(e.target.value)}
                                aria-label="Sort binder"
                                startAdornment={<SortRounded sx={{ fontSize: '1.1rem', color: 'text.secondary', mr: 1 }} />}
                                renderValue={(value) => {
                                    const opt = SORT_OPTIONS.find((o) => o.id === value);
                                    return opt?.label || 'Sort';
                                }}
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <MenuItem key={option.id} value={option.id} dense>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            data-testid="add-card"
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setAddOpen(true)}
                            sx={{ flexShrink: 0, minHeight: 40, whiteSpace: 'nowrap' }}
                        >
                            Add Card
                        </Button>
                    </Box>

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

                    {!loading && !error && filtered.length === 0 && (
                        <Panel>
                            <EmptyState
                                icon={searchQuery.trim() ? <SearchIcon /> : <StyleOutlined />}
                                title={searchQuery.trim()
                                    ? 'No matching cards in this list'
                                    : `${listLabel} is empty`}
                                actions={!searchQuery.trim() && (
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={() => setAddOpen(true)}
                                    >
                                        Add Card
                                    </Button>
                                )}
                            >
                                {searchQuery.trim()
                                    ? 'Clear the search or try a different name.'
                                    : `Use Add Card to add cards to this ${listLabel.toLowerCase()}.`}
                            </EmptyState>
                        </Panel>
                    )}

                    {!loading && filtered.length > 0 && (
                        <BinderEntryList
                            entries={filtered}
                            resolveCard={resolveCard}
                            resetKey={`${openBinderId || 'wants'}|${sort}|${searchQuery}`}
                            catalogById={catalogById}
                            editionsByCardId={editionsByCardId}
                            busyCardId={busyCardId}
                            variant="owned"
                            isWanted={viewingWants}
                            onOpenDetail={openEntryDetail}
                            onChangeVersion={changeVersion}
                            onUpdateQuantity={updateQuantity}
                            onRemove={handleRemove}
                            onMove={viewingWants ? undefined : handleMove}
                        />
                    )}
                    </>
                    )}
            </Page>

            <FabraryImportDialog
                open={importOpen}
                onClose={() => setImportOpen(false)}
                onImported={async () => {
                    await loadBinders();
                    await loadEntries();
                }}
            />

            <SearchDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                title={viewingWants ? 'Add to Want List' : 'Add to Binder'}
                items={cardOptions}
                onSelect={handleAddCard}
                keepOpenOnSelect
                keepInputOnSelect
            />

            <Dialog
                open={shareOpen}
                onClose={() => !shareBusy && setShareOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Share binder</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: mutedColor, fontSize: '0.875rem', mb: 2 }}>
                        Anyone with this link can view your binder (not your want list). Turn sharing
                        off or regenerate the link anytime.
                    </Typography>
                    {shareBusy && !share ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : (
                        <>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={Boolean(share?.isEnabled)}
                                        onChange={(e) => toggleShareEnabled(e.target.checked)}
                                        disabled={shareBusy || !share}
                                    />
                                }
                                label={share?.isEnabled ? 'Sharing on' : 'Sharing off'}
                                sx={{ mb: 1.5, color: textColor }}
                            />
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <TextField
                                    value={share?.url || ''}
                                    fullWidth
                                    size="small"
                                    InputProps={{ readOnly: true }}
                                    disabled={!share?.isEnabled}
                                />
                                <Button
                                    variant="contained"
                                    startIcon={<ContentCopyIcon />}
                                    onClick={copyShareLink}
                                    disabled={shareBusy || !share?.isEnabled || !share?.url}
                                    sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                                >
                                    Copy
                                </Button>
                            </Box>
                        </>
                    )}
                    <Divider sx={{ my: 2.5 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 0.75, color: textColor }}>
                        Copy binder as text
                    </Typography>
                    <Typography sx={{ color: mutedColor, fontSize: '0.875rem', mb: 1.5 }}>
                        Copy a list of the cards in this binder to paste into Discord, notes, or a spreadsheet.
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<ContentCopyIcon />}
                        onClick={copyBinderAsText}
                        data-testid="copy-binder-text"
                    >
                        Copy Binder as Text
                    </Button>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'space-between' }}>
                    <Button
                        onClick={handleRegenerateShare}
                        disabled={shareBusy || !share}
                        color="inherit"
                    >
                        New link
                    </Button>
                    <Button onClick={() => setShareOpen(false)} disabled={shareBusy}>
                        Done
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(pendingClear?.clientId)}
                onClose={() => {
                    if (!clearBusy) setPendingClear(null);
                }}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Clear {pendingClear?.name}?</DialogTitle>
                <DialogContent>
                    <Typography data-testid="binder-clear-copy">
                        {pendingClearCopies > 0
                            ? `This will remove ${pendingClearCopies} ${pendingClearCopies === 1 ? 'card' : 'cards'} from ${pendingClear?.name}. The binder stays. This cannot be undone.`
                            : 'This cannot be undone.'}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        color="inherit"
                        data-testid="binder-clear-cancel"
                        onClick={() => setPendingClear(null)}
                        disabled={clearBusy}
                    >
                        Cancel
                    </Button>
                    <Button
                        data-testid="binder-clear-confirm"
                        onClick={confirmClearBinder}
                        color="error"
                        variant="contained"
                        disabled={clearBusy}
                    >
                        {clearBusy ? 'Clearing…' : 'Clear'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(pendingDelete)}
                onClose={() => setPendingDelete(null)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
                <DialogContent>
                    <Typography data-testid="binder-delete-copy">
                        {pendingDeleteCopies > 0
                            ? `This will also remove ${pendingDeleteCopies} ${pendingDeleteCopies === 1 ? 'card' : 'cards'} from your collection. This cannot be undone.`
                            : 'This cannot be undone.'}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        color="inherit"
                        data-testid="binder-delete-cancel"
                        onClick={() => setPendingDelete(null)}
                    >
                        Cancel
                    </Button>
                    <Button
                        data-testid="binder-delete-confirm"
                        onClick={confirmDeleteBinder}
                        color="error"
                        variant="contained"
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={Boolean(toast)}
                autoHideDuration={3000}
                onClose={() => setToast('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setToast('')}
                    severity="success"
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {toast}
                </Alert>
            </Snackbar>
        </>
    );
};

export default BinderCollection;
