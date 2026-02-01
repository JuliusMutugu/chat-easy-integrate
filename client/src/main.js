import { mount } from "svelte";
import App from "./App.svelte";
import { setThemePreference, getThemePreference, applySystemTheme } from "./lib/theme.js";

// Apply saved appearance (light / dark / system) on load
setThemePreference(getThemePreference());

// When preference is "system", update theme when OS theme changes
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySystemTheme);
}

const app = mount(App, {
  target: document.getElementById("app"),
});

export default app;
