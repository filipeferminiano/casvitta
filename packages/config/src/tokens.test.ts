import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { renderThemeCss } from './css.ts';
import { color, font, layout, radius, space } from './tokens.ts';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('tokens', () => {
  it('mirror design/tokens.json exactly', () => {
    const source = JSON.parse(read('../../../design/tokens.json'));
    expect(color).toEqual(source.color);
    expect(font).toEqual(source.font);
    expect([...space]).toEqual(source.space);
    expect(radius).toEqual(source.radius);
    expect(layout).toEqual(source.layout);
  });

  it('generated tailwind-preset.css is up to date (run pnpm --filter @casvitta/config build:css)', () => {
    expect(read('../tailwind-preset.css')).toBe(renderThemeCss());
  });

  it('exposes every color as a theme variable', () => {
    const css = renderThemeCss();
    for (const name of Object.keys(color)) expect(css).toContain(`--color-${name}:`);
  });
});
