import { expect, test, type Page } from '@playwright/test';

const editor = (page: Page) => page.getByLabel('Python code', { exact: true });
const slider = (page: Page) => page.getByRole('slider', { name: 'Playback step' });
const writeActions = (page: Page) => page.getByRole('complementary', { name: 'Run your Python' });
async function inspect(page: Page) {
  const button = page.locator('header').getByRole('button', { name: 'Inspect', exact: true });
  if (await button.isVisible()) await button.click();
}
async function example(page: Page, name: string) {
  await page.locator('header').getByRole('button', { name: name === 'My code' ? 'Write' : 'Examples', exact: true }).click();
  if (name !== 'My code') {
    await page.getByRole('button', { name, exact: true }).click();
    await writeActions(page).getByRole('button', { name: 'Watch', exact: true }).click();
    await expect(page.getByRole('slider', { name: 'Watch event' })).toBeVisible();
    await inspect(page);
  }
}
async function offline(page: Page) {
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
}
async function last(page: Page) {
  await expect.poll(async () => Number(await slider(page).getAttribute('max'))).toBeGreaterThan(1);
  await slider(page).press('End');
  await expect(slider(page)).toHaveValue((await slider(page).getAttribute('max'))!);
}

test('resize and reset the workspace without losing the current step', async ({ page }) => {
  await offline(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#watch');
  await inspect(page);
  await expect(editor(page)).toContainText('arr');
  await slider(page).press('Home');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(slider(page)).toHaveValue('1');
  const splitter = page.getByRole('separator', { name: 'Resize editor and visualization' });
  const before = (await splitter.boundingBox())!.x;
  const box = (await splitter.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await splitter.boundingBox())!.x).toBeGreaterThan(before + 40);
  await expect(slider(page)).toHaveValue('1');
  await page.reload();
  await inspect(page);
  await expect.poll(async () => (await splitter.boundingBox())!.x).toBeGreaterThan(before + 40);
  await page.getByText('View', { exact: true }).click();
  await page.getByRole('button', { name: 'Reset layout' }).click();
  await expect.poll(async () => Math.abs((await splitter.boundingBox())!.x - before)).toBeLessThan(5);
  await splitter.focus();
  await splitter.press('ArrowRight');
  await expect.poll(async () => (await splitter.boundingBox())!.x).toBeGreaterThan(before);
});

test('desktop Watch variables, hidden visualization restore, theme, and Inspect fullscreen keep their state', async ({ page }) => {
  await offline(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'BFS with queue', exact: true }).click();
  await writeActions(page).getByRole('button', { name: 'Watch', exact: true }).click();
  const watch = page.locator('.watch-player');
  await watch.getByRole('slider', { name: 'Watch event' }).press('End');
  await watch.getByText('View details', { exact: true }).click();
  await watch.getByRole('checkbox', { name: 'Variables', exact: true }).check();
  await expect(watch.getByRole('region', { name: 'Watch variables' })).toContainText('order');
  await watch.getByRole('button', { name: 'Inspect this moment' }).click();
  const at = await slider(page).inputValue();
  const stage = page.locator('#stage');
  await expect(stage.locator('.obj:visible').first()).toBeVisible();
  const count = await stage.locator('.obj:visible').count();
  expect(count).toBeGreaterThan(1);
  for (let i = 1; i < count; i++) await stage.getByRole('button', { name: 'Hide visualization', exact: true }).last().click();
  await expect(stage).toHaveClass(/single-card/);
  const card = stage.locator('.obj:visible');
  expect((await card.boundingBox())!.height).toBeGreaterThan((await stage.boundingBox())!.height * .75);
  await stage.getByRole('button', { name: 'Hide visualization', exact: true }).click();
  await expect(stage).toHaveClass(/void/);
  await page.getByText(/^Hidden visualizations \(/).click();
  await page.locator('.hidden-visualizations').getByRole('button').first().click();
  await expect(stage).toHaveClass(/single-card/);
  await expect(slider(page)).toHaveValue(at);
  await page.getByRole('button', { name: 'Previous step' }).click();
  await expect(slider(page)).toHaveValue(String(Number(at) - 1));
  await page.getByRole('button', { name: 'Last step' }).click();
  await expect(slider(page)).toHaveValue(at);
  await expect(stage).toHaveClass(/single-card/);

  const dark = page.getByRole('button', { name: 'Dark mode' });
  await dark.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Fullscreen Inspect' }).click();
  const dialog = page.getByRole('dialog', { name: 'Inspect fullscreen' });
  await expect(dialog.getByRole('region', { name: 'Code editor' })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Visualization', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Dryrun pages' })).toBeHidden();
  await expect(page.getByRole('region', { name: 'Inspector', exact: true })).toBeHidden();
  await expect(dialog.getByRole('slider', { name: 'Playback step' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Exit Inspect fullscreen' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fullscreen Inspect' })).toBeFocused();
  await expect(slider(page)).toHaveValue(String(Number(at) - 1));
  await expect(stage).toHaveClass(/single-card/);
  await page.reload();
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
});

test('the hidden main navbar stays hidden through Inspect fallback fullscreen', async ({ page }) => {
  await offline(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: () => Promise.reject(Error('Unavailable')) });
  });
  await page.goto('/#inspect');
  const nav = page.getByRole('navigation', { name: 'Dryrun pages' });
  const source = page.getByRole('region', { name: 'Code editor' });
  await expect(nav).toBeVisible();
  const before = (await source.boundingBox())!.y;
  await page.getByRole('button', { name: 'Hide navbar' }).click();
  await expect(nav).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show navbar' })).toBeFocused();
  expect((await source.boundingBox())!.y).toBeLessThan(before);

  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Fullscreen Inspect' }).click();
  const dialog = page.getByRole('dialog', { name: 'Inspect fullscreen' });
  await expect(page.getByRole('button', { name: 'Show navbar' })).toHaveCount(0);
  const play = dialog.getByRole('button', { name: 'Play', exact: true });
  const pause = dialog.getByRole('button', { name: 'Pause', exact: true });
  const track = dialog.getByRole('slider', { name: 'Playback step' });
  const start = Number(await track.inputValue());
  await play.click();
  await expect(pause).toBeVisible();
  await expect.poll(async () => Number(await track.inputValue())).toBeGreaterThan(start);
  await pause.click();
  await track.press('End');
  await expect(dialog.getByRole('button', { name: 'Next step', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(pause).toBeVisible();
  await expect.poll(async () => Number(await track.inputValue())).toBeLessThan(Number(await track.getAttribute('max')));
  await pause.click();
  const at = await track.inputValue();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(nav).toBeHidden();
  await expect(slider(page)).toHaveValue(at);

  await page.reload();
  await expect(nav).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Show navbar' }).click();
  await expect(nav).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the main navbar toggle works across Examples, Watch, Inspect and Write', async ({ page }) => {
  await offline(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const header = page.getByRole('banner');
  const hide = header.getByRole('button', { name: 'Hide navbar' });
  const show = page.getByRole('button', { name: 'Show navbar' });
  await hide.click();
  await expect(header).toBeHidden();
  await expect(show).toBeFocused();

  await page.getByRole('button', { name: 'Bubble sort', exact: true }).click();
  await writeActions(page).getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(page).toHaveURL(/#watch\?example=Bubble%20sort$/);
  await expect(header).toBeHidden();
  await page.getByRole('button', { name: 'Inspect this moment' }).click();
  await expect(page).toHaveURL(/#inspect\?example=Bubble%20sort$/);
  await expect(header).toBeHidden();
  await page.getByRole('button', { name: 'Edit a copy' }).click();
  await expect(page).toHaveURL(/#write$/);
  await page.reload();
  await expect(header).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(show).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await show.click();
  await expect(header).toBeVisible();
  await expect(hide).toBeFocused();
  await header.getByRole('button', { name: 'Examples', exact: true }).click();
  await hide.click();
  await page.getByRole('button', { name: 'Recursion (Fibonacci)', exact: true }).click();
  await writeActions(page).getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Write can run an edited draft directly in fullscreen Inspect', async ({ page }) => {
  await page.goto('/#write');
  await editor(page).fill('values = [2, 4]\nprint(sum(values))');
  await writeActions(page).getByRole('button', { name: 'Inspect fullscreen', exact: true }).click();
  await expect(page).toHaveURL(/#inspect$/, { timeout: 90000 });
  await expect(page.getByRole('dialog', { name: 'Inspect fullscreen' })).toBeVisible();
  await page.getByRole('slider', { name: 'Playback step' }).press('End');
  await expect(page.locator('#stage .obj:visible').first()).toBeInViewport();
  await page.getByRole('button', { name: 'Exit Inspect fullscreen' }).click();
  const navigation = page.getByRole('navigation', { name: 'Dryrun pages' });
  await navigation.getByRole('button', { name: 'Inspect fullscreen' }).click();
  await expect(page.getByRole('dialog', { name: 'Inspect fullscreen' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit Inspect fullscreen' }).click();
  await last(page);
  await page.getByRole('tab', { name: 'Output' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('6');
});

test('compact Inspect opens on the visuals and keeps drawing in fullscreen', async ({ page }) => {
  await offline(page);
  await page.setViewportSize({ width: 680, height: 760 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Bubble sort', exact: true }).click();
  await writeActions(page).getByRole('button', { name: 'Inspect fullscreen', exact: true }).click();
  const fullscreen = page.getByRole('dialog', { name: 'Inspect fullscreen' });
  const cards = page.locator('#stage .obj:visible');
  await expect(fullscreen.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await fullscreen.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(cards.first()).toBeInViewport();
  await fullscreen.getByRole('button', { name: 'Exit Inspect fullscreen' }).click();
  const sections = page.getByRole('navigation', { name: 'Workspace sections' });
  await expect(sections.getByRole('button', { name: 'Visualize', exact: true })).toHaveAttribute('aria-current', 'page');
  await sections.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(editor(page)).toBeInViewport();
  await expect(cards).toHaveCount(0);

  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  await page.getByRole('button', { name: 'BFS with queue', exact: true }).click();
  await writeActions(page).getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(sections.getByRole('button', { name: 'Visualize', exact: true })).toHaveAttribute('aria-current', 'page');
  await slider(page).press('End');
  await expect(cards.first()).toBeInViewport();
});

test('fullscreen variable panels follow playback and stay separate from normal views', async ({ page }) => {
  await offline(page);
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: () => Promise.reject(Error('Unavailable')) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#watch');
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  const watch = page.getByRole('dialog', { name: 'Algorithm player' });
  const watchToggle = watch.getByRole('button', { name: 'Show variables' });
  const watchVars = watch.getByRole('region', { name: 'Watch fullscreen variables' });
  await expect(watchToggle).toHaveAttribute('aria-pressed', 'false');
  await watchToggle.click();
  await expect(watchVars).toContainText('[5, 2, 9, 1, 6]');
  await watch.getByRole('button', { name: 'Next event' }).click();
  await watch.getByRole('button', { name: 'Next event' }).click();
  await expect(watchVars).toContainText('[2, 5, 9, 1, 6]');
  await expect(watchVars.getByLabel('Changed')).toBeVisible();
  await expect(watch.getByRole('button', { name: 'Play', exact: true })).toBeInViewport();
  await watch.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(page.getByRole('region', { name: 'Watch variables', exact: true })).toBeHidden();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('navigation', { name: 'Dryrun pages' }).getByRole('button', { name: 'Inspect fullscreen' }).click();
  const inspect = page.getByRole('dialog', { name: 'Inspect fullscreen' });
  const inspectToggle = inspect.getByRole('button', { name: 'Show variables' });
  const inspectVars = inspect.getByRole('region', { name: 'Inspect fullscreen variables' });
  await expect(inspectToggle).toHaveAttribute('aria-pressed', 'false');
  await inspectToggle.click();
  await expect(inspectVars).toContainText('[2, 5, 9, 1, 6]');
  await inspect.getByRole('slider', { name: 'Playback step' }).press('End');
  await expect(inspectVars).toContainText('[1, 2, 5, 6, 9]');
  await expect(inspect.locator('#stage .obj:visible').first()).toBeInViewport();
  await expect(inspect.getByRole('button', { name: 'Replay', exact: true })).toBeInViewport();
  await inspectToggle.click();
  await expect(inspectVars).toBeHidden();
  await inspect.getByRole('button', { name: 'Exit Inspect fullscreen' }).click();
  await expect(page.getByRole('region', { name: 'Inspector', exact: true })).toBeVisible();
});

test('independent views, presets, and event navigation preserve playback', async ({ page }) => {
  await offline(page);
  await page.goto('/#watch');
  await example(page, 'Recursion (Fibonacci)');
  await last(page);
  const position = await slider(page).inputValue();
  await expect(page.locator('.ct')).toBeVisible();
  await page.getByRole('tab', { name: /Call stack/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Main program');
  await page.getByText('View', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Call tree' }).uncheck();
  await expect(page.locator('.ct')).toBeHidden();
  await expect(page.getByRole('tabpanel')).toContainText('Main program');
  await expect(slider(page)).toHaveValue(position);
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show inspector' })).toBeVisible();
  await page.getByRole('button', { name: 'Show inspector' }).click();
  await expect(page.getByRole('tabpanel')).toBeVisible();
  const jump = page.getByLabel('Jump to event', { exact: true });
  const call = jump.locator('option').filter({ hasText: 'Call fib' }).first();
  const eventStep = (await call.getAttribute('value'))!;
  await jump.selectOption(eventStep);
  await expect(slider(page)).toHaveValue(eventStep);
  await page.reload();
  await inspect(page);
  await page.getByText('View', { exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Call tree' })).not.toBeChecked();
});

test('reorder visualizations by pointer and buttons, zoom and focus variables', async ({ page }) => {
  await offline(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#watch');
  await example(page, 'BFS with queue');
  await last(page);
  await expect(page.locator('#stage > [data-viz-id]:visible')).toHaveCount(2);
  await page.getByRole('button', { name: /Show supporting visuals/ }).click();
  const cards = page.locator('#stage > [data-viz-id]:visible');
  const order = () => cards.evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.vizId!));
  const before = await order();
  expect(before.length).toBeGreaterThan(2);
  await cards.nth(1).getByRole('button', { name: 'Move card up' }).click();
  expect((await order())[0]).toBe(before[1]);
  const handle = cards.first().locator('.hd');
  const destination = cards.nth(1);
  await handle.scrollIntoViewIfNeeded();
  const a = (await handle.boundingBox())!, b = (await destination.boundingBox())!;
  const targetId = await destination.getAttribute('data-viz-id');
  await expect.poll(() => page.evaluate(({ x, y }) =>
    document.elementFromPoint(x, y)?.closest('[data-viz-id]')?.getAttribute('data-viz-id'),
    { x: b.x + 25, y: b.y + 14 })).toBe(targetId);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 25, b.y + 14, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await order())[0]).toBe(before[0]);
  const diagram = page.locator('.diagram-viewport').first();
  const zoomButton = diagram.locator('..').getByRole('button', { name: 'Zoom in' });
  await expect(diagram).toBeVisible();
  const transform = await diagram.locator('svg').evaluate(svg => (svg as SVGElement).style.transform);
  await zoomButton.click();
  await expect.poll(() => diagram.locator('svg').evaluate(svg => (svg as SVGElement).style.transform)).not.toBe(transform);
  await page.getByRole('button', { name: 'Previous step' }).click();
  expect((await order())[0]).toBe(before[0]);
  await page.getByRole('tabpanel').getByRole('button', { name: /^graph/ }).click();
  await expect(page.locator('.focused-card')).toContainText('graph');
});

test('mobile custom runs, retained draft, stale replay, syntax diagnostics', async ({ page }) => {
  test.setTimeout(190000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#watch');
  await inspect(page);
  await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Code', exact: true }).click();
  await expect(editor(page)).toBeInViewport();
  expect((await page.getByRole('region', { name: 'Code editor' }).boundingBox())!.height).toBeGreaterThan(450);
  await example(page, 'My code');
  const code = 'arr = [3, 1, 2]\nprint(sorted(arr))';
  await editor(page).fill(code);
  await writeActions(page).getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Watch event' })).toBeVisible({ timeout: 90000 });
  await inspect(page);
  await last(page);
  await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'State', exact: true }).click();
  await page.getByRole('tab', { name: 'Output' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('[1, 2, 3]');
  const originalStep = await slider(page).inputValue();
  await page.locator('header').getByRole('button', { name: 'Write', exact: true }).click();
  await editor(page).fill('if True print(1)');
  await page.locator('header').getByRole('button', { name: 'Watch', exact: true }).click();
  await inspect(page);
  await expect(slider(page)).toHaveValue(originalStep);
  await page.locator('header').getByRole('button', { name: 'Write', exact: true }).click();
  await expect(editor(page)).toContainText('if True print(1)');
  await writeActions(page).getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(page.getByText(/Line 1, column .*SyntaxError/)).toBeVisible({ timeout: 90000 });
  await expect(page.locator('.cm-error-line')).toBeVisible();
  await expect(page.locator('header').getByRole('button', { name: 'Watch', exact: true })).toBeVisible();
  await example(page, 'Heap');
  await example(page, 'My code');
  await expect(editor(page)).toContainText('if True print(1)');
  await page.reload();
  await expect(editor(page)).toContainText('if True print(1)');
  await expect(writeActions(page).getByRole('button', { name: 'Watch', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('bundled lessons expose their key decision and finish with the offline engine', async ({ page }) => {
  test.setTimeout(120000);
  await offline(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#watch');
  await page.locator('header').getByRole('button', { name: 'Examples', exact: true }).click();
  const samples = await page.locator('.catalog-card').evaluateAll(options => options.map(option => option.getAttribute('aria-label')!));
  expect(samples).toHaveLength(18);
  const landmarks: Record<string, [string, string]> = {
    'Insertion sort': ['First insert', 'Place 3 at index 0.'],
    'Sliding window': ['First shrink', 'Remove 2 from the left. The sum is 7.'],
    'Monotonic stack': ['First pop', '74 > 73, so pop the value at index 0.'],
    'Kadane': ['First restart', 'The best ending here is 1.'],
    'Heap': ['First pop minimum', 'Remove the minimum 1.'],
    'Knapsack': ['First skip item', 'taking gives 30 and skipping gives 35.'],
    'Intervals': ['First merge', 'Combine [1, 3] and [2, 6] into [1, 6].'],
    'Trie': ['First mark word', 'Mark cat as a complete word.'],
    'Two Sum (dict)': ['First match', 'Together the values make 9.'],
    'Subsets (backtracking)': ['First exclusion', 'Explore without the last choice of 3.'],
    'Permutations': ['First undo', 'Undo 3 and make it available again.'],
  };
  for (const sample of samples) {
    await page.locator('header').getByRole('button', { name: 'Examples', exact: true }).click();
    await page.getByRole('button', { name: sample, exact: true }).click();
    await expect(page.getByRole('heading', { name: sample, exact: true })).toBeVisible();
    await writeActions(page).getByRole('button', { name: 'Watch', exact: true }).click();
    await expect(page.getByRole('slider', { name: 'Watch event' })).toBeVisible();
    if (landmarks[sample]) {
      const [label, caption] = landmarks[sample];
      await page.getByRole('combobox', { name: 'Jump to landmark' }).selectOption({ label });
      await expect(page.locator('.watch-caption:visible')).toContainText(caption);
      await page.getByRole('button', { name: 'Inspect this moment' }).click();
      await expect(page.locator('.step-note')).toContainText(caption);
    } else await inspect(page);
    await last(page);
    await expect(page.getByText('Complete', { exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('live run and rapid seeking through a 3,600-step custom trace', async ({ page }) => {
  await page.goto('/#watch');
  await example(page, 'My code');
  await page.getByRole('checkbox', { name: 'Live run' }).check();
  await editor(page).fill('arr = [0]\nfor i in range(1800):\n    arr[0] = i\nprint(arr[0])');
  await expect(page.getByText('Run ready', { exact: true })).toBeVisible({ timeout: 90000 });
  await inspect(page);
  await expect.poll(async () => Number(await slider(page).getAttribute('max')), { timeout: 90000 }).toBeGreaterThan(3600);
  const duration = await slider(page).evaluate(async (element: HTMLInputElement) => {
    const start = performance.now();
    const positions = [400, 2100, 300, 3490, 1790, 3500];
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    for (const index of positions) {
      const changed = new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => { observer.disconnect(); reject(Error('The step did not update')); }, 1000);
        const observer = new MutationObserver(() => {
          if (!element.getAttribute('aria-valuetext')?.startsWith(index + ' ')) return;
          clearTimeout(deadline);
          observer.disconnect();
          resolve();
        });
        observer.observe(element, { attributes: true, attributeFilter: ['aria-valuetext'] });
      });
      valueSetter.call(element, String(index));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await changed;
    }
    return performance.now() - start;
  });
  expect(duration).toBeLessThan(1500);
  await expect(slider(page)).toHaveValue('3500');
  await expect(page.locator('#stage .cell:not(.out):not(.in)')).toBeVisible();
});
