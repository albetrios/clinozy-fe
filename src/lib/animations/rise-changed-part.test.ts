import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { riseChangedPart } from './rise-changed-part.ts';

type Animate = HTMLElement['animate'];

function stubMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** A room: its toolbar, the list under it; or a patient file: bar, rail and section. */
function room(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

describe('riseChangedPart', () => {
  let finish: () => void;
  const animate = vi.fn<Animate>();

  beforeEach(() => {
    stubMotion(false);
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    animate.mockReset();
    animate.mockImplementation(() => ({ finished }) as unknown as Animation);
    HTMLElement.prototype.animate = animate;
    HTMLElement.prototype.getAnimations = () => [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it("rises what sits under a room's toolbar — not the toolbar — with the page rise", async () => {
    const root = room(
      '<section><header data-slot="room-toolbar"></header><div id="list"></div><div id="more"></div></section>',
    );
    riseChangedPart(root);
    const risen = animate.mock.contexts.map((element) => (element as HTMLElement).id);
    expect(risen).toEqual(['list', 'more']);
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'translateY(6px)' }, { transform: 'translateY(0)' }],
      { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
    expect(root).toHaveAttribute('data-replaying');
    finish();
    await vi.waitFor(() => expect(root).not.toHaveAttribute('data-replaying'));
  });

  it("rises only the patient file's section, even when the section has a toolbar of its own", () => {
    const root = room(
      '<nav id="bar"></nav><aside id="rail"></aside><div id="section" data-slot="patient-file-section"><header data-slot="room-toolbar"></header><div id="photos"></div></div>',
    );
    riseChangedPart(root);
    const risen = animate.mock.contexts.map((element) => (element as HTMLElement).id);
    expect(risen).toEqual(['section']);
  });

  it('keeps everything still under reduced motion, or with nothing to rise', () => {
    riseChangedPart(room('<div id="page"></div>'));
    expect(animate).not.toHaveBeenCalled();
    stubMotion(true);
    const root = room('<header data-slot="room-toolbar"></header><div></div>');
    riseChangedPart(root);
    expect(animate).not.toHaveBeenCalled();
    expect(root).not.toHaveAttribute('data-replaying');
  });
});
