/**
 * Colour coding for foiling so printings can be told apart at a glance:
 * rainbow, cold, gold and plain foil each get their own swatch.
 */
export const foilTagStyle = (subTypeName, isDark) => {
    const sub = (subTypeName || '').toLowerCase();
    if (sub.includes('rainbow foil')) {
        return isDark
            ? { background: 'linear-gradient(90deg, rgba(255,120,120,0.24), rgba(255,210,120,0.24), rgba(120,230,160,0.24), rgba(120,190,255,0.24), rgba(200,140,255,0.24))', color: '#F3EDE7' }
            : { background: 'linear-gradient(90deg, #ffe0e0, #fff0d2, #dcf7e2, #d9ecff, #ecdcff)', color: '#1E1612' };
    }
    if (sub.includes('cold foil')) {
        return isDark
            ? { backgroundColor: 'rgba(98, 174, 234, 0.16)', color: '#A9D3F5' }
            : { backgroundColor: '#E3F0FB', color: '#174C7A' };
    }
    if (sub.includes('gold foil')) {
        return isDark
            ? { backgroundColor: 'rgba(232, 182, 59, 0.16)', color: '#F0CF7A' }
            : { backgroundColor: '#FBF0D2', color: '#6B4C00' };
    }
    if (sub.includes('foil') || sub.includes('holo')) {
        return isDark
            ? { backgroundColor: 'rgba(228, 192, 156, 0.14)', color: '#E4C09C' }
            : { backgroundColor: '#F4E9DD', color: '#5D2F0D' };
    }
    return null;
};
