import { D1Database } from '@cloudflare/workers-types';
import Stripe from 'stripe';
interface Env {
  MY_DB: D1Database;
  GOOGLE_MAPS_API_KEY: string; 
  STRIPE_SECRET_KEY: string;
}

interface QuoteData {
  user: string;
  pickup: string;
  destination: string;
  price: number;
  completed: number;
  serviceLevel: string;
  shippingType: string;
  weight: number;
  datetime: string; 
}

interface PostcodesIOResponse {
	status: number;
	result: string[] | null;
}

interface DistanceMatrixResponse {
	status: string;
	rows: {
	  elements: {
		status: string;
		distance?: {
		  value: number;
		  text: string;
		};
		duration?: {
		  value: number;
		  text: string;
		};
	  }[];
	}[];
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
  if (pathname === '/api/orders') {
    try {
      const { results } = await env.MY_DB.prepare("SELECT * FROM orders").all();
      return new Response(JSON.stringify(results), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      return new Response(JSON.stringify({ error: 'Failed to fetch orders' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  if (pathname === '/api/postcode-suggestions') {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query || query.length < 2) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(query)}/autocomplete`);
      if (!response.ok) throw new Error('Failed to fetch suggestions from postcodes.io');
      
      const data: unknown = await response.json();
      
      // Type guard function
      function isPostcodesIOResponse(obj: unknown): obj is PostcodesIOResponse {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          'status' in obj &&
          'result' in obj &&
          (Array.isArray((obj as PostcodesIOResponse).result) || (obj as PostcodesIOResponse).result === null)
        );
      }

      if (!isPostcodesIOResponse(data)) {
        throw new Error('Unexpected response format from postcodes.io');
      }

      const suggestions = data.result || [];

      return new Response(JSON.stringify(suggestions), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error("Error fetching postcode suggestions:", error);
      return new Response(JSON.stringify({ error: 'Failed to fetch postcode suggestions' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  if (pathname === '/api/calculate-distance') {
    const url = new URL(request.url);
    const origin = url.searchParams.get('origin');
    const destination = url.searchParams.get('destination');

    if (!origin || !destination) {
      return new Response(JSON.stringify({ error: 'Origin and destination addresses are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${env.GOOGLE_MAPS_API_KEY}`;
      
      const response = await fetch(distanceMatrixUrl);
      if (!response.ok) throw new Error('Failed to fetch distance from Google Maps API');
      
      const data: unknown = await response.json();
      
      if (!isDistanceMatrixResponse(data)) {
        throw new Error('Invalid response format from Google Maps API');
      }

      if (data.status !== 'OK' || data.rows[0]?.elements[0]?.status !== 'OK') {
        throw new Error('Google Maps API unable to calculate distance');
      }

      const distanceInMeters = data.rows[0].elements[0].distance?.value;
      
      if (typeof distanceInMeters !== 'number') {
        throw new Error('Invalid distance value from Google Maps API');
      }

      const distanceInMiles = distanceInMeters / 1609.34;  // Convert meters to miles

      return new Response(JSON.stringify({ 
        distance: distanceInMiles.toFixed(2),
        unit: 'miles'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error("Error calculating distance:", error);
      return new Response(JSON.stringify({ error: 'Failed to calculate distance' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }
  if (pathname === '/api/ping') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  // Add new Stripe-related routes
  if (pathname === '/api/create-payment-intent' && request.method === 'POST') {
    return handleCreatePaymentIntent(request, env);
  }

  // Update the submit-quote handler to include payment processing
  if (pathname === '/api/submit-quote' && request.method === 'POST') {
    return handleSubmitQuote(request, env);
  }
  if (pathname === '/api/create-checkout-session' && request.method === 'POST') {
    return handleCreateCheckoutSession(request, env);
  }
  // Default return for unmatched routes
  return new Response('Not Found', { status: 404 });
}
async function handleCreateCheckoutSession(request: Request, env: Env): Promise<Response> {
  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as Stripe.LatestApiVersion});
    const data = await request.json() as QuoteData;

    // Create a new order in your database
    const orderResult = await env.MY_DB.prepare(
      `INSERT INTO orders (user, pickup, destination, price, completed, serviceLevel, shippingType, weight, datetime) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.user,
      data.pickup,
      data.destination,
      data.price,
      data.completed,
      data.serviceLevel,
      data.shippingType,
      data.weight,
      data.datetime // Add this line
    )
    .run();

    if (!orderResult || !orderResult.meta || orderResult.meta.changes !== 1) {
      throw new Error("Failed to insert the order");
    }

    const orderId = orderResult.meta.last_row_id;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Parcel Delivery',
              description: `From ${data.pickup} to ${data.destination}`,
            },
            unit_amount: Math.round(data.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${request.headers.get('Origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('Origin')}/quickquote`,
      metadata: {
        orderId: orderId.toString(),
      },
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
// Update the payment intent handler as well
async function handleCreatePaymentIntent(request: Request, env: Env): Promise<Response> {
  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as Stripe.LatestApiVersion});
    const body = await request.json() as { price: number };

    if (typeof body.price !== 'number') {
      throw new Error('Invalid price provided');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(body.price * 100), // Stripe expects amount in pence
      currency: 'gbp', // Changed from 'usd' to 'gbp'
    });

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return new Response(JSON.stringify({ error: 'Failed to create payment intent' }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
  
async function handleSubmitQuote(request: Request, env: Env): Promise<Response> {
  try {
    const data = await request.json() as QuoteData & { paymentIntentId: string };
    
    console.log('Received data:', JSON.stringify(data));
  
    const result = await env.MY_DB.prepare(
    `INSERT INTO orders (user, stripe_payment_intent_id, pickup, destination, price, completed, serviceLevel, shippingType, weight, datetime) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
    data.user,
    data.paymentIntentId,
    data.pickup,
    data.destination,
    data.price,
    data.completed,
    data.serviceLevel,
    data.shippingType,
    data.weight,
    data.datetime // Add this line
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
function isDistanceMatrixResponse(data: unknown): data is DistanceMatrixResponse {
	if (typeof data !== 'object' || data === null) {
	  return false;
	}
  
	const response = data as Partial<DistanceMatrixResponse>;
  
	return (
	  typeof response.status === 'string' &&
	  Array.isArray(response.rows) &&
	  response.rows.every(row =>
		Array.isArray(row.elements) &&
		row.elements.every(element =>
		  typeof element.status === 'string' &&
		  (element.distance === undefined ||
			(typeof element.distance.value === 'number' &&
			 typeof element.distance.text === 'string'))
		)
	  )
	);
  }