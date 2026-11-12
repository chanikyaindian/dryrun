import { expect, test, type Page } from '@playwright/test';
import { SAMPLES } from '../js/samples.js';

const player = (page: Page) => page.locator('.watch-player');
const timeline = (page: Page) => page.getByRole('slider', { name: 'Watch event' });
const next = (page: Page) => player(page).getByRole('button', { name: 'Next event' });
const inspect = (page: Page) => page.locator('header').getByRole('button', { name: 'Inspect', exact: true });
async function openExample(page: Page, name: string) {
  await page.locator('header').getByRole('button', { name: name === 'My code' ? 'Write' : 'Examples', exact: true }).click();
  if (name !== 'My code') {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('complementary', { name: 'Run your Python' }).getByRole('button', { name: 'Watch', exact: true }).click();
  }
}
async function custom(page: Page, source: string) {
  await openExample(page, 'My code');
  await page.getByLabel('Python code', { exact: true }).fill(source);
  await page.getByRole('complementary', { name: 'Run your Python' }).getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(timeline(page)).toBeVisible({ timeout: 90000 });
}
async function findBeat(page: Page, text: RegExp) {
  const caption = player(page).locator('.watch-caption');
  for (let n = 0; n < 25; n++) {
    if (text.test(await caption.innerText())) return;
    if (!(await next(page).isEnabled())) break;
    await next(page).click();
  }
  await expect(caption).toHaveText(text);
}
test('default Watch hides debugging chrome and Inspect opens at the same line', async ({ page }) => {
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/#watch');
  await expect(player(page).locator('[data-scene="array"]')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Code editor' })).toBeHidden();
  await expect(page.getByRole('region', { name: 'Inspector' })).toBeHidden();
  await expect(player(page).locator('.array-glyph')).toHaveCount(5);
  await next(page).click();
  await expect(player(page).locator('.watch-caption')).toHaveText(/^Compare/);
  await inspect(page).click();
  const raw = page.getByRole('slider', { name: 'Playback step' });
  expect(Number(await raw.inputValue())).toBeGreaterThan(1);
  const index = Number(await raw.inputValue());
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(raw).toHaveValue(String(index + 1));
  await page.getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(timeline(page)).toBeVisible();
  await inspect(page).click();
  await expect(raw).toHaveValue(String(index + 1));
});

test('fullscreen fallback hides captions and returns focus and position', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: () => Promise.reject(Error('Unavailable')) });
  });
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#watch');
  await expect(player(page).locator('.array-glyph')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await next(page).click();
  const index = await timeline(page).inputValue();
  await player(page).getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Algorithm player' })).toBeVisible();
  await expect(player(page).locator('.watch-caption')).toHaveCount(0);
  await expect(player(page)).toHaveAttribute('data-controls', 'false', { timeout: 5000 });
  await page.keyboard.press('Tab');
  await expect(player(page)).toHaveAttribute('data-controls', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Algorithm player' })).toHaveCount(0);
  await expect(timeline(page)).toHaveValue(index);
  await expect(player(page).getByRole('button', { name: 'Fullscreen', exact: true })).toBeFocused();
});

test('custom sorting, binary search, and BFS cue only trace-backed events', async ({ page }) => {
  test.setTimeout(290000);
  await page.goto('/#watch');
  await custom(page, `items = [3, 1, 2]
noise = [8, 9, 10]
for turn in range(len(items)):
    for k in range(len(items) - turn - 1):
        if items[k] > items[k + 1]:
            items[k], items[k + 1] = items[k + 1], items[k]`);
  await expect(player(page).locator('.array-scene')).toHaveAttribute('aria-label', 'items, 3 values');
  await findBeat(page, /^Compare 3 and 1/);
  await expect(player(page).locator('.array-slot[data-active="true"]')).toHaveCount(2);
  await next(page).click();
  await expect(player(page).locator('.watch-caption')).toHaveText('Swap 3 and 1.');
  await expect(player(page).locator('.array-slot[data-changed="true"]')).toHaveCount(2);

  await custom(page, `items = [1, 3, 5, 7, 9, 11]
left = 0
right = len(items) - 1
while left <= right:
    center = (left + right) // 2
    if items[center] < 9:
        left = center + 1
    elif items[center] > 9:
        right = center - 1
    else:
        break`);
  await expect(player(page).locator('[data-scene="search"]')).toBeVisible();
  await findBeat(page, /^Check index 2/);
  await next(page).click();
  await expect(player(page).locator('.watch-caption')).toHaveText('Keep indices 3 through 5.');
  await expect(player(page).locator('.array-slot[data-outside="true"]')).toHaveCount(3);

  await custom(page, `from collections import deque
links = {'A': ['B', 'C'], 'B': ['D'], 'C': [], 'D': []}
pending = deque(['A'])
discovered = {'A'}
while pending:
    vertex = pending.popleft()
    for neighbor in links[vertex]:
        if neighbor not in discovered:
            discovered.add(neighbor)
            pending.append(neighbor)
    links[vertex].clear()`);
  await expect(player(page).locator('[data-scene="graph"]')).toBeVisible();
  await findBeat(page, /^Take A/);
  await expect(player(page).locator('.watch-node[data-active="true"]')).toContainText('A');
  await next(page).click();
  await expect(player(page).locator('.watch-caption')).toHaveText('Add B to the back of the queue. It is a neighbor of A.');
  await expect(player(page).locator('.watch-edge[data-active="true"]')).toHaveCount(1);
  await expect(player(page).getByLabel('Queue', { exact: true })).toContainText('B');
  await expect(player(page).getByLabel('Removal order', { exact: true })).toContainText('A');
  await timeline(page).press('End');
  await expect(player(page).locator('.watch-node')).toHaveCount(4);
  await expect(player(page).locator('.watch-edge')).toHaveCount(0);
});
 
test('Watch animates a real swap and seeks without replaying the animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(...args) {
      if (this.classList.contains('array-glyph')) document.body.dataset.swapMoves = String(Number(document.body.dataset.swapMoves ?? 0) + 1);
      return animate.apply(this, args);
    };
  });
  await page.goto('/#watch');
  await expect(player(page).locator('.array-glyph')).toHaveCount(5);
  await findBeat(page, /^Compare 5 and 2/);
  await next(page).click();
  await expect(player(page).locator('.watch-caption')).toHaveText('Swap 5 and 2.');
  await expect(page.locator('body')).toHaveAttribute('data-swap-moves', '2');
  await timeline(page).fill('0');
  await timeline(page).fill('2');
  await expect(page.locator('body')).toHaveAttribute('data-swap-moves', '2');
});

test('native fullscreen preserves zoom and the current Watch event', async ({ page }) => {
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/#watch');
  test.skip(!(await page.evaluate(() => document.fullscreenEnabled)), 'This browser does not expose native fullscreen');
  await openExample(page, 'BFS with queue');
  await expect(player(page).locator('.watch-graph')).toBeVisible();
  await findBeat(page, /^Take 1/);
  await player(page).getByRole('button', { name: 'Zoom in' }).click();
  const zoom = await player(page).locator('.watch-graph > g').getAttribute('transform');
  const index = await timeline(page).inputValue();
  await player(page).getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains('watch-player'))).toBe(true);
  await player(page).getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(page.getByRole('dialog', { name: 'Algorithm player' })).toHaveCount(0);
  await expect(timeline(page)).toHaveValue(index);
  await expect(player(page).locator('.watch-graph > g')).toHaveAttribute('transform', zoom!);
});

test('grid Watch highlights recurrence inputs and the destination', async ({ page }) => {
  await page.goto('/#watch');
  await custom(page, `totals = [[1, 1], [1, 0]]
totals[1][1] = totals[0][1] + totals[1][0]
print(totals[1][1])`);
  await expect(player(page).locator('[data-scene="grid"]')).toBeVisible();
  await findBeat(page, /Update cell \[1, 1\]/);
  await expect(player(page).locator('td[data-read="true"]')).toHaveCount(2);
  await expect(player(page).locator('td[data-cue]')).toHaveText('2');
});

test('long recursive Watch fits every edge and can follow calls at readable size', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#watch');
  await custom(page, `def height(n):
    if n < 2:
        return n
    return height(n - 1) + height(n - 2)

print(height(9))`);
  const tree = player(page).getByRole('img', { name: 'Call tree' });
  const activeCall = tree.locator('.watch-call[data-active="true"]');
  const labels = tree.locator('.watch-call');
  const viewport = player(page).getByLabel('Call tree viewport', { exact: true });
  await expect(activeCall.locator('text')).toHaveText('height(9)');
  await expect.poll(async () => (await activeCall.locator('text').boundingBox())!.height).toBeGreaterThanOrEqual(11);

  const max = Number(await timeline(page).getAttribute('max'));
  expect(max).toBeGreaterThan(100);
  await player(page).getByRole('button', { name: 'Follow active call' }).click();
  await timeline(page).fill(String(max - 12));
  await expect.poll(async () => Number(await activeCall.getAttribute('data-call-id'))).toBeGreaterThan(89);
  expect(await labels.count()).toBeGreaterThan(90);
  await expect(tree.locator('.call-link')).toHaveCount((await labels.count()) - 1);
  await expect.poll(async () => (await activeCall.locator('text').boundingBox())!.height).toBeGreaterThanOrEqual(11);
  await expect.poll(async () => viewport.evaluate(el => el.scrollWidth - el.clientWidth)).toBeGreaterThan(0);

  await player(page).getByRole('button', { name: 'Fit tree' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await tree.boundingBox())!.width).toBeLessThan(390);
  await timeline(page).press('End');
  await expect(activeCall.locator('text')).toHaveText('height(9)');
  await expect(tree.locator('.call-return').first()).toHaveText('34');
});

test('desktop backtracking connects the first save and undo to the raw trace', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#write');
  await custom(page, SAMPLES.Permutations);
  const surface = player(page);
  const caption = surface.locator('.watch-caption');
  const currentPath = surface.getByRole('region', { name: 'Current path' });
  const candidates = surface.getByRole('region', { name: 'Candidates' });
  const saved = surface.getByRole('region', { name: 'Saved paths' });
  const jump = surface.getByRole('combobox', { name: 'Jump to landmark' });
  const tree = surface.getByRole('img', { name: 'Call tree' });
  await expect(surface.locator('[data-scene="backtracking"]')).toBeVisible();
  await expect(tree).toHaveCount(0);
  await findBeat(page, /Skip 1 because it’s already in the path/);
  await expect(candidates.locator('[data-used="true"]')).toHaveText('1Used');
  await jump.selectOption({ label: 'First complete path' });
  await expect(caption).toHaveText('Save a copy of [1, 2, 3].');
  await expect(currentPath.locator('h3 code')).toHaveText('[1, 2, 3]');
  await jump.selectOption({ label: 'First undo' });
  await expect(caption).toHaveText('Undo 3 and make it available again.');
  await expect(currentPath.locator('h3 code')).toHaveText('[1, 2]');
  await expect(saved.locator('li')).toHaveText('[1, 2, 3]');
  await expect(candidates.locator('[data-used="false"]')).toHaveText('3Available');

  await surface.getByText('View details', { exact: true }).click();
  await surface.getByRole('checkbox', { name: 'Call tree' }).check();
  await expect(tree.locator('.watch-call text')).toContainText(['[1, 2]']);
  await surface.getByRole('checkbox', { name: 'Call stack' }).check();
  await expect(surface.getByRole('list', { name: 'Call stack' })).toBeVisible();
  await surface.getByRole('checkbox', { name: 'Call tree' }).uncheck();
  await expect(tree).toHaveCount(0);

  await surface.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(caption).toHaveText('Undo 3 and make it available again.');
  await expect(currentPath).toBeVisible();
  await expect(surface.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(surface.getByRole('button', { name: 'Fullscreen', exact: true })).toBeFocused();
  await surface.getByRole('button', { name: 'Inspect this moment' }).click();
  await expect(page.getByRole('slider', { name: 'Playback step' })).toHaveValue('39');
  await expect(page.locator('.step-note')).toContainText('Undo 3 and make it available again.');
  await expect(page.locator('.cm-execution-gutter')).toHaveCount(0);
  await expect(page.locator('.cm-just-ran')).toBeVisible();
  await expect(page.locator('.cm-next-line')).toBeVisible();
  await page.locator('header').getByRole('button', { name: 'Watch', exact: true }).click();
  await timeline(page).press('End');
  await expect(saved.locator('.decision-count')).toHaveText('6');
  await surface.getByRole('button', { name: 'Open printed output' }).click();
  await expect(page.locator('.output-block pre')).toContainText('[[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]');
});

test('custom two-pointer, prefix-sum and bit traces explain observed operations', async ({ page }) => {
  test.setTimeout(290000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#write');
  await custom(page, `data = [1, 4, 5, 8]
left, right = 0, len(data) - 1
while left < right:
    pair = data[left] + data[right]
    if pair < 10:
        left += 1
    elif pair > 10:
        right -= 1
    else:
        break
print(pair)`);
  await findBeat(page, /Their sum is 9/);
  await findBeat(page, /Move the left pointer to index 1/);
  await custom(page, `data = [4, 6, 3]
totals = [0]
for value in data:
    totals.append(totals[-1] + value)
lo, hi = 1, 2
print(totals[hi + 1] - totals[lo])`);
  await findBeat(page, /Subtract the prefix total 4 from 13 to get 9/);
  await custom(page, `flags = 0
bit = 2
flags |= (1 << bit)
flags ^= (1 << bit)
print(flags)`);
  await findBeat(page, /Toggle bit 2. The value is 0/);
  await expect(player(page).getByRole('region', { name: 'Bits · least significant first' }).locator('[data-active="true"]')).toHaveText('02');
});

test('custom shortest-path and disjoint-set traces show verified updates', async ({ page }) => {
  test.setTimeout(190000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#write');
  await custom(page, `from heapq import heappush, heappop
graph = [[(1, 4), (2, 1)], [], [(1, 2)]]
dist = [0, 99, 99]
queue = [(0, 0)]
while queue:
    d, u = heappop(queue)
    if d != dist[u]:
        continue
    for v, w in graph[u]:
        alt = d + w
        if alt < dist[v]:
            dist[v] = alt
            heappush(queue, (alt, v))
print(dist)`);
  await findBeat(page, /Improve the distance to 1 from 4 to 3/);
  await expect(player(page).getByRole('region', { name: 'Vertex → best known distance' }).locator('[data-active="true"]')).toHaveText('1 → 3');
  await custom(page, `parent = [0, 1, 2]
def find(x):
    while parent[x] != x:
        x = parent[x]
    return parent[x]
def union(a, b):
    root_a, root_b = find(a), find(b)
    if root_a != root_b:
        parent[root_b] = root_a
union(0, 1)
union(2, 0)
print(parent)`);
  await findBeat(page, /Point representative 0 to 2 to join the sets/);
  await expect(player(page).getByRole('region', { name: 'Node → parent' }).locator('[data-active="true"]')).toHaveText('0 → 2');
});

test('linked-list reversal follows actual pointer changes in Watch', async ({ page }) => {
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/#watch');
  await openExample(page, 'Linked list reverse');
  const links = player(page).getByRole('img', { name: 'Node links' });
  await expect(links).toBeVisible();
  await findBeat(page, /Remove the next link from 1/);
  await expect(links.locator('.linked-node[data-active="true"] text')).toHaveText('1');
  await findBeat(page, /Connect 2 to 1 through next/);
  await expect(links.locator('.linked-edge[data-active="true"]')).toHaveCount(1);
});

test('compact layouts keep graph controls and editor navigation inside the viewport', async ({ page }) => {
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#watch');
  await openExample(page, 'BFS with queue');
  await expect(player(page).locator('.watch-graph')).toBeVisible();
  await expect(player(page).getByRole('button', { name: 'Fullscreen', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await inspect(page).click();
  await expect(page.locator('header').getByRole('button', { name: 'Write', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
