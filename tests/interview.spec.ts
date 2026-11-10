import { expect, test } from '@playwright/test';
import { interviewCatalog } from '../js/interview-catalog.js';
import { interviewLessons } from '../js/interview-lessons.js';

test('Top Interview 150 has a walkthrough for every problem and filters the official list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Top Interview 150', exact: true }).click();
  await expect(page).toHaveURL(/#interview$/);
  const rows = page.locator('.interview-row');
  await expect(rows).toHaveCount(150);
  await expect(rows.first().getByRole('link')).toHaveText('Merge Sorted Array');
  await expect(rows.last().getByRole('link')).toHaveText('Maximal Square');
  await expect(rows.nth(24).getByRole('link')).toHaveText('Valid Palindrome');
  await expect(rows.last().getByRole('button', { name: 'Watch Maximal Square' })).toBeVisible();
  await expect(rows.getByRole('button', { name: /^Watch / })).toHaveCount(150);
  await expect(page.getByRole('checkbox', { name: 'Walkthroughs only' })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Find interview problems' }).fill('125');
  await expect(rows).toHaveCount(1);
  await expect(rows.getByRole('link')).toHaveAttribute('href', 'https://leetcode.com/problems/valid-palindrome/');
  await page.getByRole('combobox', { name: 'Topic' }).selectOption('Heap');
  await expect(page.getByText('No problems match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(rows).toHaveCount(150);
});

test('the study plan keeps filters and restores the lesson button after Inspect Focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/#interview');
  const search = page.getByRole('searchbox', { name: 'Find interview problems' });
  await page.getByRole('combobox', { name: 'Difficulty' }).selectOption('Hard');
  await expect(page.locator('.interview-row [data-difficulty]:not([data-difficulty="Hard"])')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(search).toBeFocused();
  await search.fill('#209');
  await search.press('Enter');
  await page.getByRole('button', { name: 'Inspect this moment' }).click();
  await page.getByText('View', { exact: true }).click();
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await page.getByRole('link', { name: 'Back to study plan' }).click();
  await expect(search).toHaveValue('#209');
  await expect(page.getByRole('button', { name: 'Watch Minimum Size Subarray Sum', exact: true })).toBeFocused();
});

test('walkthrough pointers follow their own arrays and slide with the window', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/#watch?lesson=merge-sorted-array');
  await page.getByRole('combobox', { name: 'Playback detail' }).selectOption('highlights');
  const landmark = page.getByRole('combobox', { name: 'Jump to landmark' });
  await landmark.selectOption({ label: 'First take from right' });
  const cellAt = (row: string, pointer: string) => page.locator('.watch-canvas li').filter({
    has: page.locator('[data-topic-pointer="' + row + ':' + pointer + '"]'),
  }).locator('code');
  await expect(cellAt('nums', 'left')).toHaveText('7');
  await expect(cellAt('nums', 'write')).toHaveText('8');
  await expect(cellAt('other', 'right')).toHaveText('8');

  await page.goto('/#watch?lesson=minimum-size-subarray-sum');
  await landmark.selectOption({ label: 'First expand' });
  const window = page.locator('.watch-canvas [data-in-window="true"] code');
  await expect(window).toHaveText(['2']);
  await expect(cellAt('nums', 'right')).toHaveText('2');
  await page.evaluate(() => {
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element) || !event.target.closest('[aria-label="Next event"]')) return;
      requestAnimationFrame(() => {
        const marker = document.querySelector('[data-topic-pointer="nums:right"]');
        document.body.dataset.pointerMoved = String(Boolean(marker?.getAnimations().some(animation =>
          animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some(frame => frame.transform?.startsWith('translate(')))));
      });
    });
  });
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(cellAt('nums', 'right')).toHaveText('1');
  await expect(window).toHaveText(['2', '1']);
  await expect(page.locator('body')).toHaveAttribute('data-pointer-moved', 'true');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-pointer-moved', 'false');
  await landmark.selectOption({ label: 'First shrink' });
  await expect(cellAt('nums', 'left')).toHaveText('1');
  await expect(window).toHaveText(['1', '5']);
  await page.getByRole('button', { name: 'Inspect this moment' }).click();
  await expect(page.locator('.inspect-results [data-in-window="true"] code')).toHaveText(['1', '5']);
});

test('Watch all steps and fullscreen Inspect share the trace position and explanation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: () => Promise.reject(Error('Unavailable')) });
  });
  await page.goto('/#watch?lesson=minimum-size-subarray-sum');
  const detail = page.getByRole('combobox', { name: 'Playback detail' });
  const watch = page.getByRole('slider', { name: 'Watch step' });
  await expect(detail).toHaveValue('steps');
  await expect(watch).toHaveValue('0');
  const last = await watch.getAttribute('max');
  await page.getByRole('combobox', { name: 'Jump to landmark' }).selectOption({ label: 'First expand' });
  const expanded = Number(await watch.inputValue());
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(watch).toHaveValue(String(expanded + 1));
  const caption = page.locator('.watch-caption:visible');
  await expect(caption).toContainText('Exit the loop.');
  const sentence = await caption.innerText();
  await detail.selectOption('highlights');
  const highlights = page.getByRole('slider', { name: 'Watch event' });
  expect(Number(await highlights.getAttribute('max'))).toBeLessThan(Number(last));
  await detail.selectOption('steps');
  await expect(watch).toHaveValue(String(expanded + 1));

  await page.getByRole('button', { name: 'Inspect this moment' }).click();
  const inspect = page.getByRole('slider', { name: 'Playback step' });
  await expect(inspect).toHaveAttribute('max', last!);
  await expect(inspect).toHaveValue(String(expanded + 1));
  await expect(page.locator('.step-note strong')).toHaveText(sentence);
  await page.getByRole('button', { name: 'Fullscreen Inspect' }).click();
  const dialog = page.getByRole('dialog', { name: 'Inspect fullscreen' });
  const toggle = dialog.getByRole('button', { name: 'Step explanation' });
  await expect(dialog.locator('.step-note strong')).toHaveText(sentence);
  await expect(dialog.locator('[data-viz-id="calls"]:visible')).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(dialog.locator('.step-note')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(inspect).toHaveValue(String(expanded + 2));
  await toggle.click();
  await expect(dialog.locator('.step-note strong')).not.toHaveText(sentence);
  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.step-note')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Fullscreen Inspect' }).click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

for (const start of [0, 25, 50, 75, 100, 125]) {
  test(`problems ${start + 1}–${start + 25} run offline and share checkpoints with Inspect`, async ({ page }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().route('https://cdn.jsdelivr.net/**', route => route.abort());
    await page.goto('/#interview');
    const lessons: Record<string, { output: string }> = interviewLessons;
    for (const [, title, slug] of interviewCatalog.slice(start, start + 25)) {
      await page.getByRole('button', { name: 'Watch ' + title, exact: true }).click();
      await expect(page).toHaveURL(new RegExp('#watch\\?lesson=' + slug + '$'));
      await expect(page.getByRole('heading', { name: String(title), exact: true })).toBeVisible();
      const landmark = page.getByRole('combobox', { name: 'Jump to landmark' });
      await landmark.selectOption({ index: 1 });
      if (slug === 'rotate-image') {
        await expect(page.getByRole('table', { name: 'matrix', exact: true })).toBeVisible();
        await expect(page.locator('.watch-canvas .topic-grid td[data-active="true"]')).toHaveCount(2);
      }
      if (slug === 'valid-sudoku') {
        await expect(page.getByRole('table', { name: 'board', exact: true }).locator('td')).toHaveCount(81);
        await expect(page.locator('.watch-canvas .topic-grid td[data-active="true"]')).toHaveCount(1);
      }
      if (slug === 'linked-list-cycle') {
        const diagram = page.getByRole('img', { name: 'Node links' });
        await expect(diagram).toBeVisible();
        await expect(diagram.getByText('slow', { exact: true })).toBeVisible();
        await expect(diagram.getByText('fast', { exact: true })).toBeVisible();
      }
      if (slug === 'invert-binary-tree') {
        await expect(page.getByRole('img', { name: 'Node links' }).locator('.linked-edge[data-active="true"]')).toHaveCount(2);
      }
      if (slug === 'design-add-and-search-words-data-structure') {
        await landmark.selectOption({ label: 'First try wildcard branch' });
      }
      if (slug === 'implement-trie-prefix-tree' || slug === 'design-add-and-search-words-data-structure') {
        await expect(page.getByRole('img', { name: 'Prefix tree' }).locator('g[data-active="true"]')).toHaveCount(1);
      }
      if (slug === 'word-search-ii') {
        await expect(page.getByRole('table', { name: 'board', exact: true }).locator('td')).toHaveCount(6);
      }
      if (slug === 'permutations') {
        await landmark.selectOption({ label: 'First save permutation' });
        await expect(page.getByRole('img', { name: 'Call tree', exact: true })).toHaveCount(0);
        await page.getByText('View details', { exact: true }).click();
        const calls = page.getByRole('checkbox', { name: 'Call tree' });
        await calls.check();
        const tree = page.getByRole('img', { name: 'Call tree', exact: true });
        await expect(tree).toBeInViewport({ ratio: 1 });
        await expect(tree.getByText('[1, 2, 3]', { exact: true })).toBeVisible();
        await calls.uncheck();
      }
      if (slug === 'search-insert-position') {
        await expect(page.locator('.watch-canvas .topic-cells [data-active="true"] code')).toHaveText('5');
        await landmark.selectOption({ label: 'First keep candidate' });
        await expect(page.locator('.watch-canvas .topic-cells [data-outside="true"] code')).toHaveText(['5', '6']);
      }
      if (slug === 'kth-largest-element-in-an-array') {
        await expect(page.getByRole('img', { name: 'Min heap tree' }).locator('g[data-active="true"]')).toHaveCount(1);
      }
      if (slug === 'reverse-bits') {
        const result = page.getByRole('region', { name: 'reversed_bits', exact: true });
        await expect(result.getByRole('listitem')).toHaveCount(32);
        await expect(result.locator('[data-active="true"] code')).toHaveText('1');
      }
      if (slug === 'maximal-square') {
        const table = page.getByRole('table', { name: 'sizes', exact: true });
        await expect(table.locator('td[data-active="true"]')).toHaveText('1');
        await expect(table.locator('td[data-related="true"]')).toHaveCount(3);
      }
      const checkpoint = await landmark.inputValue();
      const caption = await page.locator('.watch-caption:visible').innerText();
      await page.getByRole('button', { name: 'Inspect this moment' }).click();
      await expect(page).toHaveURL(new RegExp('#inspect\\?lesson=' + slug + '$'));
      const raw = page.getByRole('slider', { name: 'Playback step' });
      await expect(raw).toHaveValue(checkpoint);
      await expect(page.locator('.step-note')).toContainText(caption);
      if (slug === 'maximal-square') {
        await expect(page.getByRole('table', { name: 'sizes', exact: true }).locator('td[data-related="true"]')).toHaveCount(3);
      }
      if (slug === 'design-add-and-search-words-data-structure') {
        await expect(page.getByRole('img', { name: 'Prefix tree' }).locator('g[data-active="true"]')).toHaveCount(1);
      }
      if (slug === 'rotate-image') {
        await expect(page.locator('.inspect-results .topic-grid td[data-active="true"]')).toHaveCount(2);
        await expect(page.getByText('image, matrix, 3 by 3', { exact: true })).toHaveCount(0);
      }
      await page.getByRole('button', { name: 'Last step' }).click();
      await page.getByRole('tab', { name: 'Output' }).click();
      await expect(page.locator('.output-block pre')).toHaveText(lessons[String(slug)].output, { useInnerText: true });
      if (slug === 'valid-palindrome') {
        await page.reload();
        await expect(page.getByText('Valid Palindrome', { exact: true }).filter({ visible: true })).toBeVisible();
        await page.getByRole('button', { name: 'Last step' }).click();
        await page.getByRole('tab', { name: 'Output' }).click();
        await expect(page.locator('.output-block pre')).toHaveText(lessons[String(slug)].output, { useInnerText: true });
      }
      await page.getByRole('link', { name: 'Back to study plan' }).click();
      await expect(page).toHaveURL(/#interview$/);
    }
  });
}
