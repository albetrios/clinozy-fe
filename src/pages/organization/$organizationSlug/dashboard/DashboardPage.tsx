import { Dashboard } from '@/shared/components/Dashboard/index.ts';

/**
 * Team-org dashboard route island. Renders the shared {@link Dashboard} surface
 * (promoted to shared in FE-20 so the personal `/dashboard` space reuses the
 * same component).
 */
export function DashboardPage() {
  return <Dashboard />;
}
