import {
  TCGPLAYER_PARTNER_LINK,
  tcgplayerAffiliateUrl,
} from '../../src/utils/tcgplayerAffiliate.js';

describe('tcgplayerAffiliateUrl', () => {
  test('returns null without a product id', () => {
    expect(tcgplayerAffiliateUrl(null)).toBeNull();
    expect(tcgplayerAffiliateUrl(undefined)).toBeNull();
    expect(tcgplayerAffiliateUrl('')).toBeNull();
    expect(tcgplayerAffiliateUrl(0)).toBeNull();
    expect(tcgplayerAffiliateUrl(-12)).toBeNull();
  });

  test('wraps the product page in the partner u param', () => {
    const href = tcgplayerAffiliateUrl(624360);
    expect(href).toMatch(/^https:\/\/partner\.tcgplayer\.com\/c\/7492612\/1780961\/21018\?/);

    const url = new URL(href);
    expect(url.origin + url.pathname).toBe(TCGPLAYER_PARTNER_LINK);
    expect(url.searchParams.get('u')).toBe('https://www.tcgplayer.com/product/624360');
  });

  test('appends Printing for non-Normal finishes', () => {
    const href = tcgplayerAffiliateUrl(624360, { subTypeName: 'Rainbow Foil' });
    const destination = new URL(new URL(href).searchParams.get('u'));
    expect(destination.pathname).toBe('/product/624360');
    expect(destination.searchParams.get('Printing')).toBe('Rainbow Foil');
  });

  test('omits Printing for Normal finish', () => {
    const href = tcgplayerAffiliateUrl(624360, { subTypeName: 'Normal' });
    const destination = new URL(new URL(href).searchParams.get('u'));
    expect(destination.searchParams.has('Printing')).toBe(false);
  });

  test('accepts a custom partner link', () => {
    const href = tcgplayerAffiliateUrl(1, {
      partnerLink: 'https://partner.tcgplayer.com/c/1/2/3',
    });
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe('https://partner.tcgplayer.com/c/1/2/3');
    expect(url.searchParams.get('u')).toBe('https://www.tcgplayer.com/product/1');
  });
});
