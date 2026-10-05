import { describe, expect, it } from 'vitest';

import {
  formatClinicPhone,
  instagramHref,
  telHref,
  toClinicPhone,
  whatsAppHref,
} from './clinic-phone.ts';

describe('clinic phones', () => {
  it('stores a typed or pasted mobile as E.164, a pasted 91 stripped', () => {
    expect(toClinicPhone('98250 44120')).toBe('+919825044120');
    expect(toClinicPhone('+91 98250-44120')).toBe('+919825044120');
    expect(toClinicPhone('919825044120')).toBe('+919825044120');
    expect(toClinicPhone('+919825044120')).toBe('+919825044120');
    expect(toClinicPhone(9825044120)).toBe('+919825044120');
  });

  it('refuses anything that is not a 10-digit Indian mobile', () => {
    for (const input of [
      '98250',
      '5825044120',
      '+14155550123',
      'rhea',
      '',
      '0919825044120',
    ]) {
      expect(toClinicPhone(input), input).toBeNull();
    }
  });

  it('shows a stored mobile as the design prints it', () => {
    expect(formatClinicPhone('+919825044120')).toBe('+91 98250 44120');
  });

  it('shows anything that is not an Indian mobile as given', () => {
    expect(formatClinicPhone('+14155550123')).toBe('+14155550123');
    expect(formatClinicPhone('0261 2345678')).toBe('0261 2345678');
  });

  it('links a phone for a call and a WhatsApp chat', () => {
    expect(telHref('+919825044120')).toBe('tel:+919825044120');
    expect(telHref('+91 98250 44120')).toBe('tel:+919825044120');
    expect(whatsAppHref('+919825044120')).toBe('https://wa.me/919825044120');
  });

  it('opens a WhatsApp chat with a message typed, encoded', () => {
    expect(whatsAppHref('+919825044120', 'Hi Rhea, ₹563 is due. Thanks!')).toBe(
      'https://wa.me/919825044120?text=Hi%20Rhea%2C%20%E2%82%B9563%20is%20due.%20Thanks!',
    );
    expect(whatsAppHref('+919825044120', '')).toBe('https://wa.me/919825044120');
  });

  it('links an Instagram handle with or without its @, encoded', () => {
    expect(instagramHref('@rhea.shah')).toBe('https://instagram.com/rhea.shah');
    expect(instagramHref('rhea_skin')).toBe('https://instagram.com/rhea_skin');
    expect(instagramHref('@a/../b')).toBe('https://instagram.com/a%2F..%2Fb');
  });
});
