import { SITE_URL } from '@/config/site';

/** Absolute public URL (the broker app runs on app.casvitta.com.br). */
export const publicUrl = (path: string) => `${SITE_URL}${path}`;

/** WhatsApp share without a fixed recipient: the broker picks the client in WhatsApp. */
export const whatsappShare = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
