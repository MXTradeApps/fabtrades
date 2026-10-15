import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,

    CircularProgress,
    FormControl,
    MenuItem,
    Select,
    Snackbar,
    Typography,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useCardData } from '../hooks/useCardData.jsx';
import { useCardDetail } from '../contexts/CardDetailContext.jsx';
import Header from '../components/elements/Header.jsx';
import { Page, PageHeader, Panel, EmptyState } from '../components/layout/Page.jsx';
import { SortRounded, LinkOffRounded, CollectionsBookmarkOutlined } from '@mui/icons-material';
import { getPublicBinder } from '../services/binder.js';
import { formatCurrency } from '../utils/helpers.js';
import { addCardToTradeDraft } from '../utils/tradeDraft.js';
import BinderEntryList from '../components/binder/BinderEntryList.jsx';

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
const SharedBinder = () => {
    const { token } = useParams();
    const { openDetail } = useCardDetail();
    const { cards, pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sort, setSort] = useState('priceDesc');
    const [toast, setToast] = useState('');


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
            } else {
                setEntries(data.entries || []);
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
                    title="Shared Binder"
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
                        <BinderEntryList
                            entries={sorted}
                            resolveCard={resolveCard}
                            resetKey={`${token}|${sort}`}
                            catalogById={catalogById}
                            variant="shared"
                            onOpenDetail={openEntryDetail}
                            onAddToTrade={handleAddToTrade}
                        />
                    )
                )}
            </Page>

            <Snackbar
                open={Boolean(toast)}
                autoHideDuration={2500}
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

export default SharedBinder;
