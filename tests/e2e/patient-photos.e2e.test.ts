import { expect, type Locator, type Page, test } from '@playwright/test';

import { APP_VIEWPORTS, openNewClinic } from '@/tests/utils/e2e-app.ts';
import { navigateInApp } from '@/tests/utils/e2e-auth.ts';
import { byTestId } from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * Patient photos on the live clinozy-be (change-patient-overview-photos,
 * change-photo-compare-zoom): four photos chosen through "Choose photos" go up to object
 * storage and are filed on the patient; Select picks them and Compare opens them side by side
 * on `?compare=`; Linked zooms every photo from where it stands, Separate one at a time; and the
 * comparison remembers its mode, its layout and each photo's zoom on the device — a cold load of
 * the same photos, in another order, opens it as it was left.
 *
 * Needs object storage on clinozy-be (`S3_*` in its `.env.local`, a bucket whose CORS admits this
 * origin): the photos are real uploads, so without it the upload step fails and says so.
 * Desktop, then the phone's bar on the same comparison.
 */

/** The four photos' names, as the files are picked — and as the tiles name them. */
const PHOTO_NAMES = ['cheek-week-1', 'cheek-week-2', 'cheek-week-3', 'cheek-week-4'];

/** One step of the zoom buttons: ×1.25 (`PHOTO_ZOOM.step`). */
const LEVEL = { start: '100%', oneStep: '125%', twoSteps: '156%' } as const;

/**
 * A PNG per name, drawn on a canvas in the page — a different colour and label each, so the
 * panels are told apart in a trace. clinozy-be checks the bytes are an image, so the files are.
 */
async function drawPhotos(
  page: Page,
  names: readonly string[],
): Promise<{ name: string; mimeType: string; buffer: Buffer }[]> {
  const urls = await page.evaluate((labels) => {
    return labels.map((label, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d canvas');
      context.fillStyle = `hsl(${index * 80}, 55%, 55%)`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.font = 'bold 64px sans-serif';
      context.textAlign = 'center';
      context.fillText(label, canvas.width / 2, canvas.height / 2);
      return canvas.toDataURL('image/png');
    });
  }, names);
  return urls.map((url, index) => ({
    name: `${names[index]}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'),
  }));
}

/** The comparison's panel of one photo. */
function panelOf(page: Page, photoId: string): Locator {
  return page.locator(
    `[data-testid="patient-photo-compare-panel"][data-photo="${photoId}"]`,
  );
}

/** Each photo's own level, read from its panel's zoom group (Separate). */
async function expectPanelLevels(
  page: Page,
  photoIds: readonly string[],
  levels: readonly string[],
): Promise<void> {
  for (const [index, photoId] of photoIds.entries()) {
    await expect(
      panelOf(page, photoId).getByTestId('patient-photo-compare-panel-zoom-reset'),
    ).toHaveText(levels[index] ?? LEVEL.start);
  }
}

/** The comparison is open over Photos: the dialog by its name, and its panels. */
async function expectComparisonOpen(page: Page, count: number): Promise<Locator> {
  const comparison = page.getByTestId('patient-photo-compare');
  await expect(comparison).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('dialog', { name: 'Compare photos' })).toBeVisible();
  await expect(page).toHaveURL(/[?&]compare=/);
  await expect(page.getByTestId('patient-photo-compare-panel')).toHaveCount(count, {
    timeout: 15_000,
  });
  return comparison;
}

test.beforeEach(async () => {
  test.skip(
    !(await verifyDatabaseConnection()),
    'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
  );
});

test.describe('Patient photos on clinozy-be', () => {
  test.use({ viewport: APP_VIEWPORTS.desktop });

  test('uploads four photos, compares them Linked and Separate, and remembers the comparison', async ({
    page,
  }) => {
    // A new clinic, four real uploads and a cold reload: more than the default minute.
    test.slow();
    const { slug, seed } = await openNewClinic(page, { seed: true });
    const patientId = seed?.patientId ?? '';
    expect(patientId, 'the seeded clinic has no patient').not.toBe('');

    await test.step('choose four photos — each uploads and is filed on the patient', async () => {
      await navigateInApp(page, `/organization/${slug}/patients/${patientId}/images`);
      await expect(page.getByTestId('patient-section-images')).toBeVisible({
        timeout: 15_000,
      });
      await page
        .getByTestId('patient-photos-input')
        .setInputFiles(await drawPhotos(page, PHOTO_NAMES));
      await expect(
        page.getByTestId('patient-photo-tile'),
        'the photos did not upload — clinozy-be needs object storage (S3_* in its .env.local)',
      ).toHaveCount(PHOTO_NAMES.length, { timeout: 60_000 });
      for (const name of PHOTO_NAMES) {
        await expect(page.getByRole('button', { name: `Open ${name}` })).toBeVisible();
      }
    });

    await test.step('select them — Compare waits for a second photo', async () => {
      await byTestId(page, 'patient-photos-select').click();
      await expect(page.getByTestId('patient-photos-selection')).toBeVisible();
      const tiles = page.getByTestId('patient-photo-tile');
      await tiles.nth(0).click();
      await expect(page.getByTestId('patient-photos-selection-count')).toHaveText(
        '1 selected',
      );
      await expect(page.getByTestId('patient-photos-compare')).toBeDisabled();
      for (const index of [1, 2, 3]) await tiles.nth(index).click();
      await expect(page.getByTestId('patient-photos-selection-count')).toHaveText(
        '4 selected',
      );
      await expect(
        page.locator('[data-testid="patient-photo-tile"][data-picked]'),
      ).toHaveCount(4);
    });

    const comparison =
      await test.step('Compare opens them side by side, Linked', async () => {
        await page.getByTestId('patient-photos-compare').click();
        const open = await expectComparisonOpen(page, PHOTO_NAMES.length);
        await expect(open).toHaveAttribute('data-zoom', 'linked');
        await expect(
          page.getByTestId('patient-photo-compare-zoom-mode-linked'),
        ).toHaveAttribute('aria-checked', 'true');
        // Four photos stand in one row by default, each drawn from its stored file.
        await expect(page.getByTestId('patient-photo-compare-stage')).toHaveAttribute(
          'data-columns',
          '4',
        );
        for (const image of await open.locator('img').all()) {
          await expect
            .poll(() =>
              image.evaluate((element: HTMLImageElement) => element.naturalWidth),
            )
            .toBeGreaterThan(0);
        }
        return open;
      });

    const photoIds = await page
      .getByTestId('patient-photo-compare-panel')
      .evaluateAll((panels) =>
        panels.map((panel) => panel.getAttribute('data-photo') ?? ''),
      );
    expect(photoIds.filter(Boolean)).toHaveLength(PHOTO_NAMES.length);

    await test.step('Linked: one step zooms every photo', async () => {
      await page.getByTestId('patient-photo-compare-zoom-in').click();
      await expect(page.getByTestId('patient-photo-compare-zoom-reset')).toHaveText(
        LEVEL.oneStep,
      );
      await page.getByTestId('patient-photo-compare-zoom-mode-separate').click();
      await expect(comparison).toHaveAttribute('data-zoom', 'separate');
      await expectPanelLevels(page, photoIds, Array(4).fill(LEVEL.oneStep));
    });

    await test.step('Separate: one photo zooms on its own', async () => {
      const second = photoIds[1] ?? '';
      await panelOf(page, second)
        .getByTestId('patient-photo-compare-panel-zoom-in')
        .click();
      await expectPanelLevels(page, photoIds, [
        LEVEL.oneStep,
        LEVEL.twoSteps,
        LEVEL.oneStep,
        LEVEL.oneStep,
      ]);
    });

    await test.step('Linked again: each photo moves from where it stands', async () => {
      await page.getByTestId('patient-photo-compare-zoom-mode-linked').click();
      await page.getByTestId('patient-photo-compare-zoom-out').click();
      await expect(page.getByTestId('patient-photo-compare-zoom-reset')).toHaveText(
        LEVEL.start,
      );
      await page.getByTestId('patient-photo-compare-zoom-mode-separate').click();
      await expectPanelLevels(page, photoIds, [
        LEVEL.start,
        LEVEL.oneStep,
        LEVEL.start,
        LEVEL.start,
      ]);
    });

    await test.step('a grid, then close', async () => {
      await page.getByTestId('patient-photo-compare-layout-grid').click();
      await expect(page.getByTestId('patient-photo-compare-stage')).toHaveAttribute(
        'data-columns',
        '2',
      );
      await page.getByTestId('patient-photo-compare-close').click();
      await expect(page.getByTestId('patient-photo-compare')).toHaveCount(0);
      await expect(page).not.toHaveURL(/[?&]compare=/);
    });

    await test.step('a cold load of the same photos, in another order, reopens it as it was left', async () => {
      const url = new URL(page.url());
      url.searchParams.set('compare', [...photoIds].reverse().join(','));
      await page.goto(url.toString());
      const reopened = await expectComparisonOpen(page, PHOTO_NAMES.length);
      await expect(reopened).toHaveAttribute('data-zoom', 'separate');
      await expect(page.getByTestId('patient-photo-compare-stage')).toHaveAttribute(
        'data-columns',
        '2',
      );
      await expectPanelLevels(page, photoIds, [
        LEVEL.start,
        LEVEL.oneStep,
        LEVEL.start,
        LEVEL.start,
      ]);
    });

    await test.step('Reset all puts every photo back to 100%', async () => {
      const resetAll = page.getByTestId('patient-photo-compare-reset-all');
      await expect(resetAll).toBeEnabled();
      await resetAll.click();
      await expectPanelLevels(page, photoIds, Array(4).fill(LEVEL.start));
      await expect(resetAll).toBeDisabled();
    });

    await test.step('on a phone the bar keeps Linked and Separate, and Escape closes it', async () => {
      await page.setViewportSize(APP_VIEWPORTS.phone);
      await expect(page.getByRole('radio', { name: 'Linked' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Separate' })).toBeVisible();
      await expect(page.getByTestId('patient-photo-compare-reset-all')).toBeHidden();
      await expect(page.getByTestId('patient-photo-compare-layout')).toBeHidden();
      await expect(page.getByTestId('patient-photo-compare-stage')).toHaveAttribute(
        'data-columns',
        '2',
      );
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('patient-photo-compare')).toHaveCount(0);
      await expect(page).not.toHaveURL(/[?&]compare=/);
    });
  });
});
