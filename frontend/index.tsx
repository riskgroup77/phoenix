import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initClientMonitoring } from './utils/monitoring';
import './styles/tailwind.css';
import './styles/phoenix-theme.css';

initClientMonitoring();

// Sertifikatlardagi QR kodlar https://ilmiyfaoliyat.uz/verify/<kod> ko'rinishida (hash'siz).
// Ilova HashRouter'da — shunday yo'llarni #/verify/<kod> ga yo'naltiramiz (eski chop etilganlar ham ishlaydi).
{
  const m = window.location.pathname.match(/^\/(?:verify|udk-verify)\/([^/]+)\/?$/);
  if (m && !window.location.hash) {
    window.location.replace(`/#/verify/${m[1]}`);
  }
}

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
