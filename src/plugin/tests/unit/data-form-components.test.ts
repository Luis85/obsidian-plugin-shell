// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { componentFixture, click, input, settle } from './component-fixture';

async function write(element: HTMLTextAreaElement, value: string) { element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); await settle(); }

afterEach(() => { document.body.replaceChildren(); });
function control<T extends HTMLElement>(root: HTMLElement, path: string, selector: string): T {
  const element = root.querySelector<T>(`[data-field="${path}"] ${selector}`);
  if (!element) throw new Error(`FORM_CONTROL_MISSING: ${path}`);
  return element;
}
async function change(element: HTMLSelectElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true })); await settle();
}
async function toggle(element: HTMLInputElement) { element.click(); await settle(); }
const choice = (root: HTMLElement, path: string, label: string) => {
  const found = Array.from(root.querySelectorAll<HTMLLabelElement>(`[data-field="${path}"] label`)).find(item => item.textContent?.trim() === label)?.querySelector('input');
  if (!found) throw new Error(`FORM_CHOICE_MISSING: ${label}`);
  return found;
};

describe('DataForm in the showcase', () => {
  it('[FORMS-12] renders the JSON example, reports accessible errors and returns the validated value without persisting it', async () => {
    const f = await componentFixture();
    const writes = f.files.size;
    try {
      await click(f.root, 'Forms');
      const form = f.root.querySelector<HTMLFormElement>('form[data-form="feature-brief"]');
      if (!form) throw new Error('FORM_MISSING');
      expect(form.querySelector('h2')?.textContent).toBe('Feature brief');
      expect(f.root.querySelector('[data-field="reviewers"]')).toBeNull();
      const name = control<HTMLInputElement>(f.root, 'name', 'input');
      expect(f.root.querySelector(`label[for="${name.id}"]`)?.textContent).toContain('Feature name');
      await click(f.root, 'Submit');
      expect(f.root.querySelector('[role="alert"]')?.textContent).toBe('Check the highlighted fields.');
      expect(name.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(name);
      const nameError = f.root.querySelector(`#${name.getAttribute('aria-describedby') ?? 'none'}`);
      expect(nameError?.textContent).toBe('This field is required.');
      const summary = control<HTMLTextAreaElement>(f.root, 'summary', 'textarea');
      expect(summary.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2);
      expect(f.root.querySelector('[data-field="surfaces"]')?.textContent).toContain('This field is required.');
      expect(f.root.querySelector('[data-testid="form-result"]')).toBeNull();

      await input(name, '  Weekly review ');
      await write(summary, 'Plan the week.');
      await change(control<HTMLSelectElement>(f.root, 'priority', 'select'), 'high');
      const estimate = control<HTMLInputElement>(f.root, 'estimate', 'input');
      await input(estimate, '99');
      expect(f.root.querySelector('[data-field="estimate"]')?.textContent).toContain('Enter whole days from 1 to 60.');
      await input(estimate, '4');
      await toggle(choice(f.root, 'surfaces', 'Settings')); await toggle(choice(f.root, 'surfaces', 'View'));
      await toggle(control<HTMLInputElement>(f.root, 'review', 'input[type="checkbox"]'));
      await write(control<HTMLTextAreaElement>(f.root, 'reviewers', 'textarea'), 'Ada\n\n Linus ');
      await input(control<HTMLInputElement>(f.root, 'links.issue', 'input'), '#42');
      await click(f.root, 'Submit');
      expect(f.root.querySelector('[role="alert"]')).toBeNull();
      expect(JSON.parse(f.root.querySelector('[data-testid="form-result"]')?.textContent ?? '{}')).toEqual({
        name: 'Weekly review', summary: 'Plan the week.', priority: 'high', estimate: 4, surfaces: ['view', 'settings'], review: true,
        reviewers: ['Ada', 'Linus'], links: { issue: '#42', design: '' },
      });
      expect(f.save).not.toHaveBeenCalled(); expect(f.files.size).toBe(writes); expect(f.observe).not.toHaveBeenCalled();
    } finally { f.dispose(); }
  });

  it('[FORMS-13] keeps the per-view draft across navigation and resets to the definition defaults', async () => {
    const f = await componentFixture();
    try {
      await click(f.root, 'Forms');
      await input(control<HTMLInputElement>(f.root, 'name', 'input'), 'Draft title');
      await toggle(choice(f.root, 'surfaces', 'Command'));
      await click(f.root, 'Submit');
      expect(f.root.querySelector('[role="alert"]')).not.toBeNull();
      await click(f.root, 'Overview'); await click(f.root, 'Forms');
      expect(control<HTMLInputElement>(f.root, 'name', 'input').value).toBe('Draft title');
      expect(choice(f.root, 'surfaces', 'Command').checked).toBe(true);
      expect(f.root.querySelector('[role="alert"]')).not.toBeNull();
      await click(f.root, 'Reset');
      expect(control<HTMLInputElement>(f.root, 'name', 'input').value).toBe('');
      expect(control<HTMLSelectElement>(f.root, 'priority', 'select').value).toBe('normal');
      expect(choice(f.root, 'surfaces', 'Command').checked).toBe(false);
      expect(f.root.querySelector('[role="alert"]')).toBeNull();
      await f.services.preferences.update({ locale: 'de' }); await settle();
      await click(f.root, 'Absenden');
      expect(f.root.querySelector('[role="alert"]')?.textContent).toBe('Prüfe die markierten Felder.');
    } finally { f.dispose(); }
  });
});
