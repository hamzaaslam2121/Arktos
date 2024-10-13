import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import clerk from "@clerk/astro";

// https://astro.build/config
export default defineConfig({
  site: "https://arknetcouriers.co.uk/",
  integrations: [
    clerk(),
    tailwind(),
    icon({
      iconDirectory: 'src/icons',
    })
  ],
  vite: {
    define: {
      'import.meta.env.PUBLIC_WORKER_URL': JSON.stringify(process.env.PUBLIC_WORKER_URL || 'https://worker-backend.hamzaaslam2121.workers.dev'),
    },
    server: {
      proxy: {
        '/api': {
          target: 'https://worker-backend.hamzaaslam2121.workers.dev',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  },
});