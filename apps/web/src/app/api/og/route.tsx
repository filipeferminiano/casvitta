import { color } from '@casvitta/config/tokens';
import { ImageResponse } from 'next/og';

import messages from '../../../../messages/pt-BR.json';

const size = { width: 1200, height: 630 };

/** Default social card for public pages, at /api/og (see lib/metadata.ts). */
export function GET() {
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
      <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 2 }}>{messages.og.brand}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>
          {messages.home.title}
        </div>
        <div style={{ fontSize: 28, color: color['ink-300'], maxWidth: 960 }}>
          {messages.home.subtitle}
        </div>
      </div>
    </div>,
    size,
  );
}
