import { color } from '@casvitta/config/tokens';
import { ImageResponse } from 'next/og';

import messages from '../../messages/pt-BR.json';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

/**
 * Social card for a price page: place, headline number (already gated and rounded by the API)
 * and the source. Below the gate there is no number, only the place.
 */
export function marketOgImage({
  eyebrow,
  title,
  label,
  value,
  demo,
}: {
  eyebrow: string;
  title: string;
  label?: string;
  value?: string;
  demo?: boolean;
}) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: color['ink-900'],
        color: color.paper,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: 2 }}>{messages.og.brand}</div>
        {demo ? (
          <div
            style={{
              display: 'flex',
              background: color['yellow-400'],
              color: color['ink-900'],
              fontSize: 22,
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 4,
            }}
          >
            {messages.badges.demo.toUpperCase()}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 30, color: color['ink-300'] }}>{eyebrow}</div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>
          {title}
        </div>
        {value ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
            <div style={{ fontSize: 26, color: color['ink-300'] }}>{label}</div>
            <div style={{ fontSize: 72, fontWeight: 700, color: color['yellow-400'] }}>{value}</div>
          </div>
        ) : null}
      </div>
      <div style={{ fontSize: 24, color: color['ink-300'] }}>{messages.market.og.source}</div>
    </div>,
    OG_SIZE,
  );
}
