import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initClientMonitoring } from './utils/monitoring';
import './styles/phoenix-theme.css';

initClientMonitoring();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
