import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { setInitialLanguage } from './utils/Device';

const root = ReactDOM.createRoot(document.getElementById('root'));

const renderApp = async () => {
  await setInitialLanguage();
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

renderApp();

reportWebVitals();
