import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import WebApp from '@twa-dev/sdk';

// Initialize Telegram WebApp
WebApp.ready();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 