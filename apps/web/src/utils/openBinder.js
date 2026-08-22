import { TRADE_BINDER_ID } from '../services/binder.js';

let openBinderId = null;

export function setOpenBinderId(id) {
    openBinderId = id || null;
}

export function getOpenBinderId() {
    return openBinderId;
}

export function targetOwnedBinderId() {
    return openBinderId || TRADE_BINDER_ID;
}
