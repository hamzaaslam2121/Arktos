import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import clerk from "@clerk/astro";

export default defineConfig({
  site: "https://arknetcouriers.co.uk", // Update this to your actual domain
  integrations: [
    clerk(),
    tailwind(),
    icon({
      iconDirectory: 'src/icons',
    })
  ],
  output: "server",
  adapter: cloudflare({ mode: "advanced" }),
});