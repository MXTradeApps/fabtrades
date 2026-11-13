/**
 * URL encoding utilities for sharing trades.
 *
 * A shared link carries the trade as a `trade` query param: base64 of the
 * minimal JSON payload `{ v, t, h, w }`. Decoding reverses that exactly —
 * base64 → UTF-8 → JSON. (An earlier "compression" scheme applied lossy
 * single-letter substitutions to card names; it had no encoder counterpart
 * and corrupted normal names, so it was removed.)
 */

// Decode a base64 string that encodes UTF-8 bytes back into a JS string,
// without relying on the deprecated `escape`/`unescape` globals.
function base64ToUtf8(b64) {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Encode a JS string into base64 of its UTF-8 bytes (inverse of base64ToUtf8).
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Encodes the current trade as a shareable URL.
 *
 * Produces the exact payload `decodeTradeFromURL` expects: base64 JSON
 * `{ v: 1, t: <minutes>, h: [[uniqueId|name, price, quantity], ...], w: [...] }`.
 *
 * @param {Array} haveList - Cards on the "Cards I Have" side
 * @param {Array} wantList - Cards on the "Cards I Want" side
 * @returns {string|null} Absolute URL, or null when the trade is empty
 */
export function encodeTradeToURL(haveList = [], wantList = []) {
  const toMinimal = (list) =>
    (Array.isArray(list) ? list : []).map((card) => [
      card.uniqueId || card.name,
      Number(card.price) || 0,
      card.quantity || 1
    ]);

  const have = toMinimal(haveList);
  const want = toMinimal(wantList);
  if (have.length === 0 && want.length === 0) return null;

  const payload = {
    v: 1,
    t: Math.round(Date.now() / 60000),
    h: have,
    w: want
  };

  const encoded = utf8ToBase64(JSON.stringify(payload));
  const url = new URL(window.location.origin);
  url.searchParams.set('trade', encoded);
  return url.toString();
}

/**
 * Decodes trade data from URL
 * @returns {Object|null} Trade data or null if invalid
 */
export function decodeTradeFromURL() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tradeParam = urlParams.get('trade');

    if (!tradeParam) {
      return null;
    }

    // Tolerate older, double-encoded links. `URLSearchParams` already decodes
    // one layer of percent-encoding; a second decode is a no-op for raw base64.
    let decoded = tradeParam;
    try {
      decoded = decodeURIComponent(tradeParam);
    } catch {
      decoded = tradeParam;
    }

    let json;
    try {
      json = base64ToUtf8(decoded);
    } catch (error) {
      console.error('Failed to base64-decode trade data:', error);
      return null;
    }

    let tradeData;
    try {
      tradeData = JSON.parse(json);
    } catch (error) {
      console.error('Failed to parse trade data JSON:', error);
      return null;
    }

    // Validate version
    if (!tradeData.v || tradeData.v > 1) {
      console.warn('Unsupported trade data version:', tradeData.v);
      return null;
    }

    // Timestamps are stored in minutes; convert back to milliseconds.
    const timestamp = tradeData.t ? tradeData.t * 60000 : null;
    const ageInDays = timestamp
      ? (Date.now() - timestamp) / (1000 * 60 * 60 * 24)
      : null;

    return {
      version: tradeData.v,
      timestamp,
      have: tradeData.h || [],
      want: tradeData.w || [],
      ageInDays
    };
  } catch (error) {
    console.error('Failed to decode trade from URL:', error);
    return null;
  }
}

/**
 * Normalizes card names for better matching
 * @param {string} cardName - Card name to normalize
 * @returns {string} Normalized card name
 */
function normalizeCardName(cardName) {
  return cardName
    .toLowerCase()
    .replace(/\s+/g, ' ')           // Normalize spaces
    .replace(/[^\w\s()]/g, '')      // Keep only alphanumeric, spaces, and parentheses
    .trim();
}

/**
 * Finds the best matching card group using multiple strategies
 * @param {string} cardName - Card name to find
 * @param {Array} cardGroups - Available card groups
 * @returns {Object|null} Best matching card group
 */
function findBestCardMatch(cardName, cardGroups) {
  const normalizedSearchName = normalizeCardName(cardName);
  
  // Strategy 1: Exact match
  let match = cardGroups.find(group => 
    normalizeCardName(group.name) === normalizedSearchName
  );
  if (match) return { group: match, strategy: 'exact' };
  
  // Strategy 2: Base name match (remove edition info)
  const baseName = cardName.replace(/\s*\([^)]*\).*$/, '').trim();
  const normalizedBaseName = normalizeCardName(baseName);
  
  match = cardGroups.find(group => {
    const groupBaseName = group.name.replace(/\s*\([^)]*\).*$/, '').trim();
    return normalizeCardName(groupBaseName) === normalizedBaseName;
  });
  if (match) return { group: match, strategy: 'base-name' };
  
  // Strategy 3: Substring matching
  match = cardGroups.find(group => {
    const normalizedGroupName = normalizeCardName(group.name);
    return normalizedGroupName.includes(normalizedBaseName) || 
           normalizedBaseName.includes(normalizedGroupName);
  });
  if (match) return { group: match, strategy: 'substring' };
  
  // Strategy 4: Word-based matching (for complex names)
  const searchWords = normalizedBaseName.split(/\s+/).filter(w => w.length > 2);
  if (searchWords.length > 1) {
    match = cardGroups.find(group => {
      const groupWords = normalizeCardName(group.name).split(/\s+/);
      const matchingWords = searchWords.filter(word => 
        groupWords.some(groupWord => groupWord.includes(word) || word.includes(groupWord))
      );
      return matchingWords.length >= Math.min(2, searchWords.length);
    });
    if (match) return { group: match, strategy: 'word-based' };
  }
  
  return null;
}

/**
 * Reconstructs full card objects from minimal URL data
 * @param {Array} cardData - Minimal card data from URL
 * @param {Array} cardGroups - Available card groups from the app
 * @param {Object} cardIdLookup - Lookup map for unique IDs
 * @returns {Array} Reconstructed card objects
 */
export function reconstructCardsFromURLData(cardData, cardGroups, cardIdLookup = {}) {
  if (!cardData || !Array.isArray(cardData)) {
    return [];
  }

  return cardData.reduce((validCards, urlCard) => {
    try {
      // Handle both array format [id/name, price, quantity] and object format {n, p, q}
      let cardIdentifier, cardPrice, cardQuantity;
      
      if (Array.isArray(urlCard)) {
        // New array format: [id/name, price, quantity?]
        [cardIdentifier, cardPrice, cardQuantity] = urlCard;
        cardQuantity = cardQuantity || 1; // default to 1 if not specified
      } else {
        // Legacy object format: {n: name, p: price, q: quantity}
        cardIdentifier = urlCard.n;
        cardPrice = urlCard.p;
        cardQuantity = urlCard.q || 1;
      }
      
      let matchedCard = null;
      let cardGroup = null;

      // Strategy 1: Try unique ID lookup first (fastest and most reliable)
      if (cardIdLookup[cardIdentifier]) {
        matchedCard = cardIdLookup[cardIdentifier];
        // Find the card group that contains this card
        cardGroup = cardGroups.find(group =>
          group.name === matchedCard.displayName
        );
      }

      // Strategy 2: Fallback to name-based matching for legacy URLs
      if (!cardGroup) {
        const matchResult = findBestCardMatch(cardIdentifier, cardGroups);
        if (matchResult) {
          cardGroup = matchResult.group;
        }
      }

      if (!cardGroup) {
        console.warn(`Card not found in current data after all matching attempts: ${cardIdentifier}`);
        return validCards;
      }
      
      if (!cardGroup.editions || cardGroup.editions.length === 0) {
        console.warn(`Card group found but has no editions: ${cardGroup.name}`);
        return validCards;
      }

      // The id in the link names the exact printing, so it wins. Price is only
      // a fallback for legacy name-based links: prices move daily, and matching
      // on price alone turned a shared foil into the Normal printing as soon
      // as its price changed.
      let selectedEdition = cardGroup.editions[0]; // default
      const matchingEdition =
        cardGroup.editions.find(edition => edition.uniqueId === cardIdentifier) ||
        cardGroup.editions.find(edition =>
          Math.abs(edition.cardPrice - cardPrice) < 0.01
        );
      if (matchingEdition) {
        selectedEdition = matchingEdition;
      }

      const reconstructedCard = {
        name: cardGroup.name, // Use canonical name from card group
        price: cardPrice,
        lowPrice: selectedEdition.lowPrice,
        quantity: Math.max(1, parseInt(cardQuantity) || 1), // Ensure valid quantity
        cardGroup,
        availableEditions: cardGroup.editions,
        uniqueId: selectedEdition.uniqueId, // Include unique ID for future operations
        subTypeName: selectedEdition.subTypeName || 'Normal',
        imageUrl: selectedEdition.imageUrl || '',
        imageUrlFallback: selectedEdition.imageUrlFallback || ''
      };

      validCards.push(reconstructedCard);
    } catch (error) {
      console.warn(`Failed to reconstruct card:`, error);
    }
    
    return validCards;
  }, []);
}

/**
 * Validates if the current URL contains trade data
 * @returns {boolean} True if URL contains valid trade data
 */
export function hasTradeDataInURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('trade');
}

/**
 * Clears trade data from URL without page reload
 */
export function clearTradeFromURL() {
  if (window.history && window.history.replaceState) {
    const url = new URL(window.location);
    url.searchParams.delete('trade');
    window.history.replaceState({}, '', url);
  }
}
