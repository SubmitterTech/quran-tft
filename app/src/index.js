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
  return false;
};

window.onunhandledrejection = (event) => {
  console.error('Unhandled promise rejection:', event.reason);
};

const root = ReactDOM.createRoot(document.getElementById('root'));

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

const loadBootTranslationBundle = async (language, preloadPlan) => {
  const normalizedLanguage = (language || '').toLowerCase();
  if (!normalizedLanguage || normalizedLanguage === 'en') {
    return null;
  }

  const shouldLoad = (flag) => Boolean(preloadPlan?.[flag]);
  const loadOptional = (flag, importer) => (
    shouldLoad(flag) ? importer().catch(() => null) : Promise.resolve(null)
  );

  const [
    translatedQuran,
    translatedCover,
    translatedIntro,
    translatedAppendix,
    translatedApplication,
  ] = await Promise.all([
    loadOptional('loadQuran', () => import(`./assets/translations/${normalizedLanguage}/quran_${normalizedLanguage}.json`)),
    loadOptional('loadCover', () => import(`./assets/translations/${normalizedLanguage}/cover_${normalizedLanguage}.json`)),
    loadOptional('loadIntro', () => import(`./assets/translations/${normalizedLanguage}/introduction_${normalizedLanguage}.json`)),
    loadOptional('loadAppendices', () => import(`./assets/translations/${normalizedLanguage}/appendices_${normalizedLanguage}.json`)),
    import(`./assets/translations/${normalizedLanguage}/application_${normalizedLanguage}.json`).catch(() => null),
  ]);

  return {
    language: normalizedLanguage,
    translation: translatedQuran?.default || null,
    coverData: translatedCover?.default || null,
    introduction: translatedIntro?.default || null,
    appendices: translatedAppendix?.default || null,
    map: null,
    application: translatedApplication?.default || null,
    preloadPlan: preloadPlan || null,
  };
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

const isSearchRoutePath = (path) => /(?:^|\/)search\/?$/.test(path || '/');

const isAppendixRoutePath = (path) => /(?:^|\/)appendix\/\d+\/?$/.test(path || '/');

const getSavedPage = () => {
  const parsed = parseInt(localStorage.getItem('qurantft-pn') || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getRootBootPreloadPlan = (runtimePath) => {
  const savedPage = getSavedPage();
  const hasSavedPage = savedPage !== null;
  const isSearch = isSearchRoutePath(runtimePath);
  const isAppendix = isAppendixRoutePath(runtimePath);
  const shouldShowCover = !hasSavedPage && !isSearch && !isAppendix && !process.env.REACT_APP_DEFAULT_LANG;

  let effectivePage = hasSavedPage ? savedPage : 1;
  if (isAppendix) {
    effectivePage = 397;
  }

  return {
    loadQuran: true,
    loadCover: shouldShowCover,
    loadIntro: effectivePage <= 22,
    loadAppendices: effectivePage >= 396,
  };
};

const getInitialRouteConfig = () => {
  const runtimePath = getRuntimePath();

  if (isRootRoutePath(runtimePath)) {
    return {
      loader: () => import(/* webpackChunkName: "route-root" */ './pages/Root'),
    };
  }

  return {
    loader: () => import(/* webpackChunkName: "route-leaf" */ './pages/Leaf'),
  };
};

const preloadInitialRouteChunk = async () => {
  const routeConfig = getInitialRouteConfig();
  await routeConfig.loader();
};

const renderApp = async () => {
  let loadingDirection = 'ltr';
  let bootData = null;
  let errorTitle = defaultApplication.errorTitle || 'Something went wrong';
  let errorMessage =
    defaultApplication.errorMessage || 'An unexpected error occurred. Refresh to continue.';
  let errorReloadLabel = defaultApplication.errorReload || 'Refresh';

  try {
    await initPlatform();
    const initializedLang = await setInitialLanguage();

    const languageCandidates = getLanguageCandidates(
      initializedLang || localStorage.getItem('lang') || process.env.REACT_APP_DEFAULT_LANG || 'en'
    );
    const resolvedLang = languageCandidates.find((lang) => languages[lang]) || 'en';
    loadingDirection = languages[resolvedLang]?.dir || 'ltr';

    const runtimePath = getRuntimePath();
    const preloadPlan = isRootRoutePath(runtimePath)
      ? getRootBootPreloadPlan(runtimePath)
      : { loadQuran: true, loadCover: false, loadIntro: false, loadAppendices: false };

    const [preloadedBootData] = await Promise.all([
      loadBootTranslationBundle(resolvedLang, preloadPlan),
      preloadInitialRouteChunk(),
    ]);

    bootData = preloadedBootData;

    if (bootData?.application) {
      errorTitle = bootData.application.errorTitle || errorTitle;
      errorMessage = bootData.application.errorMessage || errorMessage;
      errorReloadLabel = bootData.application.errorReload || errorReloadLabel;
    }
  } catch (error) {
    console.error('Bootstrap failed', error);
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
        }
      >
        <App loadingDirection={loadingDirection} bootData={bootData} />
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
