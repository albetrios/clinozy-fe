import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { ActivityTimeline } from './components/ActivityTimeline/index.ts';
import { OverviewBento } from './components/OverviewBento/index.ts';
import { manifest } from './timeline.manifest.ts';

/**
 * Patient file › Overview (KICKOFF §6.6, D19; H:769–779, H:4980–4999): the
 * default section, without a header (H:4943) — on the canvas, padding 16px
 * 20px 96px, the bento of the patient's records (one, two or three columns by
 * the content column's width: the scrolling column is the container, its
 * padding inside) and, after it, the activity timeline. The visit flow takes
 * its place on `?visit=open` with the Visit model (L-49, D18).
 */
export function PatientTimelinePage() {
  return (
    <PatientSection
      section="timeline"
      data-testid={manifest.testId}
      hideHeader
      className="bg-canvas @container"
    >
      <div className="px-(--table-pad-x) pt-4 pb-24">
        <OverviewBento />
        <ActivityTimeline />
      </div>
    </PatientSection>
  );
}
