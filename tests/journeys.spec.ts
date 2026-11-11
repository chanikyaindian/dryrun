import { expect, test } from '@playwright/test';

test('the example catalog filters by topic and browser Back restores the search', async ({ page }) => {
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'See Python step by step.' })).toBeVisible();
  await page.getByRole('button', { name: 'Graphs and trees', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Filter examples' }).fill('queue');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'BFS with queue', exact: true }).click();
  await expect(page).toHaveURL(/#watch$/);
  await expect(page.getByRole('img', { name: 'Graph and active traversal' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('searchbox', { name: 'Filter examples' })).toHaveValue('queue');
  await expect(page.getByRole('button', { name: 'Graphs and trees', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('searchbox', { name: 'Filter examples' }).fill('zzzz');
  await expect(page.getByText('No examples match those filters.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use custom code' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(18);
  await page.getByRole('searchbox', { name: 'Filter examples' }).fill('permutation');
  await page.getByRole('button', { name: 'Permutations', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Permutations', exact: true })).toBeVisible();
  await expect(page.locator('[data-scene="backtracking"]')).toBeVisible();
});

test('prediction reveals the next actual event and Inspect can jump between visits', async ({ page }) => {
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/#watch');
  await page.getByRole('button', { name: 'Next event' }).click();
  await page.getByRole('button', { name: 'Predict next' }).click();
  await expect(page.getByText('What happens to the highlighted values?')).toBeVisible();
  await page.getByRole('button', { name: 'They swap' }).click();
  await expect(page.getByText('Correct', { exact: true })).toBeVisible();
  await expect(page.locator('.watch-caption')).toHaveText('Swap 5 and 2.');
  await page.locator('header').getByRole('button', { name: 'Inspect', exact: true }).click();
  await page.getByText('Find line', { exact: true }).click();
  const select = page.getByRole('combobox', { name: 'Executed line' });
  await select.selectOption('5');
  const slider = page.getByRole('slider', { name: 'Playback step' });
  const first = Number(await slider.inputValue());
  await page.getByRole('button', { name: 'Next visit' }).click();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(first);
  await page.getByRole('button', { name: 'Previous visit' }).click();
  await expect(slider).toHaveValue(String(first));
});

test('the Write page orders its three run actions and protects the draft when editing a sample', async ({ page }) => {
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/#write');
  const editor = page.getByLabel('Python code', { exact: true });
  const actions = page.getByRole('complementary', { name: 'Run your Python' });
  await expect(actions.getByRole('button')).toHaveText(['Inspect fullscreen', 'Inspect', 'Watch']);
  for (const action of await actions.getByRole('button').all()) await expect(action).toBeDisabled();
  await expect(page.getByRole('navigation', { name: 'Dryrun pages' }).getByRole('button')).toHaveText(['Examples', 'Write', 'Inspect', 'Inspect fullscreen', 'Watch']);
  await editor.fill('print("draft")');
  await expect(actions.getByRole('button', { name: 'Inspect', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  await page.getByRole('button', { name: 'Bubble sort', exact: true }).click();
  await page.locator('header').getByRole('button', { name: 'Inspect', exact: true }).click();
  const edit = page.getByRole('button', { name: 'Edit a copy' });
  await edit.click();
  await expect(page.getByRole('dialog', { name: 'Replace your draft?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep draft' }).click();
  await expect(page).toHaveURL(/#inspect$/);
  await edit.click();
  await page.getByRole('button', { name: 'Replace draft' }).click();
  await expect(editor).toContainText('arr = [5, 2, 9, 1, 6]');
  await page.reload();
  await expect(editor).toContainText('arr = [5, 2, 9, 1, 6]');
});

test('compact Watch opens the matching window in Inspect and keeps the return path', async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 760 });
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Sliding window', exact: true }).click();
  await page.getByRole('button', { name: 'Next event' }).click();
  const canvas = page.locator('.watch-canvas');
  await expect(canvas.locator('[data-in-window] code')).toHaveText('2');
  await expect(canvas.locator('[data-topic-pointer="Input:left"]')).toBeVisible();
  await expect(canvas.locator('[data-topic-pointer="Input:right"]')).toBeVisible();
  await expect(canvas.locator('[data-related="true"] code')).toHaveText('2');
  await expect(page.getByRole('link', { name: 'Back to examples' })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect this moment' }).click();
  await expect(page.getByRole('button', { name: 'Visualize', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#stage [data-in-window] code')).toHaveText('2');
  await expect(page.locator('#stage').getByRole('button', { name: 'Drag card to reorder' })).toBeHidden();
});
