import type { Page } from '@playwright/test';
import { content } from './content.ts';

const { site } = content;

/**
 * Opens the View menu in the header, which holds Selling as and Detail level, unless it is already open. On a phone
 * the header's links sit behind the Menu button, so that opens first.
 */
export async function openViewMenu(page: Page) {
  const summary = page.locator('header summary', {
    hasText: new RegExp(`^${site.ui.view.label}:`),
  });
  // The menu is drawn once the app has started. On a phone it is in the page but hidden behind the Menu button.
  await summary.waitFor({ state: 'attached' });
  if (!(await summary.isVisible()))
    await page.getByRole('button', { name: site.ui.menuLabel, exact: true }).click();
  const menu = summary.locator('xpath=..');
  if ((await menu.getAttribute('open')) === null) await summary.click();
  return menu;
}

export async function chooseDepth(page: Page, depth: 'executive' | 'technical') {
  const menu = await openViewMenu(page);
  await menu.getByRole('button', { name: site.ui.depth[depth], exact: true }).click();
}

export async function chooseAudience(page: Page, audience: 'ai' | 'security' | 'joint') {
  const menu = await openViewMenu(page);
  await menu.getByRole('button', { name: site.ui.audience[audience], exact: true }).click();
}
