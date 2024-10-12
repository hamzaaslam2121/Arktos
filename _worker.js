import { createRoutesMiddleware } from '@clerk/fastify';
import { clerkClient } from '@clerk/fastify/server';
import { createClerkClient } from '@clerk/backend';

export default {
  async fetch(request, env, ctx) {
    const clerk = createClerkClient({
      secretKey: env.CLERK_SECRET_KEY,
    });

    const clerkMiddleware = createRoutesMiddleware({
      clerkInstance: clerk,
    });

    const response = await clerkMiddleware(request);
    if (response) {
      return response;
    }

    // If Clerk doesn't handle the request, pass it to your Astro app
    return env.ASSETS.fetch(request);
  },
};