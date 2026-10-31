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
} from '../utils/binderFilters.js';

/**
 * Rarity / foiling / set filters for a list of Binder entries, kept in the
 * URL query so a filtered link opens filtered. Options only list values
 * present in `entries`.
 */
export function useBinderFilters(entries, resolveCard) {
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
    const filters = useMemo(() => filtersFromParams(searchParams), [paramsKey]);

    const options = useMemo(
        () => buildBinderFilterOptions(entries, resolveCard, sets, logosByName),
        [entries, resolveCard, sets, logosByName],
    );

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
