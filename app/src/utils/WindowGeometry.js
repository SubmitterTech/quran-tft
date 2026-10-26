// The native window size and the system regions drawn over it, from the app's WindowGeometry
// plugin (ios/App/App/Display/WindowGeometryPlugin.swift).
//
// The web view cannot stand in for either. Its viewport shrinks while the soft keyboard is up,
// and the device orientation does not follow iPhone Duo's inner display. Nor can the page see
// where the system draws over it: env(safe-area-inset-*) only says how far in from each edge.
// On iPhone Duo's outer display the camera and status bar island sits in the top right corner,
// yet the right inset runs the full height of the screen, so a page that pads by it leaves an
// empty strip beside everything below the island.
//
// From the occlusion regions (iOS 27.1) this works out that top band. When a side region sits in
// the upper part of the window, the root element gets data-occlusion-band (the side) and
// --app-occlusion-band-inset / --app-occlusion-band-bottom, and only what sits beside the band
// has to step aside. Everywhere else, including Android and older iOS, the attribute is absent
// and pages keep the plain safe-area insets.

import { Capacitor, registerPlugin } from '@capacitor/core';

const WindowGeometry = registerPlugin('WindowGeometry');

const OCCLUSION_EDGES = new Set(['left', 'right']);
// A side region counts as a top band only while it ends in the upper part of the window, like the
// island on iPhone Duo's outer display. Anything taller keeps the plain safe-area inset.
const OCCLUSION_BAND_MAX_BOTTOM_RATIO = 0.4;
// How long the geometry has to stay unchanged before the band follows it. While iPhone Duo opens,
// closes or turns, the layout passes report regions that belong to neither display (on their
// side, against the wrong edge, or none at all); only the last report of a transition is right.
// Measured on the simulator, opening sends its first such region 175 ms before the new size, and
// every other transition settles within 65 ms.
const BAND_SETTLE_MS = 300;

const subscribers = new Set();

let started = false;
let snapshot = null;
let firstReportTried = false;
let bandTimer = null;

const finitePositive = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const finiteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeOcclusion = (region) => {
  const width = finitePositive(region?.width);
  const height = finitePositive(region?.height);
  if (!width || !height) {
    return null;
  }

  const edge = String(region?.edge ?? '');
  return {
    edge: ['left', 'right', 'top', 'bottom'].includes(edge) ? edge : '',
    height,
    width,
    x: finiteNumber(region?.x),
    y: finiteNumber(region?.y),
  };
};

// A payload sent while the window is still resizing carries no occlusions. The previous regions
// are kept, together with the window width they were measured at, until the layout pass after
// the transition reports the new ones.
export const normalizeWindowGeometry = (raw, previous = null) => {
  const width = finitePositive(raw?.width);
  const height = finitePositive(raw?.height);
  if (!width || !height) {
    return previous;
  }

  const measured = Array.isArray(raw?.occlusions);
  const occlusions = measured
    ? raw.occlusions.map(normalizeOcclusion).filter(Boolean)
    : previous?.occlusions ?? [];

  return {
    height,
    occlusions,
    occlusionsWidth: measured ? width : previous?.occlusionsWidth ?? 0,
    width,
  };
};

// The top band to keep clear on one side of the page, from the regions that account for that
// side's safe-area inset. inset is measured from the page edge and bottom from the page top, both
// in CSS pixels.
export const occlusionBandFor = (geometry, viewportWidth) => {
  if (!geometry?.occlusions?.length || !viewportWidth) {
    return null;
  }

  const maxBottom = geometry.height * OCCLUSION_BAND_MAX_BOTTOM_RATIO;
  let band = null;

  for (const region of geometry.occlusions) {
    if (!OCCLUSION_EDGES.has(region.edge)) {
      continue;
    }

    const bottom = region.y + region.height;
    if (bottom > maxBottom) {
      return null;
    }

    const inset = region.edge === 'right'
      ? viewportWidth - region.x
      : region.x + region.width;

    if (band && band.edge !== region.edge) {
      return null;
    }

    band = {
      bottom: Math.max(band?.bottom ?? 0, Math.ceil(bottom)),
      edge: region.edge,
      inset: Math.max(band?.inset ?? 0, Math.ceil(inset)),
    };
  }

  return band;
};

// How far the page viewport may be from the native window width and still count as caught up.
const VIEWPORT_WIDTH_TOLERANCE = 1;

// Whether the band can be worked out from this geometry yet, and if so what it is. Around a
// rotation, or iPhone Duo opening and closing, the native window, its regions and the page
// viewport change at different moments: the new size arrives before its regions, and the page
// resizes somewhere in between. Until all three describe the same window, the band already on
// the page stays.
export const occlusionBandUpdateFor = (geometry, viewportWidth) => {
  const waiting = { band: null, settled: false };
  if (!geometry || Math.abs(viewportWidth - geometry.width) > VIEWPORT_WIDTH_TOLERANCE) {
    return waiting;
  }

  if (geometry.occlusionsWidth !== geometry.width) {
    return waiting;
  }

  return { band: occlusionBandFor(geometry, viewportWidth), settled: true };
};

const sameGeometry = (left, right) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.width === right.width
    && left.height === right.height
    && left.occlusionsWidth === right.occlusionsWidth
    && JSON.stringify(left.occlusions) === JSON.stringify(right.occlusions);
};

const applyOcclusionBand = (geometry) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const { band, settled } = occlusionBandUpdateFor(geometry, window.innerWidth);
  if (!settled) {
    return;
  }

  const root = document.documentElement;  if (!band) {
    delete root.dataset.occlusionBand;
    root.style.removeProperty('--app-occlusion-band-inset');
    root.style.removeProperty('--app-occlusion-band-bottom');
    return;
  }

  root.dataset.occlusionBand = band.edge;
  root.style.setProperty('--app-occlusion-band-inset', `${band.inset}px`);
  root.style.setProperty('--app-occlusion-band-bottom', `${band.bottom}px`);
};

// The first report goes on the page at once, so the first screen already has its band. Everything
// after it, including what follows a first report that could not be used yet (the app opened in
// the middle of a transition), waits until the geometry has stayed unchanged for BAND_SETTLE_MS.
const scheduleOcclusionBand = () => {
  if (!snapshot) {
    return;
  }

  if (!firstReportTried) {
    firstReportTried = true;
    applyOcclusionBand(snapshot);
    return;
  }

  clearTimeout(bandTimer);
  bandTimer = setTimeout(() => {
    bandTimer = null;
    applyOcclusionBand(snapshot);
  }, BAND_SETTLE_MS);
};

const applyGeometry = (raw) => {
  const next = normalizeWindowGeometry(raw, snapshot);
  if (sameGeometry(snapshot, next)) {
    return;
  }

  snapshot = next;
  scheduleOcclusionBand();
  for (const subscriber of subscribers) {
    subscriber();
  }
};

// Only the iOS app has the plugin; elsewhere the snapshot stays null and no band is set.
export const startWindowGeometry = () => {
  if (started) {
    return;
  }

  started = true;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return;
  }

  WindowGeometry.addListener('windowGeometryChange', applyGeometry).catch(() => {});
  WindowGeometry.getWindowGeometry().then(applyGeometry).catch(() => {});
  // The page viewport can catch up with the native window after the last geometry change.
  window.addEventListener('resize', scheduleOcclusionBand);
};

export const getWindowGeometrySnapshot = () => snapshot;

export const subscribeWindowGeometry = (listener) => {
  subscribers.add(listener);
  startWindowGeometry();

  return () => {
    subscribers.delete(listener);
  };
};
