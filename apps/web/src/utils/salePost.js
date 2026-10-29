/**
 * "Post for sale" composer: turns Binder cards into a WTS post for the purple
 * FaB Discord or a Facebook selling group.
 *
 * Reimplemented in Dart at `apps/mobile/lib/core/logic/sale_post.dart`. Both are
 * pinned to `packages/contracts/sale_post.json`.
 */
import { foilAbbrev, parseDiscordCardName } from './tradeOffer.js';

/** Discord rejects messages over 2,000 characters. */
export const DISCORD_MESSAGE_LIMIT = 2000;

export const SALE_POST_PERCENTS = [100, 95, 90, 85, 80];

/**
 * Asking price in cents after the percent-of-market discount. At $10 and up it
 * is rounded to whole units, so totals add up to what the post shows.
 * @param {number|null|undefined} price
 * @param {number} percent
 * @returns {number|null}
 */
export const salePriceCents = (price, percent) => {
    const value = Number(price);
    if (price == null || !Number.isFinite(value) || value <= 0) return null;
    const cents = Math.round(value * percent);
    if (cents <= 0) return null;
    return cents >= 1000 ? Math.round(cents / 100) * 100 : cents;
};

/**
 * Whole units at $10 and up, cents below, e.g. "$36" or "$4.50".
 * @param {number} cents
 * @param {string} symbol
 * @returns {string}
 */
export const formatSalePrice = (cents, symbol) => {
    if (cents >= 1000) return `${symbol}${Math.round(cents / 100)}`;
    const whole = Math.floor(cents / 100);
    const rest = String(cents % 100).padStart(2, '0');
    return `${symbol}${whole}.${rest}`;
};

const conditionLabel = (condition) => {
    const value = String(condition || '').trim().toUpperCase();
    return value && value !== 'NM' ? value : '';
};

const fullFinish = (finish) => {
    const value = String(finish || '').trim();
    if (!value || value.toLowerCase() === 'normal') return '';
    return value;
};

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Most valuable first so the post leads with the cards people scroll for.
 */
const sortItems = (items, percent) =>
    items
        .filter((item) => (Number(item.quantity) || 0) > 0)
        .map((item) => ({ ...item, cents: salePriceCents(item.price, percent) }))
        .sort((a, b) => (b.cents ?? -1) - (a.cents ?? -1) || compareText(a.name || '', b.name || ''));

const discordLine = (item, symbol) => {
    const qty = Number(item.quantity) || 1;
    const { baseName, artAbbrev } = parseDiscordCardName(item.name);
    const condition = conditionLabel(item.condition);
    const parts = [];
    if (qty > 1) parts.push(`${qty}x`);
    const foil = foilAbbrev(item.finish);
    if (foil) parts.push(foil);
    if (artAbbrev) parts.push(artAbbrev);
    parts.push(baseName || 'Unknown card');
    if (condition) parts.push(`(${condition})`);
    if (item.cents != null) {
        parts.push(`${formatSalePrice(item.cents, symbol)}${qty > 1 ? ' ea' : ''}`);
    }
    return parts.join(' ');
};

const facebookLine = (item, symbol) => {
    const qty = Number(item.quantity) || 1;
    const { baseName, artAbbrev } = parseDiscordCardName(item.name);
    const details = [artAbbrev, fullFinish(item.finish), conditionLabel(item.condition)].filter(Boolean);
    let line = `${qty > 1 ? `${qty}x ` : ''}${baseName || 'Unknown card'}`;
    if (details.length) line += ` (${details.join(', ')})`;
    if (item.cents != null) {
        line += ` - ${formatSalePrice(item.cents, symbol)}${qty > 1 ? ' each' : ''}`;
    }
    return line;
};

const priceBasis = (percent, sourceLabel, pricedOn) => {
    const market = `${sourceLabel} market`;
    const basis = percent === 100 ? market : `${percent}% of ${market}`;
    return pricedOn ? `${basis} (${pricedOn})` : basis;
};

/**
 * Pack lines into as few messages as fit under `limit`.
 * @param {string[]} blocks
 * @param {number} limit
 * @returns {string[]}
 */
const packMessages = (blocks, limit) => {
    const messages = [];
    let current = '';
    for (const block of blocks) {
        const next = current ? `${current}\n${block}` : block;
        if (current && next.length > limit) {
            messages.push(current);
            current = block;
        } else {
            current = next;
        }
    }
    if (current) messages.push(current);
    return messages.map((message) => message.trim());
};

/**
 * Build the post. Discord posts split into several messages when they would
 * pass Discord's character limit; Facebook posts are always one message.
 *
 * @param {object} options
 * @param {'discord'|'facebook'} options.platform
 * @param {Array<{ name?: string, finish?: string, condition?: string, quantity?: number, price?: number|null }>} options.items
 * @param {number} [options.percent=100] - Asking price as a percent of market
 * @param {string} [options.symbol='$']
 * @param {string} [options.sourceLabel='TCGplayer']
 * @param {string} [options.pricedOn] - Preformatted date, e.g. "Oct 19, 2026"
 * @param {string} [options.link] - Shared Binder URL
 * @param {number} [options.limit=DISCORD_MESSAGE_LIMIT]
 * @returns {string[]}
 */
export const buildSalePost = ({
    platform,
    items = [],
    percent = 100,
    symbol = '$',
    sourceLabel = 'TCGplayer',
    pricedOn = '',
    link = '',
    limit = DISCORD_MESSAGE_LIMIT,
} = {}) => {
    const sorted = sortItems(Array.isArray(items) ? items : [], percent);
    if (sorted.length === 0) return [];

    const cardCount = sorted.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const totalCents = sorted.reduce(
        (sum, item) => sum + (item.cents ?? 0) * (Number(item.quantity) || 1),
        0,
    );
    const cardsLabel = `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`;
    const total = totalCents > 0 ? ` · ${formatSalePrice(totalCents, symbol)} total` : '';
    const basis = priceBasis(percent, sourceLabel, pricedOn);

    if (platform === 'facebook') {
        const lines = [
            'WTS - Flesh and Blood singles',
            `Prices are ${basis}. All NM unless noted. Comment or message me!`,
            '',
            ...sorted.map((item) => facebookLine(item, symbol)),
            '',
            `${cardsLabel}${total}`,
            link ? `Full list: ${link}` : 'Priced on fabtrades.net',
        ];
        return [lines.join('\n')];
    }

    const header = [`**WTS** · prices are ${basis}`, 'All NM unless noted. DM me!', ''].join('\n');
    const footer = ['', `${cardsLabel}${total}`, link ? `Full list: ${link}` : 'Priced on fabtrades.net'].join('\n');
    return packMessages([header, ...sorted.map((item) => discordLine(item, symbol)), footer], limit);
};

export const TRADE_POST_MODES = ['wtt', 'wts'];

/**
 * Build the web trade screen's "Share Trade" post: one plain-text format that
 * reads the same pasted into Discord or a Facebook group.
 *
 * WTT lists "Looking for" from `wants` and "Have" from `items`, unpriced.
 * WTS lists only `items`, priced at `percent` of market, with a total.
 * Either way the post ends with `link`, the shared trade URL, which unfurls
 * into a preview of the trade.
 *
 * Web only for now; it has no Dart twin or shared contract yet.
 *
 * @param {object} options
 * @param {'wtt'|'wts'} [options.mode='wtt']
 * @param {Array} [options.wants] - Cards the poster is looking for (WTT only)
 * @param {Array} [options.items] - Cards the poster has
 * @param {number} [options.percent=100]
 * @param {string} [options.symbol='$']
 * @param {string} [options.sourceLabel='TCGplayer']
 * @param {string} [options.pricedOn]
 * @param {string} [options.link] - Shared trade URL
 * @param {number} [options.limit=DISCORD_MESSAGE_LIMIT]
 * @returns {string[]}
 */
export const buildTradePost = ({
    mode = 'wtt',
    wants = [],
    items = [],
    percent = 100,
    symbol = '$',
    sourceLabel = 'TCGplayer',
    pricedOn = '',
    link = '',
    limit = DISCORD_MESSAGE_LIMIT,
} = {}) => {
    const isSale = mode === 'wts';
    const unpriced = (list) => list.map((item) => ({ ...item, cents: null }));
    const wanted = isSale ? [] : unpriced(sortItems(Array.isArray(wants) ? wants : [], 100));
    const haveSorted = sortItems(Array.isArray(items) ? items : [], percent);
    const have = isSale ? haveSorted : unpriced(haveSorted);
    if (wanted.length === 0 && have.length === 0) return [];

    const line = (item) => discordLine(item, symbol);
    const blocks = [`${isSale ? 'WTS' : 'WTT'} - Flesh and Blood singles`];

    if (isSale) {
        const cardCount = have.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
        const totalCents = have.reduce((sum, item) => sum + (item.cents ?? 0) * (Number(item.quantity) || 1), 0);
        const total = totalCents > 0 ? ` · ${formatSalePrice(totalCents, symbol)} total` : '';
        blocks.push(`Prices are ${priceBasis(percent, sourceLabel, pricedOn)}`, '', ...have.map(line));
        blocks.push('', `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}${total}`);
    } else {
        if (wanted.length) blocks.push('', 'Looking for:', ...wanted.map(line));
        if (have.length) blocks.push('', 'Have:', ...have.map(line));
        blocks.push('');
    }
    blocks.push(isSale ? 'All NM unless noted. DM me!' : 'Looking to trade, all NM unless noted. DM me!');
    blocks.push(link ? `See the trade: ${link}` : 'Made on fabtrades.net');

    // packMessages joins on newlines, so blank spacer lines become empty blocks;
    // fold each one into the line after it so a split never starts with a gap.
    const folded = [];
    for (let i = 0; i < blocks.length; i += 1) {
        if (blocks[i] === '' && i + 1 < blocks.length) {
            folded.push(`\n${blocks[i + 1]}`);
            i += 1;
        } else {
            folded.push(blocks[i]);
        }
    }
    return packMessages(folded, limit);
};
