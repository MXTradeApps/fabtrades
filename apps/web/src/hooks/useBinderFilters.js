import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCardData } from './useCardData.jsx';
import { getSetLogosByName, loadSetLogoMap } from '../utils/setLogos.js';
import {
    activeFilterCount,
    buildBinderFilterOptions,
    filtersFromParams,
    paramsWithFilters,
    toggleBinderFilter,
    EMPTY_BINDER_FILTERS,
    FILTER_GROUPS,
} from '../utils/binderFilters.js';

/**
 * Rarity / foiling / set filters for a list of Binder entries, kept in the
 * URL query so a filtered link opens filtered. Options only list values
 * present in `entries`; URL values that match nothing in this Binder are
 * ignored. `matchesSearch(entry, card)` narrows the option counts.
 */
export function useBinderFilters(entries, resolveCard, matchesSearch) {
    const { sets } = useCardData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [logoByGroupId, setLogoByGroupId] = useState({});
    const [logosByName, setLogosByName] = useState({});

    useEffect(() => {
        let cancelled = false;
        // Set logos are decoration; tiles fall back to the set name without them.
        loadSetLogoMap()
            .then((logos) => {
                if (cancelled) return;
                setLogoByGroupId(logos || {});
                setLogosByName(getSetLogosByName());
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    const paramsKey = searchParams.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const urlFilters = useMemo(() => filtersFromParams(searchParams), [paramsKey]);

    const { filters, options } = useMemo(() => {
        const context = { sets, logosByName, matchesSearch };
        const first = buildBinderFilterOptions(entries, resolveCard, { ...context, filters: urlFilters });
        // Until entries load there is nothing to check URL values against.
        if (!entries?.length) return { filters: urlFilters, options: first };
        const effective = Object.fromEntries(FILTER_GROUPS.map((group) => {
            const ids = new Set(first[group].map((o) => o.id));
            return [group, urlFilters[group].filter((v) => ids.has(v))];
        }));
        const unchanged = FILTER_GROUPS.every((g) => effective[g].length === urlFilters[g].length);
        if (unchanged) return { filters: urlFilters, options: first };
        return {
            filters: effective,
            options: buildBinderFilterOptions(entries, resolveCard, { ...context, filters: effective }),
        };
    }, [entries, resolveCard, sets, logosByName, matchesSearch, urlFilters]);

    const setFilters = useCallback((next) => {
        setSearchParams((prev) => paramsWithFilters(prev, next), { replace: true });
    }, [setSearchParams]);

    const toggle = useCallback(
        (group, value) => setFilters(toggleBinderFilter(filters, group, value)),
        [filters, setFilters],
    );

    const clear = useCallback(() => setFilters(EMPTY_BINDER_FILTERS), [setFilters]);

    return {
        filters,
        options,
        activeCount: activeFilterCount(filters),
        toggle,
        clear,
        logoByGroupId,
    };
}

export default useBinderFilters;
