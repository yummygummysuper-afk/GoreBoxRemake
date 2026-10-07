import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs make the build work both at a custom domain root and at
  // https://<user>.github.io/<repository>/ on GitHub Pages.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true
  }
});
