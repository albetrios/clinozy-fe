import { describe, expect, it } from 'vitest';

import {
  autoFitActionsGrid,
  autoFitCardsGrid,
  dashboardFooterGrid,
  dashboardKpiGrid,
  gridCellMinWidth,
  splitMainAsideGrid,
} from './responsive-grid.ts';

describe('responsive-grid', () => {
  it('autoFitActionsGrid uses auto-fit with a 12rem floor', () => {
    expect(autoFitActionsGrid).toContain('auto-fit');
    expect(autoFitActionsGrid).toContain('12rem');
  });

  it('autoFitCardsGrid uses auto-fit with a 16rem floor', () => {
    expect(autoFitCardsGrid).toContain('auto-fit');
    expect(autoFitCardsGrid).toContain('16rem');
  });

  it('splitMainAsideGrid stacks on small viewports and 2fr/1fr on lg+', () => {
    expect(splitMainAsideGrid).toContain('grid-cols-1');
    expect(splitMainAsideGrid).toContain('2fr');
    expect(splitMainAsideGrid).toContain('1fr');
  });

  it('gridCellMinWidth prevents overflow in grid tracks', () => {
    expect(gridCellMinWidth).toBe('min-w-0');
  });

  it('dashboardKpiGrid reflows KPI tiles with an 11rem floor', () => {
    expect(dashboardKpiGrid).toContain('auto-fit');
    expect(dashboardKpiGrid).toContain('11rem');
  });

  it('dashboardFooterGrid stacks then splits on xl', () => {
    expect(dashboardFooterGrid).toContain('grid-cols-1');
    expect(dashboardFooterGrid).toContain('xl:grid-cols');
  });
});
