import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initPlatform, isNative, setInitialLanguage } from './utils/Device';
import Boundary from './utils/Boundary';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

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

const boundaryFallback = (
  <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong.</div>
    <button
      type="button"
      onClick={() => window.location.reload()}
      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #999', background: '#fff' }}>
      Reload
    </button>
  </div>
);

const renderApp = async () => {
  await initPlatform();
  await setInitialLanguage();
  root.render(
    <React.StrictMode>
      <Boundary fallback={boundaryFallback}>
        <App />
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
