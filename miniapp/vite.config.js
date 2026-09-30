import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function devCatalog() {
  let weather = null;
  let kudago = null;
  return {
    name: 'dev-catalog',
    configureServer(server) {
      server.middlewares.use('/api/catalog', async (_req, res) => {
        const eventsModule = new URL('../src/data/events.js', import.meta.url).href;
        const weatherModule = new URL('../src/weather.js', import.meta.url).href;
        const { getCatalog, setExternalEvents } = await import(eventsModule);
        weather ??= (await import(weatherModule)).weather;
        if (!kudago) {
          const kudagoModule = new URL('../src/sources/kudago.js', import.meta.url).href;
          const { createKudago } = await import(kudagoModule);
          kudago = createKudago({
            file: new URL('../state/kudago.json', import.meta.url).pathname,
            onUpdate: (items) => setExternalEvents(items, { updatedAt: kudago.updatedAt() }),
          });
          setExternalEvents(kudago.snapshot(), { updatedAt: kudago.updatedAt() });
          if (kudago.snapshot().length === 0) await kudago.refresh();
          else kudago.refresh();
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ...getCatalog(), weather: await weather.snapshot() }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devCatalog()],
  base: './',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    fs: { allow: ['..'] },
  },
});
