/**
 * Search Utilities for FAB Trades
 * Helper functions for card searching and filtering
 * Optimized for performance with large card databases
 */

// Cache for normalized strings to avoid repeated computation
const normalizeCache = new Map();
const MAX_CACHE_SIZE = 5000;

/**
 * Normalize a string for fuzzy matching (with caching)
 * - Lowercase
 * - Remove special characters (apostrophes, hyphens, etc.)
 * - Collapse multiple spaces
 */
const normalizeForSearch = (str) => {
    if (!str) return '';
    
    // Check cache first
    const cached = normalizeCache.get(str);
    if (cached !== undefined) return cached;
    
    const normalized = str
        .toLowerCase()
        .replace(/[''`\-–—]/g, '')  // Remove apostrophes and hyphens
        .replace(/[^\w\s]/g, '')    // Remove other special chars
        .replace(/\s+/g, ' ')       // Collapse multiple spaces
        .trim();
    
    // Cache the result (with size limit)
    if (normalizeCache.size < MAX_CACHE_SIZE) {
        normalizeCache.set(str, normalized);
    }
    
    return normalized;
};

/**
 * Filter card options based on search input - OPTIMIZED
 * @param {Array} options - Array of card option objects
 * @param {string} searchTerm - Search string
 * @param {number} limit - Maximum number of results to return
 * @returns {Array} Filtered options
 */
export const filterCardOptions = (options, searchTerm, limit = 10) => {
    if (!searchTerm || searchTerm.trim() === '') {
        return options.slice(0, Math.min(limit, 20));
    }

    const lowerTerm = searchTerm.toLowerCase();
    const normalizedTerm = normalizeForSearch(searchTerm);
    const searchWords = normalizedTerm.split(' ').filter(w => w.length > 0);
    
    if (searchWords.length === 0) {
        return options.slice(0, Math.min(limit, 20));
    }
    
    // Use first word for quick filtering
    const firstWord = searchWords[0];
    const hasMultipleWords = searchWords.length > 1;
    
    // Score and filter in a single pass
    const scored = [];
    const maxResults = limit * 5; // Collect more than needed for better sorting
    
    for (let i = 0; i < options.length && scored.length < maxResults; i++) {
        const option = options[i];
        const label = option.label || '';
        
        // Quick length check - skip if label is shorter than search
        if (label.length < normalizedTerm.length - 5) continue;
        
        // Fast path: check if lowercase label contains the search term
        const lowerLabel = label.toLowerCase();
        const containsTerm = lowerLabel.includes(lowerTerm);
        
        // Get normalized label for word matching
        const normalizedLabel = normalizeForSearch(label);
        
        // Quick first word check
        if (!normalizedLabel.includes(firstWord)) continue;
        
        // If multiple words, check all words exist
        if (hasMultipleWords) {
            let allWordsFound = true;
            for (let j = 1; j < searchWords.length; j++) {
                if (!normalizedLabel.includes(searchWords[j])) {
                    allWordsFound = false;
                    break;
                }
            }
            if (!allWordsFound) continue;
        }
        
        // Calculate score inline (faster than separate function call)
        let score = 0;
        
        // Exact match bonus
        if (normalizedLabel === normalizedTerm) {
            score += 1000;
        }
        // Contains original term as-is
        else if (containsTerm) {
            score += 500;
        }
        
        // Starts with first word
        if (normalizedLabel.startsWith(firstWord)) {
            score += 200;
        }
        
        // Words in order bonus
        if (hasMultipleWords) {
            let lastIdx = -1;
            let inOrder = true;
            for (const word of searchWords) {
                const idx = normalizedLabel.indexOf(word, lastIdx + 1);
                if (idx === -1 || idx <= lastIdx) {
                    inOrder = false;
                    break;
                }
                lastIdx = idx;
            }
            if (inOrder) score += 100;
        } else {
            score += 100; // Single word always "in order"
        }
        
        // Shorter labels = more specific = better
        score += Math.max(0, 50 - label.length);
        
        scored.push({ option, score, label });
    }
    
    // Sort by score (descending), then alphabetically
    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.label.localeCompare(b.label);
    });
    
    // Return just the options
    return scored.slice(0, limit).map(s => s.option);
};

/**
 * Catalog-wide Printing search for Trends and Browse Sets. Does not cap at the
 * trade-autocomplete 10; callers pass a high limit when they want every match.
 *
 * @param {Array<object>} cards
 * @param {string} searchTerm
 * @param {number} [limit=200]
 * @returns {Array<object>} snapshot Printings
 */
export const matchPrintings = (cards, searchTerm, limit = 200) => {
    if (!searchTerm || !String(searchTerm).trim()) return [];
    const options = (cards || []).map((card) => ({
        label: card.displayName || card.name || '',
        subTypeName: card.subTypeName,
        setName: card._setName || '',
        card,
    }));
    return filterCardOptions(options, searchTerm, limit).map((option) => option.card);
};

/**
 * Highlight matching text in a string - OPTIMIZED
 * Simple substring highlighting without complex position mapping
 * @param {string} text - Original text
 * @param {string} searchTerm - Term to highlight
 * @returns {Array} Array of text segments with highlight flags
 */
export const highlightMatch = (text, searchTerm) => {
    if (!searchTerm || !text) {
        return [{ text, highlight: false }];
    }

    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    if (searchWords.length === 0) {
        return [{ text, highlight: false }];
    }

    const lowerText = text.toLowerCase();
    
    // Find all match ranges
    const ranges = [];
    for (const word of searchWords) {
        let idx = lowerText.indexOf(word);
        while (idx !== -1) {
            ranges.push({ start: idx, end: idx + word.length });
            idx = lowerText.indexOf(word, idx + 1);
        }
    }
    
    if (ranges.length === 0) {
        return [{ text, highlight: false }];
    }
    
    // Sort and merge overlapping ranges
    ranges.sort((a, b) => a.start - b.start);
    const merged = [ranges[0]];
    for (let i = 1; i < ranges.length; i++) {
        const last = merged[merged.length - 1];
        const curr = ranges[i];
        if (curr.start <= last.end) {
            last.end = Math.max(last.end, curr.end);
        } else {
            merged.push(curr);
        }
    }
    
    // Build segments
    const segments = [];
    let pos = 0;
    for (const range of merged) {
        if (range.start > pos) {
            segments.push({ text: text.slice(pos, range.start), highlight: false });
        }
        segments.push({ text: text.slice(range.start, range.end), highlight: true });
        pos = range.end;
    }
    if (pos < text.length) {
        segments.push({ text: text.slice(pos), highlight: false });
    }
    
    return segments.length > 0 ? segments : [{ text, highlight: false }];
};

/**
 * Get gradient style based on card foil type
 * FAB-themed warm brown gradients
 * @param {string} subTypeName - Card's subTypeName field (foil type)
 * @param {boolean} isDark - Whether dark mode is active
 * @returns {Object} Object with background and backgroundHover properties
 */
export const getCardGradient = (subTypeName, isDark = false) => {
    const subType = (subTypeName || '').toLowerCase();
    
    // Rainbow Foil - vibrant rainbow gradient
    if (subType.includes('rainbow foil')) {
        if (isDark) {
            return {
                background: 'linear-gradient(135deg, #3a2020 0%, #3a3020 14%, #303a20 28%, #203a30 42%, #203040 57%, #302040 71%, #402030 85%, #3a2020 100%)',
                backgroundHover: 'linear-gradient(135deg, #4a3030 0%, #4a4030 14%, #404a30 28%, #304a40 42%, #304050 57%, #403050 71%, #503040 85%, #4a3030 100%)'
            };
        }
        return {
            background: 'linear-gradient(135deg, #ffe5e5 0%, #fff4e5 14%, #fffee5 28%, #e5ffe5 42%, #e5f4ff 57%, #f0e5ff 71%, #ffe5f0 85%, #ffe5e5 100%)',
            backgroundHover: 'linear-gradient(135deg, #ffd0d0 0%, #ffe8c0 14%, #fffdc0 28%, #d0ffd0 42%, #c0e8ff 57%, #e0c0ff 71%, #ffc0e0 85%, #ffd0d0 100%)'
        };
    }
    
    // Cold Foil - blue/silver metallic gradient
    if (subType.includes('cold foil')) {
        if (isDark) {
            return {
                background: 'linear-gradient(135deg, #1a2a3a 0%, #2a3a4a 20%, #1a3040 40%, #2a4050 60%, #1a3545 80%, #2a3a4a 100%)',
                backgroundHover: 'linear-gradient(135deg, #2a3a4a 0%, #3a4a5a 20%, #2a4050 40%, #3a5060 60%, #2a4555 80%, #3a4a5a 100%)'
            };
        }
        // Soft metallic blue: reads as cold foil without shouting over the page
        return {
            background: 'linear-gradient(135deg, #c5e0f5 0%, #ffffff 20%, #b3d6f0 40%, #eaf4fc 60%, #a6cdeb 80%, #ffffff 100%)',
            backgroundHover: 'linear-gradient(135deg, #b3d6f0 0%, #f2f9ff 20%, #9cc8e8 40%, #ddeefa 60%, #8fc0e4 80%, #eaf4fc 100%)'
        };
    }
    
    // Generic Foil variants
    if (subType.includes('foil') || subType.includes('holo')) {
        if (isDark) {
            return {
                background: 'linear-gradient(135deg, #2a2018 0%, #3a2820 20%, #4a3028 40%, #3a2820 60%, #2a2018 80%, #3a2820 100%)',
                backgroundHover: 'linear-gradient(135deg, #3a3028 0%, #4a3830 20%, #5a4038 40%, #4a3830 60%, #3a3028 80%, #4a3830 100%)'
            };
        }
        return {
            background: 'linear-gradient(135deg, #f5f1ed 0%, #f8f0e8 20%, #faf5f0 40%, #f8f0e8 60%, #f5f1ed 80%, #f8f0e8 100%)',
            backgroundHover: 'linear-gradient(135deg, #efe8e0 0%, #f5ebe0 20%, #f8f0e8 40%, #f5ebe0 60%, #efe8e0 80%, #f5ebe0 100%)'
        };
    }
    
    // Normal cards - clean FAB brown theme
    if (isDark) {
        return {
            background: 'linear-gradient(135deg, #2c1810 0%, #1a0f0a 100%)',
            backgroundHover: 'linear-gradient(135deg, #3d2318 0%, #2c1810 100%)'
        };
    }
    return {
        background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
        backgroundHover: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)'
    };
};

/**
 * Format price for display
 * @param {number} price - Price value
 * @returns {string} Formatted price string
 */
export const formatPrice = (price) => {
    if (price === null || price === undefined || price === 0) {
        return '—';
    }
    return `$${price.toFixed(2)}`;
};

/**
 * Format a card type into a cleaner display name
 */
export const formatCardType = (subTypeName) => {
    if (!subTypeName) return null;
    
    const type = subTypeName.toLowerCase();
    
    // Return clean labels for different types
    if (type.includes('rainbow foil')) return 'Rainbow Foil';
    if (type.includes('cold foil')) return 'Cold Foil';
    if (type.includes('foil')) return 'Foil';
    if (type.includes('promo')) return 'Promo';
    if (type.includes('normal')) return null; // Don't show badge for normal cards
    
    // Return the original if it's something else
    return subTypeName;
};

/**
 * Debounce function for search input
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 300) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};
