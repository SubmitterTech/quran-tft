const fs = require('fs');
const path = require('path');

const DUO_OUTER_ISLAND = { edge: 'right', height: 136, width: 54, x: 393, y: 20 };

// Recorded on the iPhone Duo simulator (iOS 27.1).
const DUO_OUTER = {
  height: 678,
  occlusions: [
    { edge: 'right', height: 37, width: 37, x: 399.6666666666667, y: 29.333333333333332 },
    { edge: 'right', height: 174, width: 84, x: 382, y: 0 },
  ],
  width: 466,
};
const DUO_INNER = {
  height: 669,
  occlusions: [{ edge: 'right', height: 124, width: 84, x: 867, y: 0 }],
  width: 951,
};
// The inner display turned to portrait: its region sits under the top inset, so there is no band.
const DUO_INNER_PORTRAIT = {
  height: 951,
  occlusions: [{ edge: 'top', height: 82, width: 144, x: 525, y: 0 }],
  width: 669,
};

// Every load is a fresh module instance; the resize listeners each one adds are removed after the
// test, so an earlier instance's snapshot cannot answer a later test's resize.
const resizeListeners = [];
const originalAddEventListener = window.addEventListener.bind(window);
window.addEventListener = (type, listener, options) => {
  if (type === 'resize') {
    resizeListeners.push(listener);
  }
  return originalAddEventListener(type, listener, options);
};

afterEach(() => {
  resizeListeners.splice(0).forEach((listener) => window.removeEventListener('resize', listener));
});

const loadWindowGeometry = ({ platform = 'ios', native = true, geometry = null } = {}) => {
  jest.resetModules();

  const listeners = [];
  const plugin = {
    addListener: jest.fn((event, listener) => {
      listeners.push(listener);
      return Promise.resolve({ remove: jest.fn() });
    }),
    getWindowGeometry: jest.fn().mockResolvedValue(geometry),
  };

  jest.doMock('@capacitor/core', () => ({
    Capacitor: {
      getPlatform: jest.fn(() => platform),
      isNativePlatform: jest.fn(() => native),
    },
    registerPlugin: jest.fn(() => plugin),
  }));

  let windowGeometry;
  jest.isolateModules(() => {
    windowGeometry = require('../utils/WindowGeometry');
  });

  return {
    ...windowGeometry,
    emit: (payload) => listeners.forEach((listener) => listener(payload)),
    plugin,
  };
};

const clearRootBand = () => {
  const root = document.documentElement;
  delete root.dataset.occlusionBand;
  root.style.removeProperty('--app-occlusion-band-inset');
  root.style.removeProperty('--app-occlusion-band-bottom');
};

describe('normalizeWindowGeometry', () => {
  const { normalizeWindowGeometry } = loadWindowGeometry();

  test('reads the window size and occlusion regions', () => {
    expect(normalizeWindowGeometry({
      height: 678,
      occlusions: [{ ...DUO_OUTER_ISLAND, margins: { right: 4 } }],
      width: 466,
    })).toEqual({
      height: 678,
      occlusions: [DUO_OUTER_ISLAND],
      occlusionsWidth: 466,
      width: 466,
    });
  });

  test('keeps the previous regions, and the width they were measured at, for a payload sent mid-resize', () => {
    const previous = normalizeWindowGeometry({ height: 678, occlusions: [DUO_OUTER_ISLAND], width: 466 });

    expect(normalizeWindowGeometry({ height: 466, width: 678 }, previous)).toEqual({
      height: 466,
      occlusions: previous.occlusions,
      occlusionsWidth: 466,
      width: 678,
    });
  });

  test('marks regions as unmeasured when the first payload has none', () => {
    expect(normalizeWindowGeometry({ height: 678, width: 466 }).occlusionsWidth).toBe(0);
  });

  test('ignores payloads without a size', () => {
    const previous = { height: 874, occlusions: [], width: 402 };

    expect(normalizeWindowGeometry({ height: 0, width: 402 }, previous)).toBe(previous);
    expect(normalizeWindowGeometry(null, null)).toBeNull();
  });

  test('drops empty regions and unknown edges', () => {
    expect(normalizeWindowGeometry({
      height: 678,
      occlusions: [{ height: 0, width: 10, x: 0, y: 0 }, { edge: 'middle', height: 5, width: 5, x: 1, y: 2 }],
      width: 466,
    }).occlusions).toEqual([{ edge: '', height: 5, width: 5, x: 1, y: 2 }]);
  });
});

describe('occlusionBandFor', () => {
  const { occlusionBandFor } = loadWindowGeometry();

  test('turns the Duo outer island into a top band on the right', () => {
    const geometry = { height: 678, occlusions: [DUO_OUTER_ISLAND], width: 466 };

    expect(occlusionBandFor(geometry, 466)).toEqual({ bottom: 156, edge: 'right', inset: 73 });
  });

  test('measures a left band from the left edge', () => {
    const geometry = { height: 678, occlusions: [{ ...DUO_OUTER_ISLAND, edge: 'left', x: 19 }], width: 466 };

    expect(occlusionBandFor(geometry, 466)).toEqual({ bottom: 156, edge: 'left', inset: 73 });
  });

  test('keeps the plain inset for regions that reach down the side', () => {
    const geometry = { height: 678, occlusions: [{ ...DUO_OUTER_ISLAND, height: 600 }], width: 466 };

    expect(occlusionBandFor(geometry, 466)).toBeNull();
  });

  test('ignores regions that do not account for a side inset', () => {
    const geometry = { height: 874, occlusions: [{ edge: 'top', height: 37, width: 125, x: 138, y: 11 }], width: 402 };

    expect(occlusionBandFor(geometry, 402)).toBeNull();
    expect(occlusionBandFor({ height: 874, occlusions: [], width: 402 }, 402)).toBeNull();
  });

  test('keeps the plain inset when islands sit on both sides', () => {
    const geometry = {
      height: 678,
      occlusions: [DUO_OUTER_ISLAND, { ...DUO_OUTER_ISLAND, edge: 'left', x: 19 }],
      width: 466,
    };

    expect(occlusionBandFor(geometry, 466)).toBeNull();
  });
});

describe('occlusionBandUpdateFor', () => {
  const { normalizeWindowGeometry, occlusionBandUpdateFor } = loadWindowGeometry();

  test('settles on the band once the page, the window and its regions agree', () => {
    expect(occlusionBandUpdateFor(normalizeWindowGeometry(DUO_OUTER), 466))
      .toEqual({ band: { bottom: 174, edge: 'right', inset: 84 }, settled: true });
    expect(occlusionBandUpdateFor(normalizeWindowGeometry(DUO_INNER), 951))
      .toEqual({ band: { bottom: 124, edge: 'right', inset: 84 }, settled: true });
  });

  test('settles on no band for a window without side regions', () => {
    const iphone = normalizeWindowGeometry({ height: 874, occlusions: [], width: 402 });

    expect(occlusionBandUpdateFor(iphone, 402)).toEqual({ band: null, settled: true });
  });

  test('waits while the page viewport has not caught up with the window', () => {
    expect(occlusionBandUpdateFor(normalizeWindowGeometry(DUO_OUTER), 951).settled).toBe(false);
    expect(occlusionBandUpdateFor(normalizeWindowGeometry(DUO_OUTER), 466.5).settled).toBe(true);
  });

  test('waits while the regions belong to the previous window size', () => {
    const resizing = normalizeWindowGeometry({ height: 678, width: 466 }, normalizeWindowGeometry(DUO_INNER));

    expect(occlusionBandUpdateFor(resizing, 466).settled).toBe(false);
  });

  test('settles on no band for the inner display turned to portrait', () => {
    expect(occlusionBandUpdateFor(normalizeWindowGeometry(DUO_INNER_PORTRAIT), 669))
      .toEqual({ band: null, settled: true });
  });

  test('waits until any geometry has arrived', () => {
    expect(occlusionBandUpdateFor(null, 466).settled).toBe(false);
  });
});

describe('startWindowGeometry', () => {
  const originalInnerWidth = window.innerWidth;
  const root = document.documentElement;
  const bandBottom = () => root.style.getPropertyValue('--app-occlusion-band-bottom') || 'none';
  const setViewportWidth = (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  };
  const resizePage = (width) => {
    setViewportWidth(width);
    window.dispatchEvent(new Event('resize'));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    clearRootBand();
    setViewportWidth(466);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    clearRootBand();
    setViewportWidth(originalInnerWidth);
  });

  // Runs the plugin's first answer and the promise callbacks behind it.
  const startWith = async (geometry, viewportWidth) => {
    setViewportWidth(viewportWidth);
    const windowGeometry = loadWindowGeometry({ geometry });
    windowGeometry.startWindowGeometry();
    await Promise.resolve();
    await Promise.resolve();
    return windowGeometry;
  };

  // Plays [delay before, payload or { resize: width }] steps and records the band after each one.
  const play = (emit, steps) => steps.map(([delay, step]) => {
    jest.advanceTimersByTime(delay);
    if (step.resize) {
      resizePage(step.resize);
    } else {
      emit(step);
    }
    return bandBottom();
  });

  test('puts the first band on the page at once', async () => {
    await startWith({ height: 678, occlusions: [DUO_OUTER_ISLAND], width: 466 }, 466);

    expect(root.dataset.occlusionBand).toBe('right');
    expect(root.style.getPropertyValue('--app-occlusion-band-inset')).toBe('73px');
    expect(root.style.getPropertyValue('--app-occlusion-band-bottom')).toBe('156px');
  });

  test('follows a later change once the geometry has stayed unchanged for 300 ms', async () => {
    const { emit, getWindowGeometrySnapshot, subscribeWindowGeometry } = await startWith(DUO_OUTER, 466);
    const listener = jest.fn();
    subscribeWindowGeometry(listener);

    resizePage(402);
    emit({ height: 874, occlusions: [], width: 402 });
    expect(getWindowGeometrySnapshot()).toEqual({ height: 874, occlusions: [], occlusionsWidth: 402, width: 402 });
    expect(listener).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(299);
    expect(root.dataset.occlusionBand).toBe('right');
    jest.advanceTimersByTime(1);
    expect(root.dataset.occlusionBand).toBeUndefined();
    expect(root.style.getPropertyValue('--app-occlusion-band-inset')).toBe('');
  });

  // The transitions below replay the reports recorded on the iPhone Duo simulator, with their
  // timing in milliseconds.
  test('keeps the band through opening iPhone Duo, then takes the inner display\'s', async () => {
    const { emit } = await startWith(DUO_OUTER, 466);

    const seen = play(emit, [
      [0, { height: 678, occlusions: [{ edge: 'top', height: 37, width: 37, x: 399.7, y: 29.3 }, { height: 174, width: 84, x: 382, y: 0 }], width: 466 }],
      [175, { resize: 951 }],
      [0, { height: 669, width: 951 }],
      [2, { height: 669, occlusions: [{ height: 37, width: 37, x: 884.7, y: 399.7 }, { height: 84, width: 174, x: 777, y: 382 }], width: 951 }],
      [37, { height: 669, occlusions: [{ height: 82, width: 144, x: 807, y: 0 }], width: 951 }],
      [65, DUO_INNER],
      [299, { resize: 951 }],
    ]);
    jest.advanceTimersByTime(300);

    expect(seen).toEqual(['174px', '174px', '174px', '174px', '174px', '174px', '174px']);
    expect(bandBottom()).toBe('124px');
  });

  test('drops the band for the inner display in portrait and brings it back in landscape', async () => {
    const { emit } = await startWith(DUO_INNER, 951);

    const toPortrait = play(emit, [
      [0, { height: 951, width: 669 }],
      [1, { height: 951, occlusions: [{ height: 124, width: 84, x: 585, y: 0 }], width: 669 }],
      [0, { resize: 669 }],
      [52, DUO_INNER_PORTRAIT],
    ]);
    jest.advanceTimersByTime(300);
    const inPortrait = bandBottom();

    const toLandscape = play(emit, [
      [1000, { height: 669, width: 951 }],
      [1, { height: 669, occlusions: [{ edge: 'top', height: 82, width: 144, x: 807, y: 0 }], width: 951 }],
      [0, { resize: 951 }],
      [7, { height: 669, occlusions: [{ height: 82, width: 144, x: 807, y: 0 }], width: 951 }],
      [38, DUO_INNER],
    ]);
    jest.advanceTimersByTime(300);

    expect(toPortrait).toEqual(['124px', '124px', '124px', '124px']);
    expect(inPortrait).toBe('none');
    expect(toLandscape).toEqual(['none', 'none', 'none', 'none', 'none']);
    expect(bandBottom()).toBe('124px');
  });

  test('keeps the band through closing iPhone Duo, then takes the outer display\'s', async () => {
    const { emit } = await startWith(DUO_INNER, 951);

    const seen = play(emit, [
      [0, { height: 678, width: 466 }],
      [1, { height: 678, occlusions: [{ height: 84, width: 124, x: 0, y: 0 }], width: 466 }],
      [0, { resize: 466 }],
      [0, { height: 678, occlusions: [], width: 466 }],
      [20, DUO_OUTER],
    ]);
    jest.advanceTimersByTime(300);

    expect(seen).toEqual(['124px', '124px', '124px', '124px', '124px']);
    expect(bandBottom()).toBe('174px');
    expect(root.dataset.occlusionBand).toBe('right');
  });

  test('waits for the geometry to settle when the app opens in the middle of a transition', async () => {
    // The first report is of the closed display while the page is already 951 wide, so it cannot
    // be used; a stray report and the inner display's region follow.
    const { emit } = await startWith(DUO_OUTER, 951);
    expect(bandBottom()).toBe('none');

    const seen = play(emit, [
      [0, { height: 669, width: 951 }],
      [2, { height: 669, occlusions: [{ edge: 'left', height: 100, width: 84, x: 0, y: 0 }], width: 951 }],
      [40, DUO_INNER],
      [299, { resize: 951 }],
    ]);
    jest.advanceTimersByTime(300);

    expect(seen).toEqual(['none', 'none', 'none', 'none']);
    expect(bandBottom()).toBe('124px');
  });

  test('waits for the page to catch up when the regions arrive before it resizes', async () => {
    const { emit } = await startWith(DUO_INNER, 951);

    emit(DUO_OUTER);
    jest.advanceTimersByTime(1000);
    expect(bandBottom()).toBe('124px');

    resizePage(466);
    jest.advanceTimersByTime(300);
    expect(bandBottom()).toBe('174px');
  });

  test('stays off outside the iOS app', async () => {
    const android = loadWindowGeometry({ platform: 'android' });
    android.startWindowGeometry();
    const web = loadWindowGeometry({ platform: 'web', native: false });
    web.startWindowGeometry();
    await Promise.resolve();

    expect(android.plugin.getWindowGeometry).not.toHaveBeenCalled();
    expect(web.plugin.addListener).not.toHaveBeenCalled();
    expect(root.dataset.occlusionBand).toBeUndefined();
  });
});

describe('WindowGeometry native plugin contract', () => {
  const iosRoot = path.join(__dirname, '../../ios/App');
  const read = (relativePath) => fs.readFileSync(path.join(iosRoot, relativePath), 'utf8');

  test('iOS exposes the plugin as WindowGeometry and reads occlusion regions on iOS 27.1+', () => {
    const plugin = read('App/Display/WindowGeometryPlugin.swift');

    expect(plugin).toContain('public let jsName = "WindowGeometry"');
    expect(plugin).toContain('CAPPluginMethod(name: "getWindowGeometry"');
    expect(plugin).toContain('notifyListeners("windowGeometryChange"');
    expect(plugin).toContain('#available(iOS 27.1, *)');
    expect(plugin).toContain('reservedRegions(kind: .occlusion)');
    expect(plugin).toContain('view.convert(region.frame, to: webView)');
  });

  test('the scene uses BridgeViewController, which registers the plugin and forwards size changes', () => {
    const sceneDelegate = read('App/SceneDelegate.swift');

    expect(sceneDelegate).toContain('window?.rootViewController = BridgeViewController()');
    expect(sceneDelegate).toContain('bridge?.registerPluginInstance(windowGeometryPlugin)');
    expect(sceneDelegate).toContain('windowGeometryPlugin.windowWillResize(to: size)');
    expect(sceneDelegate).toContain('windowGeometryPlugin.windowDidLayout()');
  });

  test('the Xcode project compiles the iOS plugin', () => {
    const project = read('App.xcodeproj/project.pbxproj');

    expect(project).toContain('WindowGeometryPlugin.swift in Sources */,');
    expect(project).toContain('path = Display;');
  });
});
