import type { Page } from '@playwright/test';
import { content } from './content.ts';

const { site } = content;

/**
 * The Technical detail switch in the header. On a phone the header's links sit behind the Menu button, so that
 * opens first.
 */
export async function technicalSwitch(page: Page) {
  // A CSS locator, not a role one: on a phone the switch is in the page but hidden behind the Menu button, and a
  // role locator skips what is hidden.
  const button = page.locator('header button', { hasText: site.ui.depth.technical });
  // The switch is drawn once the app has started.
  await button.waitFor({ state: 'attached' });
  if (!(await button.isVisible()))
    await page.getByRole('button', { name: site.ui.menuLabel, exact: true }).click();
  return button;
}

/** Puts the switch on or off, whichever it is now. */
export async function chooseDepth(page: Page, depth: 'executive' | 'technical') {
  const button = await technicalSwitch(page);
  const on = (await button.getAttribute('aria-pressed')) === 'true';
  if (on !== (depth === 'technical')) await button.click();
}

/** Selling as sits on the Pitch page, in the parts the choice changes. */
export async function chooseAudience(page: Page, audience: 'ai' | 'security' | 'joint') {
  const group = page.getByRole('group', { name: site.ui.audience.groupLabel });
  await group.getByRole('button', { name: site.ui.audience[audience], exact: true }).click();
}
