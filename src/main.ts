if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.location.replace(window.location.href.replace('localhost', '127.0.0.1'));
}

import './style.css';
import { Buffer } from 'buffer';

if (typeof (globalThis as any).Buffer === 'undefined') {
    (globalThis as any).Buffer = Buffer;
}

// Import all Web Components to register them with the browser
import './components/w-login';
import './components/w-feed';
import './components/w-activity-card';
import './components/w-upload';
import './components/w-app';
