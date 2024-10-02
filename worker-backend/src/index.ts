import { D1Database, D1Result } from '@cloudflare/workers-types';

interface Env {
  MY_DB: D1Database;
}

interface QuoteData {
	user: number;
	pickup: string;
	destination: string;
	price: number;
	completed: number;
	serviceLevel: string;
	shippingType: string;
	weight: number;
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
	if (pathname === '/api/submit-quote' && request.method === 'POST') {
	  try {
		const { results } = await env.MY_DB.prepare("PRAGMA table_info(orders)").all();
		console.log('Table schema:', JSON.stringify(results));
  
		const data = await request.json() as QuoteData;
		
		console.log('Received data:', JSON.stringify(data));			
  
		const result = await env.MY_DB.prepare(
		  `INSERT INTO orders (user, stripe_price_id, pickup, destination, price, completed, serviceLevel, shippingType, weight) 
		   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
		  data.user,
		  null, // stripe_price_id
		  data.pickup,
		  data.destination,
		  data.price,
		  data.completed,
		  data.serviceLevel,
		  data.shippingType,
		  data.weight
		)
		.run();
  
		console.log('Database operation result:', JSON.stringify(result));
  
		if (result && result.meta && result.meta.changes === 1) {
		  return new Response(JSON.stringify({ success: true, orderId: result.meta.last_row_id }), {
			headers: { 
			  'Content-Type': 'application/json',
			  'Access-Control-Allow-Origin': '*',
			},
		  });
		} else {
		  throw new Error("Failed to insert the order");
		}
	} catch (error) {
		console.error("Error submitting quote:", error);
		return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
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