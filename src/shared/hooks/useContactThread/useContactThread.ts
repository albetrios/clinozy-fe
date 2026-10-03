import {
  contactThreadQueryKeys,
  ensureContactThread,
  type EnsureContactThreadInput,
  type EnsureContactThreadResult,
} from '@/shared/api/clinic/contact-threads-api.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';

/**
 * Bind a person to their chat thread before the first message — their lead,
 * their contact thread, or a new contact thread (D32). The chat column calls
 * it from the task drawer, the appointment form and the patient file; a
 * second call for the same person returns the same thread, and a double tap
 * shares one request (`useAppMutation` is single-flight per input).
 */
export function useEnsureContactThread() {
  return useAppMutation<EnsureContactThreadResult, EnsureContactThreadInput>({
    mutationFn: ensureContactThread,
    invalidateKeys: [
      contactThreadQueryKeys.all,
      ['clinic', 'leads'],
      // A patient's chat column reads the thread this may have just opened.
      ['clinic', 'messages'],
      taskQueryKeys.details(),
    ],
  });
}
