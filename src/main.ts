import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { themeController } from './lib/theme.svelte';

// Apply the day/night theme to <html> before first paint.
themeController.apply();

const app = mount(App, { target: document.getElementById('app')! });

export default app;
