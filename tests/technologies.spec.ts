import { expect, test } from '@playwright/test';

test('five seamless logo rows move in alternating directions and can all be paused', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('#technologies');
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute('data-offscreen', 'false');
  const rows = section.locator('.technology-row');
  await expect(rows).toHaveCount(5);
  // Read actual rendered transforms at two animation times, independent of machine speed.
  for (let index = 0; index < 5; index++) {
    const geometry = await rows.nth(index).evaluate(row => {
      const track = row.querySelector<HTMLElement>('.technology-track')!;
      const animation = track.getAnimations()[0];
      animation.pause();
      const xAt = (time: number) => {
        animation.currentTime = time;
        return new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
      };
      const x1 = xAt(1000), x2 = xAt(2000);
      animation.play();
      const cycles = [...row.querySelectorAll<HTMLElement>('.technology-cycle')];
      return { delta: x2 - x1, rowWidth: row.clientWidth, rowHeight: row.getBoundingClientRect().height, cycleWidth: cycles[0].getBoundingClientRect().width, copiesMatch: cycles[0].textContent === cycles[1].textContent };
    });
    expect(geometry.delta * (index % 2 === 0 ? 1 : -1)).toBeGreaterThan(0);
    expect(geometry.cycleWidth).toBeGreaterThan(geometry.rowWidth);
    expect(geometry.copiesMatch).toBe(true);
    expect(geometry.rowHeight).toBeLessThanOrEqual(104);
  }
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume animation' })).toHaveAttribute('aria-pressed', 'true');
  for (const track of await section.locator('.technology-track').all()) await expect(track).toHaveCSS('animation-play-state', 'paused');
  await page.getByRole('button', { name: 'Resume animation' }).click();
  await expect(section).toHaveAttribute('data-paused', 'false');
});

test('the entire section waits for the last logo to decode without changing its layout height', async ({ page }) => {
  let requested = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/technologies/aws-global-accelerator.svg', async route => {
    requested = true;
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => requested).toBe(true);
  const section = page.locator('#technologies');
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute('aria-busy', 'true');
  await expect(section.locator('.technologies-content')).toHaveCSS('visibility', 'hidden');
  await expect(section.locator('.technology-track').first()).toHaveCSS('animation-play-state', 'paused');
  const heightBefore = await section.evaluate(element => element.getBoundingClientRect().height);
  release();
  await expect(section).toHaveAttribute('data-logos-ready', 'true');
  await expect(section.locator('.technologies-content')).toBeVisible();
  expect(await section.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await section.evaluate(element => element.getBoundingClientRect().height)).toBe(heightBefore);
});

test('an offscreen loop copy must finish decoding before any rows appear', async ({ page }) => {
  // Hold decoding of one repeated image even after its network request has finished.
  await page.addInitScript(() => {
    const originalDecode = HTMLImageElement.prototype.decode;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    (window as Window & { releaseLogoDecode?: () => void }).releaseLogoDecode = release;
    let held = false;
    HTMLImageElement.prototype.decode = async function () {
      await originalDecode.call(this);
      if (!held && this.closest('.technology-cycle--repeat')) {
        held = true;
        await gate;
      }
    };
  });
  await page.goto('/');
  const section = page.locator('#technologies');
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute('aria-busy', 'true');
  await expect(section.locator('.technologies-content')).toHaveCSS('visibility', 'hidden');
  expect(await section.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.evaluate(() => (window as Window & { releaseLogoDecode?: () => void }).releaseLogoDecode!());
  await expect(section).toHaveAttribute('data-logos-ready', 'true');
  await expect(section.locator('.technologies-content')).toBeVisible();
});

test('a failed logo keeps all rows hidden and a retry reveals the complete wall', async ({ page }) => {
  const path = '**/technologies/claudecode.svg';
  await page.route(path, route => route.abort());
  await page.goto('/');
  const section = page.locator('#technologies');
  await expect(section.locator('.technologies-load-error')).toBeVisible();
  await expect(section.locator('.technologies-content')).toHaveCSS('visibility', 'hidden');
  await expect(section).not.toHaveAttribute('data-logos-ready', 'true');
  await page.unroute(path);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(section).toHaveAttribute('data-logos-ready', 'true');
  await expect(section.locator('.technologies-load-error')).toBeHidden();
  await expect(section.locator('.technologies-content')).toBeVisible();
});

test('hover repeatedly pauses a row, lifts its logo, and reveals its full name', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch interaction is checked separately.');
  await page.goto('/');
  const row = page.locator('.technology-row').first();
  await row.scrollIntoViewIfNeeded();
  const index = await row.locator('.technology-logo').evaluateAll(logos => logos.findIndex(logo => {
    const rect = logo.getBoundingClientRect();
    return rect.left > innerWidth * .3 && rect.right < innerWidth * .7;
  }));
  expect(index).toBeGreaterThanOrEqual(0);
  const logo = row.locator('.technology-logo').nth(index);
  for (let i = 0; i < 2; i++) {
    // Moving targets intentionally never become "stable" for Playwright's default action wait.
    await logo.hover({ force: true });
    await expect(row.locator('.technology-track')).toHaveCSS('animation-play-state', 'paused');
    await expect(logo.locator('.technology-tooltip')).toHaveCSS('opacity', '1');
    await expect(logo.locator('.technology-tooltip')).toBeVisible();
    expect(await logo.locator('.technology-tooltip').textContent()).toBe(await logo.getAttribute('aria-label'));
    await expect.poll(() => logo.locator('.technology-logo-art').evaluate(art => new DOMMatrixReadOnly(getComputedStyle(art).transform).m11)).toBeGreaterThan(1.1);
    await logo.locator('.technology-tooltip').hover();
    await expect(logo.locator('.technology-tooltip')).toHaveCSS('opacity', '1');
    await expect(row.locator('.technology-track')).toHaveCSS('animation-play-state', 'paused');
    await page.keyboard.press('Escape');
    await expect(logo.locator('.technology-tooltip')).toHaveCSS('opacity', '0');
    await page.mouse.move(0, 0);
    await expect(row.locator('.technology-track')).toHaveCSS('animation-play-state', 'running');
    await expect(logo.locator('.technology-tooltip')).toHaveCSS('opacity', '0');
  }
});

test('keyboard users get stable, visible logos and only one copy of each accessible name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'JavaScript', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Kubernetes', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Pause animation', exact: true }).focus();
  await page.keyboard.press('Tab');
  const row = page.locator('.technology-row').first();
  await expect(row).toHaveAttribute('data-keyboard', 'true');
  const originalCount = await row.getByRole('button').count();
  for (let index = 0; index < originalCount; index++) {
    const logo = page.locator('.technology-logo:focus');
    await expect(logo).toBeInViewport();
    await expect(logo.locator('.technology-tooltip')).toHaveCSS('opacity', '1');
    await expect(logo.locator('.technology-tooltip')).toBeVisible();
    await expect(row.locator('.technology-track')).toHaveCSS('animation-name', 'none');
    await page.keyboard.press('Tab');
  }
  await expect(row).not.toHaveAttribute('data-keyboard');
  await expect(page.getByRole('button', { name: 'React', exact: true })).toBeFocused();
});

test('reduced motion shows static original logos with horizontal browsing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.technologies-motion')).toBeHidden();
  for (const row of await page.locator('.technology-row').all()) {
    await expect(row.locator('.technology-track')).toHaveCSS('animation-name', 'none');
    await expect(row).toHaveCSS('overflow-x', 'auto');
    expect(await row.locator('.technology-logo:visible').count()).toBeGreaterThanOrEqual(10);
    await expect(row.locator('.technology-cycle--repeat')).toBeHidden();
  }
  const last = page.getByRole('button', { name: 'Bash', exact: true });
  await last.focus();
  await expect(last).toBeInViewport();
});

test('local logos load in both themes and touch reveals a name until dismissed', async ({ page, isMobile }) => {
  await page.goto('/');
  const section = page.locator('#technologies');
  await section.scrollIntoViewIfNeeded();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    // Verify every distinct local asset, including logos currently outside the animated viewport.
    expect(await section.locator('img').evaluateAll(async images => {
      const paths = [...new Set(images.map(image => (image as HTMLImageElement).src))];
      return Promise.all(paths.map(src => new Promise<boolean>(resolve => {
        const img = new Image(); img.onload = () => resolve(img.naturalWidth > 0); img.onerror = () => resolve(false); img.src = src;
      })));
    })).not.toContain(false);
  }
  if (isMobile) {
    const row = section.locator('.technology-row').first();
    await row.scrollIntoViewIfNeeded();
    const index = await row.locator('.technology-logo').evaluateAll(logos => logos.findIndex(logo => {
      const rect = logo.getBoundingClientRect(); return rect.left > 40 && rect.right < innerWidth - 40;
    }));
    const logo = row.locator('.technology-logo').nth(index);
    await logo.tap({ force: true });
    await expect(logo.locator('.technology-tooltip')).toHaveCSS('opacity', '1');
    await expect(logo.locator('.technology-tooltip')).toBeVisible();
    await expect(row.locator('.technology-track')).toHaveCSS('animation-play-state', 'paused');
    await page.getByRole('heading', { name: 'Technologies.' }).tap();
    await expect(logo.locator('.technology-tooltip')).toHaveCSS('opacity', '0');
  }
});
