import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { setInitialLanguage } from './utils/Device';
import Boundary from './utils/Boundary';

window.onerror = (message, source, lineno, colno, error) => {
  console.warn('Global error caught:', { message, source, lineno, colno, error });
  return true;
};

window.onunhandledrejection = (event) => {
  console.warn('Unhandled promise rejection:', event.reason);
  event.preventDefault();
};

const root = ReactDOM.createRoot(document.getElementById('root'));

const renderApp = async () => {
  await setInitialLanguage();
  root.render(
    <React.StrictMode>
      <Boundary>
        <App />
      </Boundary>
    </React.StrictMode>
  );
};

renderApp();

reportWebVitals();
