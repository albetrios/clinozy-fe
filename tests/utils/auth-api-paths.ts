import { API_BASE_PATH, API_ENDPOINTS } from '@/core/config/constants.ts';

/** Full URL paths for email sign-in contract tests (clinozy-be `docs/routes.txt`). */
export const AUTH_EMAIL_CODE_SEND_PATH = `${API_BASE_PATH}${API_ENDPOINTS.AUTH.EMAIL_CODE_SEND}`;
export const AUTH_EMAIL_CODE_LOGIN_PATH = `${API_BASE_PATH}${API_ENDPOINTS.AUTH.EMAIL_CODE_LOGIN}`;
