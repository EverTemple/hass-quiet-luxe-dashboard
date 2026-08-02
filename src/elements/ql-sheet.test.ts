import { afterEach, describe, expect, it } from 'vitest';
import { QlSheet } from './ql-sheet';
import { QlSheetButton } from './ql-sheet-button';

afterEach(() => {
  document.body.innerHTML = '';
});

async function mount(props: Partial<QlSheet> = {}): Promise<QlSheet> {
  const el = document.createElement('ql-sheet') as QlSheet;
  Object.assign(el, { heading: 'Oscillation', closeLabel: 'Close', ...props });
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function dialogOf(el: QlSheet): HTMLDialogElement {
  const dialog = el.shadowRoot?.querySelector('dialog');
  if (dialog === null || dialog === undefined) {
    throw new Error('sheet has no dialog');
  }
  return dialog;
}

async function closeReasons(el: QlSheet): Promise<string[]> {
  const reasons: string[] = [];
  el.addEventListener('ql-sheet-close', (e) =>
    reasons.push((e as CustomEvent<{ reason: string }>).detail.reason),
  );
  return Promise.resolve(reasons);
}

describe('ql-sheet', () => {
  it('is registered and starts closed', () => {
    expect(customElements.get('ql-sheet')).toBe(QlSheet);
    const el = document.createElement('ql-sheet') as QlSheet;
    expect(el.open).toBe(false);
  });

  /**
   * The sheet has to escape `.ql-card`'s `overflow: hidden` and the grid
   * section's stacking context. showModal() promotes it to the browser's top
   * layer, which no ancestor can clip.
   */
  it('presents itself in the top layer via showModal, not as an in-flow overlay', async () => {
    const el = await mount();
    expect(dialogOf(el).open).toBe(false);
    el.open = true;
    await el.updateComplete;
    expect(dialogOf(el).open).toBe(true);
    // Still inside its own shadow root — nothing was portalled to the body.
    expect(dialogOf(el).isConnected).toBe(true);
    expect(el.shadowRoot?.contains(dialogOf(el))).toBe(true);
  });

  it('carries explicit dialog semantics and is labelled by its heading', async () => {
    const el = await mount({ open: true });
    await el.updateComplete;
    const dialog = dialogOf(el);
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Oscillation');
    expect(el.shadowRoot?.querySelector('h2')?.textContent?.trim()).toBe('Oscillation');
  });

  it('closes on the close button and reports the reason', async () => {
    const el = await mount({ open: true });
    await el.updateComplete;
    const reasons = await closeReasons(el);
    el.shadowRoot?.querySelector<HTMLButtonElement>('.close')?.click();
    await el.updateComplete;
    expect(el.open).toBe(false);
    expect(dialogOf(el).open).toBe(false);
    expect(reasons).toEqual(['close']);
  });

  it('closes on Escape instead of letting the UA dismiss it silently', async () => {
    const el = await mount({ open: true });
    await el.updateComplete;
    const reasons = await closeReasons(el);
    dialogOf(el).dispatchEvent(new Event('cancel', { cancelable: true }));
    await el.updateComplete;
    expect(el.open).toBe(false);
    expect(reasons).toEqual(['escape']);
  });

  it('closes when the backdrop is clicked but not when the sheet itself is', async () => {
    const el = await mount({ open: true });
    await el.updateComplete;
    const reasons = await closeReasons(el);

    el.shadowRoot?.querySelector<HTMLElement>('.sheet')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    await el.updateComplete;
    expect(el.open).toBe(true);
    expect(reasons).toEqual([]);

    dialogOf(el).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await el.updateComplete;
    expect(el.open).toBe(false);
    expect(reasons).toEqual(['backdrop']);
  });

  it('gives the close target the full touch minimum', () => {
    const cssText = QlSheet.styles.toString();
    expect(cssText).toContain('width: var(--ql-touch-min, 56px)');
    expect(cssText).toContain('height: var(--ql-touch-min, 56px)');
  });

  it('paints the documented scrim on ::backdrop rather than a tinted card', () => {
    const cssText = QlSheet.styles.toString();
    expect(cssText).toContain('dialog::backdrop');
    expect(cssText).toContain('rgba(8, 6, 4, 0.6)');
  });

  it('caps the sheet at 420 and lets it shrink on a phone', () => {
    expect(QlSheet.styles.toString()).toContain('width: min(420px, 100%)');
  });

  /**
   * --ql-surface-card is rgba(255,250,240,0.055) in dark mode — a tint for an
   * opaque page. Used alone on a floating panel it let the whole dashboard read
   * through the sheet.
   */
  it('paints the panel over an opaque base so nothing reads through it', () => {
    const cssText = QlSheet.styles.toString();
    const sheetRule = /\.sheet \{([^}]*)\}/.exec(cssText)?.[1] ?? '';
    expect(sheetRule).toContain('var(--ql-bg-base, #f4f0e8)');
    expect(sheetRule).toContain('linear-gradient(var(--ql-surface-card, #fdfbf6)');
  });

  it('takes initial focus on the panel, not on the close button', async () => {
    const el = await mount();
    el.open = true;
    await el.updateComplete;
    expect(el.shadowRoot?.activeElement).toBe(el.shadowRoot?.querySelector('.sheet'));
    expect(el.shadowRoot?.querySelector('.sheet')?.getAttribute('tabindex')).toBe('-1');
  });

  it('restores focus to the control that opened it', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    const el = await mount();
    opener.focus();
    expect(document.activeElement).toBe(opener);

    el.open = true;
    await el.updateComplete;
    el.shadowRoot?.querySelector<HTMLButtonElement>('.close')?.click();
    await el.updateComplete;
    await el.updateComplete;

    expect(document.activeElement).toBe(opener);
  });

  it('closes itself when torn off the page mid-interaction', async () => {
    const el = await mount({ open: true });
    await el.updateComplete;
    const dialog = dialogOf(el);
    el.remove();
    expect(dialog.open).toBe(false);
  });

  it('renders content and footer slots', async () => {
    const el = await mount({ open: true });
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('slot:not([name])')).not.toBeNull();
    expect(el.shadowRoot?.querySelector('slot[name="footer"]')).not.toBeNull();
  });
});

describe('ql-sheet-button', () => {
  it('is registered and defaults to secondary', () => {
    expect(customElements.get('ql-sheet-button')).toBe(QlSheetButton);
    const el = document.createElement('ql-sheet-button') as QlSheetButton;
    expect(el.emphasis).toBe('secondary');
  });

  it('renders a real button and reflects emphasis for styling', async () => {
    const el = document.createElement('ql-sheet-button') as QlSheetButton;
    el.emphasis = 'primary';
    el.textContent = 'Done';
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('button')?.getAttribute('type')).toBe('button');
    expect(el.getAttribute('emphasis')).toBe('primary');
  });

  it('meets the touch minimum and uses the documented champagne primary', () => {
    const cssText = QlSheetButton.styles.toString();
    expect(cssText).toContain('min-height: var(--ql-touch-min, 56px)');
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(cssText).toContain('color: #2b2620');
  });
});
