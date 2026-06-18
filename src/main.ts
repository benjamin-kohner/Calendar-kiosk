import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { settings } from './lib/settings.svelte';

// Apply persisted theme/night settings to <html> before first paint.
settings.applyToDocument();

const app = mount(App, { target: document.getElementById('app')! });

export default app;
