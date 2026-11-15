import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderThemeCss } from '../src/css.ts';

const target = fileURLToPath(new URL('../tailwind-preset.css', import.meta.url));
writeFileSync(target, renderThemeCss());
console.log(`Wrote ${target}`);
