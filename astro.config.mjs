import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import clerk from "@clerk/astro";
// https://astro.build/config
export default defineConfig({
  site: "https://astro-moon-landing.netlify.app/",
  integrations: [
    clerk(),
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
        '/api': 'http://localhost:8787', // Proxy API requests to the Cloudflare Worker
      },
    },
  },
});