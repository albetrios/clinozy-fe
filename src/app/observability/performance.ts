import type { Metric } from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

import { platformConfig } from '@/core/config/env.ts';
import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';

/**
 * Report Web Vitals metrics to analytics/observability.
 *
 * Uses INP (Interaction to Next Paint) — the replacement for FID
 * as of March 2024 Core Web Vitals update.
 *
 * Sends metrics to:
 * - Console (dev only)
 * - PostHog (`web_vital` custom event)
 * - Sentry (warning on poor ratings)
 */
export function initPerformanceMonitoring(): void {
  const reportMetric = (metric: Metric) => {
    if (platformConfig.debugLogging) {
      console.info(
        `[Web Vitals] ${metric.name}:`,
        metric.value.toFixed(2),
        metric.rating,
      );
    }

    captureAnalyticsEvent(ANALYTICS_EVENTS.webVital, {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
    });

    if (metric.rating === 'poor') {
      import('@sentry/react')
        .then((Sentry) => {
          Sentry.captureMessage(`Poor Web Vital: ${metric.name} = ${metric.value}`, {
            level: 'warning',
            tags: { webVital: metric.name, rating: metric.rating },
          });
        })
        .catch(() => {
          /* noop */
        });
    }
  };

  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
  onFCP(reportMetric);
  onTTFB(reportMetric);
}
