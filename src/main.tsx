import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { App } from './App';
import { limitLaunch } from './app/launch';

// Service worker: precaches the app shell so the app also starts without reception.
registerSW({ immediate: true });
limitLaunch();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
