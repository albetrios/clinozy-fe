import { expect, test } from '@playwright/test';

import { API_ENDPOINTS } from '@/core/config/constants.ts';
import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';
import { readAppSignInMethods } from '@/tests/utils/e2e-app-config.ts';
import { registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import { uniqueE2eEmail } from '@/tests/utils/e2e-faker.ts';
import {
  clickTestId,
  expectAuthScreenReady,
  fillEmailVerificationCode,
  fillTestId,
  gotoApp,
  submitAuthEmailForCode,
} from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

test.describe('Authentication', () => {
  test('shows unified auth screen with email open by default', async ({ page }) => {
    await gotoApp(page, '/login');
    await expectAuthScreenReady(page);
    await expect(page.getByTestId('auth-email-panel')).toBeVisible();
    // Google sits beside the email panel exactly when this deployment offers it.
    const { google } = await readAppSignInMethods(page);
    await expect(page.getByTestId('auth-continue-google')).toHaveCount(google ? 1 : 0);
  });

  test('invalid verification code calls the API and surfaces an error', async ({
    page,
  }) => {
    let verifyStatus = 0;
    page.on('response', (res) => {
      if (res.url().includes(API_ENDPOINTS.AUTH.EMAIL_CODE_LOGIN))
        verifyStatus = res.status();
    });

    await gotoApp(page, '/login');
    await submitAuthEmailForCode(page, uniqueE2eEmail('wrong'));
    await fillEmailVerificationCode(page, '000000');
    await expect.poll(() => verifyStatus, { timeout: 15000 }).toBe(401);
    await expect(page.getByTestId('auth-email-verify-panel')).toBeVisible();
  });

  test('email-code sign-in through clinozy-be reaches Today', async ({ page }) => {
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    );
    await registerNewUserAndGoToToday(page);
    await expect(page.getByTestId('today-page')).toBeVisible();
  });

  test('MFA route shows session-expired shell without token', async ({ page }) => {
    await page.goto('/mfa');
    await expect(page.getByTestId('mfa-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /session expired/i })).toBeVisible();
  });

  test('OAuth callback without session redirects to login', async ({ page }) => {
    await page.goto('/callback/google');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expectAuthScreenReady(page);
  });

  test('unauthorized page is public', async ({ page }) => {
    await page.goto('/unauthorized');
    await expect(page.getByTestId('unauthorized-page')).toBeVisible();
  });

  /**
   * GitHub OAuth is not provisioned for this deployment, so `AuthForm` filters its
   * button out even where `VITE_AUTH_OAUTH_GITHUB` is on (the icon, test id and
   * `/callback` stay wired). Google is the one provider offered — where
   * `VITE_AUTH_OAUTH_GOOGLE` turns it on; off, its button is absent too. When
   * GitHub's credentials exist and the filter goes, this spec is the one to flip.
   */
  test('offers Continue with Google where it is on, and not GitHub until its OAuth is provisioned', async ({
    page,
  }) => {
    await gotoApp(page, '/login');
    await expectAuthScreenReady(page);
    const { google } = await readAppSignInMethods(page);
    if (google) {
      await expect(page.getByTestId('auth-continue-google')).toBeVisible();
      await expect(
        page.getByRole('button', { name: /continue with google/i }),
      ).toBeVisible();
    } else {
      await expect(page.getByTestId('auth-continue-google')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: /continue with google/i }),
      ).toHaveCount(0);
    }
    await expect(page.getByTestId('auth-continue-github')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /continue with github/i })).toHaveCount(
      0,
    );
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.addInitScript((key: string) => {
      sessionStorage.setItem(key, '1');
    }, `${PRODUCT_NAMESPACE}-auth-skip-auto-google`);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expectAuthScreenReady(page);
  });

  test('rejects empty email submit', async ({ page }) => {
    await gotoApp(page, '/login');
    await fillTestId(page, 'auth-email', '');
    await clickTestId(page, 'auth-email-submit');
    await expect(page.getByTestId('auth-email-error')).toBeVisible();
  });

  test('email verification step shows resend and change email actions', async ({
    page,
  }) => {
    const email = uniqueE2eEmail('verify-flow');
    await gotoApp(page, '/login');
    await submitAuthEmailForCode(page, email);
    await expect(page.getByText(/we sent a verification code to/i)).toBeVisible();
    await expect(page.getByText(/didn't receive a code/i)).toBeVisible();
    await expect(page.getByTestId('auth-email-resend-countdown')).toBeVisible();
    await expect(page.getByTestId('auth-email-change')).toBeVisible();
  });

  test('an invalid email format is blocked by native validation and never calls send-code', async ({
    page,
  }) => {
    let sendCodeCalled = false;
    page.on('request', (req) => {
      if (req.url().includes(API_ENDPOINTS.AUTH.EMAIL_CODE_SEND)) sendCodeCalled = true;
    });

    await gotoApp(page, '/login');
    await fillTestId(page, 'auth-email', 'not-an-email');
    await clickTestId(page, 'auth-email-submit');

    // The field is type="email" with no noValidate, so the browser's constraint
    // validation blocks submission: the input is invalid (typeMismatch), the
    // request never fires, and we stay on the email panel.
    const validity = await page.getByTestId('auth-email').evaluate((el) => {
      const input = el as HTMLInputElement;
      return { valid: input.validity.valid, typeMismatch: input.validity.typeMismatch };
    });
    expect(validity).toEqual({ valid: false, typeMismatch: true });
    await expect(page.getByTestId('auth-email-verify-panel')).toBeHidden();
    expect(sendCodeCalled).toBe(false);
  });

  test('the change-email action returns from verification to the email entry panel', async ({
    page,
  }) => {
    const email = uniqueE2eEmail('change-email');
    await gotoApp(page, '/login');
    await submitAuthEmailForCode(page, email);
    await expect(page.getByTestId('auth-email-verify-panel')).toBeVisible();

    await clickTestId(page, 'auth-email-change');
    await expect(page.getByTestId('auth-email-panel')).toBeVisible();
    await expect(page.getByTestId('auth-email')).toBeVisible();
  });
});
