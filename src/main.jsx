import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// StrictMode is intentionally off: it double-invokes effects, which makes
// GSAP timelines and the WebGL scene initialise twice in development.
createRoot(document.getElementById('root')).render(<App />);
