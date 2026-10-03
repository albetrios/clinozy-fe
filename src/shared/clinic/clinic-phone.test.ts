import { describe, expect, it } from 'vitest';

import {
  formatClinicPhone,
  instagramHref,
  telHref,
  whatsAppHref,
} from './clinic-phone.ts';

describe('clinic phones', () => {
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

  it('links an Instagram handle with or without its @, encoded', () => {
    expect(instagramHref('@rhea.shah')).toBe('https://instagram.com/rhea.shah');
    expect(instagramHref('rhea_skin')).toBe('https://instagram.com/rhea_skin');
    expect(instagramHref('@a/../b')).toBe('https://instagram.com/a%2F..%2Fb');
  });
});
