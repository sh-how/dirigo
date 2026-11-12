import { expect, test, type Page } from '@playwright/test';

async function fresh(page: Page) {
  await page.goto('/connect');
  await page.evaluate(() => localStorage.clear());
}

test.beforeEach(async ({ page }) => fresh(page));

test('a visitor reaches the sample dashboard and every screen from the landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Know what is stuck before anyone has to tell you.');
  await page.getByRole('link', { name: 'See a sample dashboard' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Two things are blocking delivery.');
  await expect(page.getByText('You are looking at sample data.')).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'All work' }).click();
  await expect(page.getByText('42 open items across 4 repositories. 2 are blocked and 5 have no owner.')).toBeVisible();
  await nav.getByRole('link', { name: 'Repositories' }).click();
  await expect(page.getByText('Two of your four need attention. They are listed first.')).toBeVisible();
  await page.getByRole('link', { name: 'Open lattice' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('lattice');
  await nav.getByRole('link', { name: /Reviews/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One review has been stuck for 6 days.');
  await nav.getByRole('link', { name: 'Milestones' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One milestone will be late. One is at risk.');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
});

test('the same numbers appear on every screen', async ({ page }) => {
  await page.goto('/sample/today');
  const buckets = page.getByRole('group', { name: 'Filter by status' }).getByRole('button');
  await expect(buckets).toHaveCount(3);
  await expect(buckets.nth(0)).toContainText('2');
  await expect(buckets.nth(1)).toContainText('3');
  await expect(buckets.nth(2)).toContainText('37');
  await page.goto('/sample/work');
  await expect(page.getByRole('button', { name: 'Everything · 42' })).toBeVisible();
  await page.goto('/sample/repositories');
  await expect(page.getByText('42 open items', { exact: true })).toBeVisible();
  await expect(page.getByLabel('3 waiting on you')).toBeVisible();
});

test('quick filters combine and a selected card links to GitHub', async ({ page }) => {
  await page.goto('/sample/work');
  await page.getByRole('button', { name: 'Blocked · 2', exact: true }).click();
  await expect(page.locator('.wcard')).toHaveCount(2);
  await page.getByRole('button', { name: /Parallelise segment merges/ }).click();
  await expect(page.getByRole('link', { name: /Open on GitHub/ })).toBeVisible();
  await page.getByRole('button', { name: 'Everything · 42' }).click();
  await page.getByRole('combobox', { name: 'Label' }).click();
  await page.getByRole('option', { name: 'Bug' }).click();
  await expect(page.getByRole('button', { name: 'No owner · 5' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Rows' }).click();
  await page.getByRole('option', { name: 'By milestone' }).click();
  await expect(page.getByRole('rowheader', { name: /No milestone/ })).toBeVisible();
});

test('changing a rule changes what is flagged', async ({ page }) => {
  await page.goto('/sample/settings');
  await page.getByLabel('Work is stalled after').fill('10');
  await page.getByRole('button', { name: 'Save rules' }).click();
  await expect(page.getByText('Your rules are saved')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One thing is blocking delivery.');
});

test('stopping a watch removes the repository from every screen', async ({ page }) => {
  await page.goto('/sample/settings');
  await page.getByRole('button', { name: 'Stop watching lattice' }).click();
  await expect(page.getByRole('button', { name: 'Stop watching lattice' })).toHaveCount(0);
  await page.goto('/sample/today');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One thing is blocking delivery.');
  await page.goto('/sample/repositories');
  await expect(page.getByRole('link', { name: 'Open lattice' })).toHaveCount(0);
  await page.goto('/sample/milestones');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One milestone is at risk.');
});

test('with no repositories, Today shows the empty state and links to choose some', async ({ page }) => {
  await page.goto('/sample/settings');
  for (const name of ['lattice', 'api', 'web-app', 'kit']) {
    await page.getByRole('button', { name: `Stop watching ${name}` }).click();
    await expect(page.getByRole('button', { name: `Stop watching ${name}` })).toHaveCount(0);
  }
  await page.goto('/sample/today');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are not watching any repositories yet.');
  await page.getByRole('link', { name: 'Choose repositories' }).click();
  await expect(page.getByRole('button', { name: /Open my dashboard/ })).toBeDisabled();
  await page.getByRole('checkbox', { name: /^kit/ }).check();
  await page.getByRole('button', { name: /Open my dashboard/ }).click();
  await expect(page).toHaveURL(/\/sample\/today$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One thing needs your decision.');
});

test('cancelling on GitHub returns to Connect with an explanation', async ({ page }) => {
  await page.goto('/connect?error=cancelled');
  await expect(page.getByRole('alert')).toContainText('You cancelled on GitHub');
});

test('the keyboard reaches the content with visible focus', async ({ page }) => {
  await page.goto('/sample/today');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  expect(await skip.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
});

for (const path of ['/', '/connect', '/sample/setup/repositories', '/sample/today', '/sample/work', '/sample/repositories',
  '/sample/repositories/lattice-db/lattice', '/sample/reviews', '/sample/milestones', '/sample/settings']) {
  test(`no horizontal page scroll at 390 px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('an expanded cell or column can be collapsed again', async ({ page }) => {
  await page.goto('/sample/work');
  await page.getByRole('button', { name: 'Show 6 more in lattice' }).click();
  await expect(page.getByRole('button', { name: 'Show 6 more in lattice' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show fewer in lattice' }).click();
  await expect(page.getByRole('button', { name: 'Show 6 more in lattice' })).toBeVisible();

  await page.goto('/sample/repositories/lattice-db/lattice');
  await page.getByRole('button', { name: 'Show 6 more' }).click();
  await page.getByRole('button', { name: 'Show fewer' }).click();
  await expect(page.getByRole('button', { name: 'Show 6 more' })).toBeVisible();
});

test('the board selects work with the keyboard and match the design when open', async ({ page }) => {
  await page.goto('/sample/work');
  const rows = page.getByRole('combobox', { name: 'Rows' });
  await rows.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('option', { name: 'By repository' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(rows).toHaveText(/By person/);
  await expect(rows).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(rows).toHaveText(/By person/);
  await page.getByRole('combobox', { name: 'Person' }).click();
  await page.mouse.click(5, 5);
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('the app follows a dark system setting and keeps light as the default', async ({ page }) => {
  await page.goto('/sample/today');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expect.poll(bg).toBe('rgb(244, 245, 241)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(bg).toBe('rgb(17, 21, 19)');
});

test('the Appearance switch picks light or dark, keeps the choice and can return to the system', async ({ page }) => {
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.goto('/sample/settings');
  const group = page.getByRole('radiogroup', { name: 'Appearance' });
  await expect(group.getByRole('radio', { name: 'System' })).toBeChecked();

  await group.getByText('Dark').click();
  await expect.poll(bg).toBe('rgb(17, 21, 19)');
  await page.reload();
  await expect.poll(bg).toBe('rgb(17, 21, 19)');
  await expect(page.getByRole('radiogroup', { name: 'Appearance' }).getByRole('radio', { name: 'Dark' })).toBeChecked();

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('radiogroup', { name: 'Appearance' }).getByText('Light').click();
  await expect.poll(bg).toBe('rgb(244, 245, 241)');

  // Arrow keys move between the options, as in any radio group.
  await page.getByRole('radio', { name: 'Light' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await page.getByRole('radiogroup', { name: 'Appearance' }).getByText('System').click();
  await expect.poll(bg).toBe('rgb(17, 21, 19)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(bg).toBe('rgb(244, 245, 241)');
});
