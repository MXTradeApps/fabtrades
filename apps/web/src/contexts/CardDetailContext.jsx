import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const CardDetailContext = createContext(null);

export const useCardDetail = () => {
    const context = useContext(CardDetailContext);
    if (!context) {
        throw new Error('useCardDetail must be used within a CardDetailProvider');
    }
    return context;
};

/**
 * One app-shell session for the card detail overlay.
 * openDetail replaces the current Printing; it never stacks a second dialog.
 * Home registers Want-add on mount and clears it on unmount.
 */
export const CardDetailProvider = ({ children }) => {
    const [open, setOpen] = useState(false);
    const [printing, setPrinting] = useState(null);
    const [hasAddWant, setHasAddWant] = useState(false);
    const addWantRef = useRef(null);

    const openDetail = useCallback((next) => {
        if (!next?._uniqueId) return;
        setPrinting(next);
        setOpen(true);
    }, []);

    const closeDetail = useCallback(() => {
        setOpen(false);
        setPrinting(null);
    }, []);

    const registerAddWant = useCallback((fn) => {
        addWantRef.current = typeof fn === 'function' ? fn : null;
        setHasAddWant(typeof fn === 'function');
        return () => {
            if (addWantRef.current === fn || typeof fn !== 'function') {
                addWantRef.current = null;
                setHasAddWant(false);
            }
        };
    }, []);

    const addWantCard = useCallback((payload) => {
        if (!addWantRef.current) return undefined;
        return addWantRef.current(payload);
    }, []);

    const value = useMemo(
        () => ({
            open,
            printing,
            openDetail,
            closeDetail,
            registerAddWant,
            addWantCard: hasAddWant ? addWantCard : null,
        }),
        [open, printing, openDetail, closeDetail, registerAddWant, addWantCard, hasAddWant],
    );

    return (
        <CardDetailContext.Provider value={value}>
            {children}
        </CardDetailContext.Provider>
    );
};
