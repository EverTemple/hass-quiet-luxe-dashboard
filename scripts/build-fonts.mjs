// Copies the required @fontsource weights (css + woff2/woff slices) into
// dist/fonts/ and writes dist/fonts/fonts.css. Runs after `vite build`.
// Fails loudly if any expected fontsource file is missing.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(pkgRoot, 'dist', 'fonts');

const FONTS = [
  { pkg: '@fontsource/marcellus', weights: [400] },
  { pkg: '@fontsource/outfit', weights: [300, 400, 500] },
  { pkg: '@fontsource/noto-serif-tc', weights: [300] },
  { pkg: '@fontsource/noto-sans-tc', weights: [400, 500] },
  { pkg: '@fontsource/noto-serif-sc', weights: [300] },
  { pkg: '@fontsource/noto-sans-sc', weights: [400, 500] },
];

const imports = [];
for (const { pkg, weights } of FONTS) {
  const family = pkg.split('/')[1];
  const srcDir = join(pkgRoot, 'node_modules', pkg);
  const destDir = join(outDir, family);
  mkdirSync(join(destDir, 'files'), { recursive: true });
  for (const weight of weights) {
    const cssName = `${weight}.css`;
    const cssPath = join(srcDir, cssName);
    if (!existsSync(cssPath)) {
      throw new Error(`build-fonts: missing ${pkg}/${cssName} — check @fontsource package layout`);
    }
    cpSync(cssPath, join(destDir, cssName));
    imports.push(`@import url("./${family}/${weight}.css");`);
    const sliceFiles = readdirSync(join(srcDir, 'files')).filter((f) =>
      f.includes(`-${weight}-normal`),
    );
    if (sliceFiles.length === 0) {
      throw new Error(`build-fonts: no font files for ${pkg} weight ${weight}`);
    }
    for (const file of sliceFiles) {
      cpSync(join(srcDir, 'files', file), join(destDir, 'files', file));
    }
  }
}
writeFileSync(join(outDir, 'fonts.css'), `${imports.join('\n')}\n`);
console.log(`build-fonts: wrote ${imports.length} @imports to dist/fonts/fonts.css`);
