import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
// https://astro.build/config
export default defineConfig({
  site: "https://arknetcouriers.co.uk",
  integrations: [
    tailwind(),
    icon({
      iconDirectory: 'src/icons', // Ensure this path is correct based on your project structure
    })
  ],
  adapter: node({ mode: "standalone" }),
  output: "server",
  vite: {
    server: {
      proxy: {
        '/api': 'worker-backend.hamzaaslam2121.workers.dev', // Proxy API requests to the Cloudflare Worker
      },
    },
  },
});