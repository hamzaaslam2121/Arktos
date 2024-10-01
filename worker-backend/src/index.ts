import { D1Database } from '@cloudflare/workers-types';

interface Env {
  MY_DB: D1Database;
}


export default {
	async fetch(request: Request, env: Env): Promise<Response> {
	  const url = new URL(request.url);
  
	  if (url.pathname.startsWith('/api')) {
		// Handle API routes
		return handleApiRequest(url.pathname, request, env);
	  }
  
	  // Handle other requests (e.g., serving the static Astro site)
	  return fetch(request);
	}
  };
  
  async function handleApiRequest(pathname: string, request: Request, env: Env): Promise<Response> {
	// Orders API route
	if (pathname === '/api/orders') {
	  try {
		const { results } = await env.MY_DB.prepare("SELECT * FROM orders").all();
		return new Response(JSON.stringify(results), {
		  headers: { 
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*', // Allow all origins in development
		  },
		});
	  } catch (error) {
		console.error("Error fetching orders:", error);
		return new Response(JSON.stringify({ error: "Error fetching orders" }), {
		  status: 500,
		  headers: { 
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		  },
		});
	  }
	}
  
	// Your existing /api/hello route
	if (pathname === '/api/hello') {
	  const responseData = JSON.stringify({ message: 'Hello from Cloudflare Worker!' });
	  return new Response(responseData, {
		headers: { 
		  'Content-Type': 'application/json',
		  'Access-Control-Allow-Origin': '*',
		},
	  });
	}
  
	// Default return for unmatched routes
	return new Response('Not Found', { status: 404 });
  }