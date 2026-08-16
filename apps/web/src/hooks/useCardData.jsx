// CardDataContext.js
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { fetchCatalog } from '../services/fabDb.js';
// Create context
const CardDataContext = createContext();

// Custom hook to use the context
export const useCardData = () => {
    const context = useContext(CardDataContext);
    if (context === undefined) {
        throw new Error('useCardData must be used within a CardDataProvider');
    }
    return context;
};

// Official Flesh & Blood card CDN. We always source images from here so the
// app has a single, predictable image origin (no per-render fallback chain).
// The URL pattern is `{base}/{setCode}[suffix].webp`, where suffix is `-CF`
// for cold foil printings and `-RF` for rainbow foil printings.
const FAB_CDN_BASE = 'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large';

// Extract the first usable set code from an extNumber value. Some cards have
// composite numbers like "SUP010 // SUP072" or "SEA045//SEA247".
const getPrimaryExtNumber = (extNumber) => {
    if (!extNumber) return '';
    const cleaned = String(extNumber).split(/\s*\/\/\s*|\s*\/\s*/)[0];
    return cleaned ? cleaned.trim() : '';
};

// Build the canonical FAB CDN image URL for a card based on its set code and
// printing. Returns an empty string when there is no usable extNumber.
const buildFabImageUrl = (extNumber, subTypeName) => {
    const code = getPrimaryExtNumber(extNumber);
    if (!code) return '';
    const sub = (subTypeName || '').toLowerCase();
    let suffix = '';
    if (sub.includes('cold foil')) suffix = '-CF';
    else if (sub.includes('rainbow foil')) suffix = '-RF';
    return `${FAB_CDN_BASE}/${code}${suffix}.webp`;
};

// Function to check if an item is an actual card (not a product like booster box, pack, etc.)
const isActualCard = (row) => {
    const cardType = (row.extCardType || '').trim();
    const cardNumber = (row.extNumber || '').trim();
    const rarity = (row.extRarity || '').trim();
    const cardClass = (row.extClass || '').trim();
    
    // Include if card has a card type (most common case)
    if (cardType !== '') return true;
    
    // Also include if card has a card number AND (rarity OR class)
    // This catches cards with incomplete data like "Imposing Visage"
    if (cardNumber !== '' && (rarity !== '' || cardClass !== '')) {
        return true;
    }
    
    return false;
};

// Function to safely get a value from a row with fallback options
const getValue = (row, possibleKeys, defaultValue = '') => {
    for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== '') {
            return row[key];
        }
    }
    return defaultValue;
};

// Function to safely get a numeric value
const getNumericValue = (row, possibleKeys, defaultValue = 0) => {
    const value = getValue(row, possibleKeys, defaultValue);
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

const getNullableNumeric = (row, possibleKeys) => {
    const value = getValue(row, possibleKeys, null);
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
};

// Function to safely get an integer value
const getIntegerValue = (row, possibleKeys, defaultValue = 0) => {
    const value = getValue(row, possibleKeys, defaultValue);
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

// Function to create a standardized card object from a catalog row.
const createCardObject = (row) => {
    // Rows arrive from the database already mapped to the legacy TCGCSV
    // column names, so we mainly ensure proper data types and display name.
    const card = {
        // Core properties - convert strings to appropriate types where needed
        productId: row.productId || '',
        name: row.name || '',
        groupId: row.groupId || '',
        // Prefer the canonical FAB CDN image, but fall back to the source
        // (TCGplayer) image when the CDN has no file for this card (e.g. heroes,
        // tokens, and promos whose set codes the CDN doesn't host).
        imageUrl: buildFabImageUrl(row.extNumber, row.subTypeName) || (row.imageUrl || ''),
        imageUrlFallback: row.imageUrl || '',

        // Price properties - ensure they're numbers
        lowPrice: getNumericValue(row, ['lowPrice']),
        midPrice: getNumericValue(row, ['midPrice']),
        highPrice: getNumericValue(row, ['highPrice']),
        marketPrice: getNumericValue(row, ['marketPrice']),
        directLowPrice: getNumericValue(row, ['directLowPrice']),
        // CardMarket stays nullable so unpriced is not coerced to 0 before display.
        cardmarketTrend: getNullableNumeric(row, ['cardmarketTrend']),
        cardmarketLow: getNullableNumeric(row, ['cardmarketLow']),
        cardmarketAvg: getNullableNumeric(row, ['cardmarketAvg']),
        cardmarketTrendFoil: getNullableNumeric(row, ['cardmarketTrendFoil']),
        cardmarketLowFoil: getNullableNumeric(row, ['cardmarketLowFoil']),
        cardmarketAvgFoil: getNullableNumeric(row, ['cardmarketAvgFoil']),

        // Card properties
        subTypeName: row.subTypeName || '',
        extRarity: row.extRarity || '',
        extNumber: row.extNumber || '',
        extCardType: row.extCardType || '',
        extCardSubType: row.extCardSubType || '',
        extClass: row.extClass || '',
        extIntellect: getIntegerValue(row, ['extIntellect']),
        extLife: getIntegerValue(row, ['extLife']),
        extCost: getIntegerValue(row, ['extCost']),
        extPitchValue: getIntegerValue(row, ['extPitchValue']),
        extPower: getIntegerValue(row, ['extPower']),
        extDefenseValue: getIntegerValue(row, ['extDefenseValue']),
        extTalent: row.extTalent || '',
        extFlavorText: row.extFlavorText || '',

        // Additional properties
        color: row.color || '',
        artist: row.artist || '',

        // Metadata
        _setName: row._setName || '',
        _setNumber: row._setNumber || 0,
        _uniqueId: row._uniqueId || '',

        // Computed properties for display
        displayName: '',
        sourceUrl: `set_${row._setNumber}` // Use set number as source identifier
    };

    // Create display name based on available data
    const name = card.name || '';
    const edition = card.subTypeName || card.color || '';
    card.displayName = edition ? `${name} (${edition})` : name;

    return card;
};

// Function to process JSON records and filter for actual cards
const processJsonData = (jsonData) => {
    const allCards = [];

    jsonData.forEach(row => {
        // Only process actual cards
        if (isActualCard(row)) {
            const card = createCardObject(row);
            if (card.name && card.name.trim()) {
                allCards.push(card);
            }
        }
    });

    return allCards;
};

// Function to enhance display names with edition info
const enhanceDisplayNames = (cards) => {
    return cards.map(card => {
        const extNumber = card.extNumber || '';
        const subTypeName = card.subTypeName || '';
        
        // Create base display name
        let enhancedName = card.name;
        if (extNumber) {
            enhancedName += ` (${extNumber})`;
        }
        
        // For uniqueness in data structures, append subTypeName to internal ID
        // but keep displayName clean (without showing the foil type as text)
        const uniqueId = `${enhancedName}|${subTypeName}`;

        return {
            ...card,
            displayName: enhancedName,
            _uniqueDisplayId: uniqueId  // Internal ID that includes edition info
        };
    });
};

// Function to group cards by display name and their editions.
// Market is the canonical trade/list price; low is kept for the secondary display.
const groupCardsByEdition = (cards) => {
    const grouped = {};

    cards.forEach(card => {
        const displayName = card.displayName || card.name;

        if (!grouped[displayName]) {
            grouped[displayName] = {
                name: displayName,
                editions: []
            };
        }

        // Check if this edition already exists
        const existingEdition = grouped[displayName].editions.find(
            e => e.subTypeName === card.subTypeName && e.productId === card.productId
        );

        if (!existingEdition) {
            grouped[displayName].editions.push({
                subTypeName: card.subTypeName,
                productId: card.productId,
                cardPrice: card.marketPrice,
                lowPrice: card.lowPrice,
                uniqueId: card._uniqueId,
                imageUrl: card.imageUrl || '',
                imageUrlFallback: card.imageUrlFallback || ''
            });
        }
    });

    return Object.values(grouped);
};

// Main provider component
export const CardDataProvider = ({ children }) => {
    const [cards, setCards] = useState([]);
    const [sets, setSets] = useState([]); // Set metadata, loaded with the catalog
    const [cardIdLookup, setCardIdLookup] = useState({}); // Lookup map for unique IDs
    const [loading, setLoading] = useState(false); // Changed to false for instant page load
    const [dataReady, setDataReady] = useState(false); // New state to track when data is fully loaded
    const [error, setError] = useState(null);
    const [dataSource, setDataSource] = useState(''); // Track what data source is being used
    const [metadata, setMetadata] = useState(null); // Store metadata about the loaded data

    useEffect(() => {
        const loadCardData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Load the full catalog (cards, sets and prices) — from the
                // build-time snapshot when there is one, otherwise straight from
                // Supabase. Rows arrive pre-mapped to the legacy
                // consolidated-data column names either way.
                const { rows, sets: setGroups, pricesUpdatedAt } = await fetchCatalog();
                setSets(setGroups || []);
                setDataSource('supabase');
                setMetadata({
                    totalRecords: rows.length,
                    generatedAt: pricesUpdatedAt,
                    source: 'supabase'
                });

                const allCards = processJsonData(rows);
                const enhancedCards = enhanceDisplayNames(allCards);

                // Create unique ID lookup map
                const idLookup = {};
                enhancedCards.forEach(card => {
                    if (card._uniqueId) {
                        idLookup[card._uniqueId] = card;
                    }
                });

                setCards(enhancedCards);
                setCardIdLookup(idLookup);

            } catch (err) {
                console.error('Error loading card data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
                setDataReady(true); // Mark data as ready when loading completes
            }
        };

        // Start loading immediately in the background
        loadCardData();
    }, []);

    const cardGroups = useMemo(() => {
        if (cards.length === 0) return [];
        return groupCardsByEdition(cards);
    }, [cards]);

    const value = useMemo(() => ({
        cards,
        cardGroups,
        // Sets and the price timestamp arrive with the catalog, so every consumer
        // reads them from here rather than issuing its own query.
        sets,
        pricesUpdatedAt: metadata?.generatedAt ?? null,
        cardIdLookup,
        loading,
        dataReady,
        error,
        dataSource,
        metadata
    }), [cards, cardGroups, sets, cardIdLookup, loading, dataReady, error, dataSource, metadata]);

    return (
        <CardDataContext.Provider value={value}>
            {children}
        </CardDataContext.Provider>
    );
};