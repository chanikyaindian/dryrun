import { expect, type Page } from '@playwright/test';
import { run } from '../js/engine/js-engine.js';
import { makeWatch, watchLandmarks } from '../src/watchModel';
import type { DocumentSource } from '../src/workspace';

export async function openWatchOptions(page: Page) {
  const menu = page.locator('.watch-view');
  if (await menu.getAttribute('open') === null) {
    await menu.getByRole('button', { name: 'Playback options' }).click();
  }
}

export async function seekWatchCheckpoint(page: Page, document: DocumentSource, label?: string) {
  const trace = run(document.code);
  const model = makeWatch(document, trace, trace.evs);
  const checkpoints = [...watchLandmarks(model.beats)];
  const checkpoint = label ? checkpoints.find(([, title]) => title === label) : checkpoints[0];
  if (!checkpoint) throw new Error('Missing trace checkpoint: ' + (label ?? document.key));
  const [index] = checkpoint;
  const allSteps = await page.getByRole('combobox', { name: 'Playback detail' }).inputValue() === 'steps';
  const slider = page.getByRole('slider', { name: allSteps ? 'Watch step' : 'Watch event' });
  const at = allSteps ? index : model.beats.findIndex(beat => beat.index === index);
  await slider.fill(String(at));
  await expect(slider).toHaveValue(String(at));
  return index;
}
