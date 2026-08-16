// Generates the `virtual:quiet-luxe-inline-fonts` module: the Latin webfonts
// (Marcellus + Outfit) as @font-face rules with base64 woff2 payloads, so a
// HACS-only install renders with the real typefaces and no file copying.
//
// CJK is deliberately NOT inlined (tens of MB); the CJK stacks fall back to
// system fonts, and the full Noto CJK webfonts stay an optional manual install
// (scripts/build-fonts.mjs → dist/fonts, loaded from /local when present).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export const INLINE_FONTS_MODULE_ID = 'virtual:quiet-luxe-inline-fonts';

const RESOLVED_MODULE_ID = `\0${INLINE_FONTS_MODULE_ID}`;

interface InlineFontSpec {
  readonly pkg: string;
  readonly weights: readonly number[];
}

/** Latin faces inlined into the bundle. Keep in sync with scripts/build-fonts.mjs. */
export const INLINE_FONTS: readonly InlineFontSpec[] = [
  { pkg: '@fontsource/marcellus', weights: [400] },
  { pkg: '@fontsource/outfit', weights: [200, 300, 400, 500] },
];

/** Only these @fontsource subsets are inlined; everything else is skipped. */
const INLINE_SUBSETS: readonly string[] = ['latin', 'latin-ext'];

const FONT_FACE_BLOCK = /@font-face\s*\{([^}]*)\}/g;
const WOFF2_SOURCE = /url\(\.\/files\/([^)]+\.woff2)\)/;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function declaration(block: string, property: string): string | undefined {
  const match = new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`).exec(block);
  return match?.[1]?.trim();
}

function subsetOf(fileName: string, family: string, weight: number): string | undefined {
  const match = new RegExp(`^${family}-(.+)-${weight}-normal\\.woff2$`).exec(fileName);
  return match?.[1];
}

function dataUri(path: string): string {
  return `data:font/woff2;base64,${readFileSync(path).toString('base64')}`;
}

function faceCss(block: string, fileName: string, packageDir: string): string {
  const family = declaration(block, 'font-family');
  const weight = declaration(block, 'font-weight');
  const style = declaration(block, 'font-style') ?? 'normal';
  if (family === undefined || weight === undefined) {
    throw new Error(`inline-fonts: @font-face for ${fileName} lacks font-family/font-weight`);
  }
  const unicodeRange = declaration(block, 'unicode-range');
  const src = `url(${dataUri(join(packageDir, 'files', fileName))}) format('woff2')`;
  return [
    '@font-face{',
    `font-family:${family};`,
    `font-style:${style};`,
    'font-display:swap;',
    `font-weight:${weight};`,
    `src:${src};`,
    unicodeRange === undefined ? '' : `unicode-range:${unicodeRange};`,
    '}',
  ].join('');
}

/**
 * Builds the inlined @font-face stylesheet from the installed @fontsource
 * packages. Fails loudly when a package, weight, or subset is missing.
 */
export function buildInlineFontCss(root: string = packageRoot): string {
  const faces: string[] = [];
  for (const { pkg, weights } of INLINE_FONTS) {
    const familySlug = pkg.split('/')[1];
    if (familySlug === undefined) {
      throw new Error(`inline-fonts: malformed package name ${pkg}`);
    }
    const packageDir = join(root, 'node_modules', pkg);
    for (const weight of weights) {
      const source = readFileSync(join(packageDir, `${weight}.css`), 'utf8');
      const inlined: string[] = [];
      for (const [, block] of source.matchAll(FONT_FACE_BLOCK)) {
        if (block === undefined) {
          continue;
        }
        const fileName = WOFF2_SOURCE.exec(block)?.[1];
        if (fileName === undefined) {
          throw new Error(`inline-fonts: no woff2 source in ${pkg}/${weight}.css`);
        }
        const subset = subsetOf(fileName, familySlug, weight);
        if (subset === undefined || !INLINE_SUBSETS.includes(subset)) {
          continue;
        }
        inlined.push(faceCss(block, fileName, packageDir));
      }
      if (inlined.length === 0) {
        throw new Error(`inline-fonts: no latin faces for ${pkg} weight ${weight}`);
      }
      faces.push(...inlined);
    }
  }
  return faces.join('\n');
}

/** Serves the generated stylesheet as a virtual ES module (build, dev and test). */
export function inlineFontsPlugin(): Plugin {
  return {
    name: 'quiet-luxe-inline-fonts',
    resolveId(id: string): string | undefined {
      return id === INLINE_FONTS_MODULE_ID ? RESOLVED_MODULE_ID : undefined;
    },
    load(id: string): string | undefined {
      if (id !== RESOLVED_MODULE_ID) {
        return undefined;
      }
      return `export default ${JSON.stringify(buildInlineFontCss())};`;
    },
  };
}
