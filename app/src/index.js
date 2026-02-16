import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initPlatform, isNative, setInitialLanguage } from './utils/Device';
import Boundary from './utils/Boundary';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import defaultApplication from './assets/application.json';
import languages from './assets/languages.json';

window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error caught:', { message, source, lineno, colno, error });
  // Don't swallow the error; let the browser/native WebView surface it (devtools/overlay).
  return false;
};

window.onunhandledrejection = (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Don't prevent default; this is critical for debugging and error reporting.
};

const root = ReactDOM.createRoot(document.getElementById('root'));

const BootProgress = ({ loadingLabel, loadingDirection, progress, logoSrc }) => {
  const normalizedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      dir={loadingDirection}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-sky-950 select-none"
    >
      <div className="w-[min(560px,95vw)]">
        <div className="mb-7 flex justify-center">
          <div className="relative h-[min(46vw,220px)] w-[min(46vw,220px)]">
            <div className="absolute inset-0 p-2">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt="Quran TFT"
                  className="h-full w-full object-contain transition-all duration-200 ease-in"
                  style={{ transform: `scale(${0.57 + normalizedProgress / 200})` }}
                  decoding="async"
                  loading="eager"
                  fetchpriority="high"
                />
              ) : null}
            </div>
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between text-neutral-100 mx-0.5">
          <div className="flex items-center text-lg md:text-xl">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {loadingLabel}
          </div>
          <div className="text-base tabular-nums">{`${normalizedProgress.toFixed(1)}%`}</div>
        </div>
        <div className="h-1 w-full overflow-hidden bg-white/35">
          <div
            className="h-full bg-amber-400 transition-all duration-300 ease-linear"
            style={{ width: `${normalizedProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const CrashGuard = ({ direction, title, message, reloadLabel }) => (
  <div
    dir={direction}
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-b from-cyan-500 to-sky-500 px-5 py-6 select-none"
  >
    <div className="w-[min(780px,92vw)] rounded-md border border-sky-100/40 bg-sky-950/70 p-7 md:p-10 shadow-2xl backdrop-blur-md">
      <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border border-sky-100/60 bg-sky-100/10 text-3xl font-black leading-none text-neutral-100">!</div>
      <div className="mb-3 text-2xl md:text-4xl font-bold tracking-tight text-neutral-100">
        {title}
      </div>
      <div className="mb-7 text-base md:text-xl leading-relaxed text-neutral-100/90">
        {message}
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md border border-neutral-100 bg-neutral-100 px-5 py-3 text-sm md:text-base font-semibold text-sky-950 transition-colors duration-200 hover:bg-transparent hover:text-neutral-100"
      >
        {reloadLabel}
      </button>
    </div>
  </div>
);

const getLanguageCandidates = (lang) => {
  const normalized = (lang || '').toString().trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  const base = normalized.split('-')[0];
  return Array.from(new Set([normalized, base].filter(Boolean)));
};

const loadBootTranslation = async (langCandidates) => {
  for (const lang of langCandidates) {
    if (lang === 'en') {
      return defaultApplication;
    }

    try {
      const translatedApplication = await import(`./assets/translations/${lang}/application_${lang}.json`);
      if (translatedApplication?.default) {
        return translatedApplication.default;
      }
    } catch (_error) {
      // Try next fallback candidate.
    }
  }

  return defaultApplication;
};

const getRuntimePath = () => {
  const basePath = process.env.PUBLIC_URL || '';
  const currentPathname = window.location.pathname || '/';

  if (basePath && basePath !== '/' && currentPathname.startsWith(basePath)) {
    const stripped = currentPathname.slice(basePath.length);
    if (!stripped) {
      return '/';
    }
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }

  return currentPathname || '/';
};

const isRootRoutePath = (path) => {
  const segments = (path || '/').split('/').filter(Boolean);

  if (segments.length === 0) {
    return true;
  }

  if (segments.length === 1 && segments[0] === 'search') {
    return true;
  }

  if (segments.length === 2 && segments[0] === 'appendix') {
    return true;
  }

  if (segments.length === 2 && segments[1] === 'search') {
    return true;
  }

  if (segments.length === 3 && segments[1] === 'appendix') {
    return true;
  }

  return false;
};

const ROOT_ROUTE_CHUNK_HINT = 'route-root';
const LEAF_ROUTE_CHUNK_HINT = 'route-leaf';
const BOOT_LOGO_URL = `${process.env.PUBLIC_URL || ''}/logo512.png`;

const getInitialRouteConfig = () => {
  const runtimePath = getRuntimePath();

  if (isRootRoutePath(runtimePath)) {
    return {
      chunkHint: ROOT_ROUTE_CHUNK_HINT,
      loader: () => import(/* webpackChunkName: "route-root" */ './pages/Root'),
      devChunkUrl: '/static/js/src_pages_Root_js.chunk.js',
    };
  }

  return {
    chunkHint: LEAF_ROUTE_CHUNK_HINT,
    loader: () => import(/* webpackChunkName: "route-leaf" */ './pages/Leaf'),
    devChunkUrl: '/static/js/src_pages_Leaf_js.chunk.js',
  };
};

const resolveRouteChunkUrl = async (chunkHint, devChunkUrl) => {
  try {
    const basePath = process.env.PUBLIC_URL || '';
    const manifestResponse = await fetch(`${basePath}/asset-manifest.json`, {
      cache: 'no-cache',
    });

    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json();
      const allFiles = Object.values(manifest?.files || {});
      const matchedChunkPath = allFiles.find((filePath) => (
        typeof filePath === 'string' &&
        filePath.includes(`/static/js/${chunkHint}`) &&
        filePath.endsWith('.chunk.js')
      ));

      if (matchedChunkPath) {
        return new URL(matchedChunkPath, window.location.origin).href;
      }
    }
  } catch (_error) {
    // Fallback to development chunk path.
  }

  if (process.env.NODE_ENV !== 'production' && devChunkUrl) {
    return new URL(devChunkUrl, window.location.origin).href;
  }

  return null;
};

const fetchWithByteProgress = async (url, onProgress) => {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to fetch boot chunk: ${response.status}`);
  }

  if (!response.body) {
    await response.arrayBuffer();
    onProgress(1);
    return;
  }

  const totalBytes = Number(response.headers.get('content-length'));
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    const readerWithoutTotal = response.body.getReader();
    while (true) {
      const { done } = await readerWithoutTotal.read();
      if (done) {
        break;
      }
    }
    onProgress(1);
    return;
  }

  const reader = response.body.getReader();
  let loadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    loadedBytes += value.byteLength;
    onProgress(Math.min(1, loadedBytes / totalBytes));
  }
};

const preloadInitialRouteChunk = async (onProgress) => {
  const routeConfig = getInitialRouteConfig();
  const chunkUrl = await resolveRouteChunkUrl(routeConfig.chunkHint, routeConfig.devChunkUrl);

  if (chunkUrl) {
    try {
      await fetchWithByteProgress(chunkUrl, onProgress);
    } catch (error) {
      console.warn('Boot chunk fetch failed, continuing with module import', error);
    }
  }

  await routeConfig.loader();
  onProgress(1);
};

const renderBootstrapProgress = (loadingLabel, loadingDirection, progress, logoSrc) => {
  root.render(
    <React.StrictMode>
      <BootProgress
        loadingLabel={loadingLabel}
        loadingDirection={loadingDirection}
        progress={progress}
        logoSrc={logoSrc}
      />
    </React.StrictMode>
  );
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const createBootProgressController = (getContext) => {
  let progress = 0;
  let lastRenderedProgress = -1;

  const paint = () => {
    const clamped = Math.max(0, Math.min(100, progress));
    if (Math.abs(clamped - lastRenderedProgress) < 0.08) {
      return;
    }

    lastRenderedProgress = clamped;
    const context = getContext();
    renderBootstrapProgress(
      context.loadingLabel,
      context.loadingDirection,
      clamped,
      context.logoSrc
    );
  };

  const setProgress = (nextProgress) => {
    progress = Math.max(progress, nextProgress);
    paint();
  };

  const getProgress = () => progress;

  const animateTo = async (target, durationMs = 280) => {
    const safeTarget = Math.max(getProgress(), target);
    const start = getProgress();
    const delta = safeTarget - start;

    if (delta <= 0.01) {
      setProgress(safeTarget);
      return;
    }

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setProgress(safeTarget);
      return;
    }

    await new Promise((resolve) => {
      const startedAt = performance.now();

      const step = (now) => {
        const ratio = Math.min(1, (now - startedAt) / durationMs);
        const eased = easeOutCubic(ratio);
        setProgress(start + delta * eased);

        if (ratio < 1) {
          window.requestAnimationFrame(step);
          return;
        }
        resolve();
      };

      window.requestAnimationFrame(step);
    });
  };

  const runStage = async (
    target,
    task,
    { creepDurationMs = 2200, holdBack = 1.25, completeDurationMs = 180 } = {}
  ) => {
    const stageStart = getProgress();
    const softTarget = Math.max(stageStart, target - holdBack);
    const taskPromise = Promise.resolve().then(task);
    let taskDone = false;

    taskPromise.finally(() => {
      taskDone = true;
    });

    const startedAt = performance.now();
    while (!taskDone) {
      const elapsed = performance.now() - startedAt;
      const ratio = Math.min(1, elapsed / creepDurationMs);
      const eased = easeOutCubic(ratio);
      const candidate = stageStart + (softTarget - stageStart) * eased;
      if (candidate > getProgress()) {
        setProgress(candidate);
      }
      await wait(32);
    }

    const result = await taskPromise;
    await animateTo(target, completeDurationMs);
    return result;
  };

  const runByteStage = async (
    target,
    taskWithProgress,
    { creepDurationMs = 2200, holdBack = 1.25, completeDurationMs = 180 } = {}
  ) => {
    const stageStart = getProgress();
    const softTarget = Math.max(stageStart, target - holdBack);
    let hasByteSignal = false;

    const reportFraction = (fraction) => {
      hasByteSignal = true;
      const boundedFraction = Math.max(0, Math.min(1, fraction));
      const candidate = stageStart + (softTarget - stageStart) * boundedFraction;
      if (candidate > getProgress()) {
        setProgress(candidate);
      }
    };

    const taskPromise = Promise.resolve().then(() => taskWithProgress(reportFraction));
    let taskDone = false;
    taskPromise.finally(() => {
      taskDone = true;
    });

    const startedAt = performance.now();
    while (!taskDone) {
      if (!hasByteSignal) {
        const elapsed = performance.now() - startedAt;
        const ratio = Math.min(1, elapsed / creepDurationMs);
        const eased = easeOutCubic(ratio);
        const candidate = stageStart + (softTarget - stageStart) * eased;
        if (candidate > getProgress()) {
          setProgress(candidate);
        }
      }
      await wait(32);
    }

    const result = await taskPromise;
    await animateTo(target, completeDurationMs);
    return result;
  };

  return { setProgress, getProgress, animateTo, runStage, runByteStage, paint };
};

const renderApp = async () => {
  let loadingLabel = defaultApplication.loading;
  let loadingDirection = 'ltr';
  let errorTitle = defaultApplication.errorTitle || 'Something went wrong';
  let errorMessage =
    defaultApplication.errorMessage || 'An unexpected error occurred. Refresh to continue.';
  let errorReloadLabel = defaultApplication.errorReload || 'Refresh';
  const bootContext = {
    loadingLabel,
    loadingDirection,
    logoSrc: BOOT_LOGO_URL,
  };
  const progressController = createBootProgressController(() => bootContext);

  try {
    progressController.setProgress(2.5);

    await progressController.runStage(22, () => initPlatform(), {
      creepDurationMs: 1000,
      holdBack: 1.8,
      completeDurationMs: 160,
    });

    const initializedLang = await progressController.runStage(46, () => setInitialLanguage(), {
      creepDurationMs: 1500,
      holdBack: 1.6,
      completeDurationMs: 180,
    });

    const languageCandidates = getLanguageCandidates(
      initializedLang || localStorage.getItem('lang') || process.env.REACT_APP_DEFAULT_LANG || 'en'
    );
    const resolvedLang = languageCandidates.find((lang) => languages[lang]) || 'en';
    loadingDirection = languages[resolvedLang]?.dir || 'ltr';
    bootContext.loadingDirection = loadingDirection;
    progressController.paint();

    const bootTranslation = await progressController.runStage(70, () => loadBootTranslation(languageCandidates), {
      creepDurationMs: 1500,
      holdBack: 1.5,
      completeDurationMs: 190,
    });
    loadingLabel = bootTranslation?.loading || defaultApplication.loading;
    errorTitle = bootTranslation?.errorTitle || defaultApplication.errorTitle || errorTitle;
    errorMessage = bootTranslation?.errorMessage || defaultApplication.errorMessage || errorMessage;
    errorReloadLabel = bootTranslation?.errorReload || defaultApplication.errorReload || errorReloadLabel;
    bootContext.loadingLabel = loadingLabel;
    progressController.paint();

    await progressController.runByteStage(93, (reportFraction) => preloadInitialRouteChunk(reportFraction), {
      creepDurationMs: 1700,
      holdBack: 1.2,
      completeDurationMs: 180,
    });

    await progressController.animateTo(98.5, 120);
  } catch (error) {
    console.error('Bootstrap progress failed', error);
  }

  root.render(
    <React.StrictMode>
      <Boundary
        fallback={
          <CrashGuard
            direction={loadingDirection}
            title={errorTitle}
            message={errorMessage}
            reloadLabel={errorReloadLabel}
          />
        }>
        <App loadingLabel={loadingLabel} loadingDirection={loadingDirection} />
      </Boundary>
    </React.StrictMode>
  );

  if (isNative()) {
    serviceWorkerRegistration.unregister();
    return;
  }

  serviceWorkerRegistration.register();
};

renderApp();

reportWebVitals();
