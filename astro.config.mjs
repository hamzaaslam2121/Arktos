import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: "https://arknetcouriers.co.uk/",
  integrations: [
    tailwind(),
    icon({
      iconDirectory: 'src/icons',
    })
  ],
  adapter: cloudflare(),
  output: "server", // Still using server output for Cloudflare
  vite: {
    ssr: {
      noExternal: [] // Remove Clerk's server-side usage
    }
  }
});
