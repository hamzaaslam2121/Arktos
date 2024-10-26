import { D1Database } from '@cloudflare/workers-types';
import Stripe from 'stripe';

interface Env {
  MY_DB: D1Database;
  GOOGLE_MAPS_API_KEY: string; 
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SENDGRID_API_KEY: string;
}

interface QuoteData {
  user: string;
  pickup: string;
  destination: string;
  price: number;
  completed: number;
  shippingType: string;
  weight: number;
  datetime: string; 
  email: string;
  deliveryDate: string;  // Added
  deliveryTime: string;    // Added
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

    // Log the incoming request method and pathname for debugging
    console.log(`Incoming request: ${request.method} ${url.pathname}`);

    if (url.pathname.startsWith('/api')) {
      return handleApiRequest(url.pathname, request, env);
    }

    // Return the original response for non-API routes
    return fetch(request);
  }
};

async function handleApiRequest(pathname: string, request: Request, env: Env): Promise<Response> {

  // Normalize pathname to remove any trailing slashes
  pathname = pathname.replace(/\/+$/, '');

  // Log the normalized pathname
  console.log(`Normalized pathname: ${pathname}`);

  // Handle the Stripe webhook endpoint first
  if (pathname === '/api/stripe-webhook') {
    return handleWebhook(request, env);
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://arknetcouriers.co.uk',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  if (pathname === '/api/hello') {
    return new Response(
      JSON.stringify({ message: 'Hello from Cloudflare Worker!' }), 
      { headers }
    );
  }

  if (pathname === '/api/hello2') {
    return new Response(
      JSON.stringify({ message: 'Hello2 from Cloudflare Worker!' }), 
      { headers }
    );
  }

  if (pathname === '/api/ping') {
    return new Response(
      JSON.stringify({ message: 'Ping from Cloudflare Worker!' }), 
      { headers }
    );
  }

  if (pathname === '/api/orders') {
    try {
      const { results } = await env.MY_DB.prepare("SELECT * FROM orders").all();
      return new Response(JSON.stringify(results), { headers });
    } catch (error) {
      console.error("Error fetching orders:", error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch orders' }), 
        { status: 500, headers }
      );
    }
  }

  if (pathname === '/api/postcode-suggestions') {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query || query.length < 2) {
      return new Response(JSON.stringify([]), { headers });
    }

    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(query)}/autocomplete`);
      if (!response.ok) throw new Error('Failed to fetch suggestions from postcodes.io');
      
      const data: unknown = await response.json();
      
      if (!isPostcodesIOResponse(data)) {
        throw new Error('Unexpected response format from postcodes.io');
      }

      const suggestions = data.result || [];
      return new Response(JSON.stringify(suggestions), { headers });
    } catch (error) {
      console.error("Error fetching postcode suggestions:", error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch postcode suggestions' }), 
        { status: 500, headers }
      );
    }
  }

  if (pathname === '/api/calculate-distance') {
    const url = new URL(request.url);
    const origin = url.searchParams.get('origin');
    const destination = url.searchParams.get('destination');

    if (!origin || !destination) {
      return new Response(
        JSON.stringify({ error: 'Origin and destination addresses are required' }), 
        { status: 400, headers }
      );
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

      const distanceInMiles = distanceInMeters / 1609.34;

      return new Response(JSON.stringify({ 
        distance: distanceInMiles.toFixed(2),
        unit: 'miles'
      }), { headers });
    } catch (error) {
      console.error("Error calculating distance:", error);
      return new Response(
        JSON.stringify({ error: 'Failed to calculate distance' }), 
        { status: 500, headers }
      );
    }
  }

  if (pathname === '/api/create-payment-intent' && request.method === 'POST') {
    return handleCreatePaymentIntent(request, env);
  }

  if (pathname === '/api/create-checkout-session' && request.method === 'POST') {
    return handleCreateCheckoutSession(request, env, headers);
  }

  return new Response('Not Found', { status: 404, headers });
}

async function sendEmail(to: string, subject: string, text: string, env: Env) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'no-reply@em4267.arknetcouriers.co.uk' },  // Use the verified domain email
      subject: subject,
      content: [{ type: 'text/plain', value: text }]
    })
  });

  // Check response status and output the full response text for debugging
  if (!response.ok) {
    console.error("Failed to send email:", await response.text());
  } else {
    console.log("SendGrid response:", await response.text()); // Log the response if successful
  }
}



async function handleCreateCheckoutSession(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  console.log("in handle create checkout session");
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers });
  }

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as Stripe.LatestApiVersion });
    const data = await request.json() as QuoteData & { pickupPostcode: string; destinationPostcode: string };

    // Create a temporary pending order record
    const pendingResult = await env.MY_DB.prepare(
      `INSERT INTO pending_orders (
        user, pickup, destination, pickup_postcode, destination_postcode, price, completed, shippingType, 
        weight, datetime, status, email, pickup_date, time_slot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.user,
      data.pickup,
      data.destination,
      data.pickupPostcode,     // New field
      data.destinationPostcode, // New field
      data.price,
      data.completed,
      data.shippingType,
      data.weight,
      data.datetime,
      'pending',
      data.email,
      data.deliveryDate,
      data.deliveryTime
    )
    .run();

    const pendingOrderId = pendingResult.meta?.last_row_id;

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
      success_url: `${request.headers.get('Origin')}/orders?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('Origin')}/quickquote`,
      phone_number_collection: {
        enabled: true,
      },
      metadata: {
        pending_order_id: pendingOrderId?.toString(),
        user: data.user,
        pickup: data.pickup,
        destination: data.destination,
        pickup_postcode: data.pickupPostcode, // Add to metadata
        destination_postcode: data.destinationPostcode, // Add to metadata
        price: data.price.toString(),
        completed: data.completed.toString(),
        shippingType: data.shippingType,
        weight: data.weight.toString(),
        datetime: data.datetime,
        email: data.email,
        pickup_date: data.deliveryDate,
        time_slot: data.deliveryTime
      },
    });

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: {
        ...headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session', details: errorMessage }), 
      { status: 500, headers: { ...headers, 'Access-Control-Allow-Origin': '*' } }
    );
  }
}



async function handleWebhook(request: Request, env: Env): Promise<Response> {
  console.log(`Webhook request method: ${request.method}`);
  console.log(`Webhook request URL: ${request.url}`);
  console.log(`Webhook request headers:`, [...request.headers]);

  if (request.method !== 'POST') {
    console.warn(`Unexpected HTTP method: ${request.method}`);
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { 'Allow': 'POST' },
    });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-09-30.acacia',
  });
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    console.error('Invalid webhook request: Missing signature or webhook secret');
    return new Response('Invalid webhook request', { status: 400 });
  }

  try {
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );

    console.log(`Webhook event type: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      console.log('Session metadata:', metadata);

      if (!metadata) {
        throw new Error('No metadata found in session');
      }

      const phoneNumber = session.customer_details?.phone || '';

      const statements = [];

      const insertStatement = env.MY_DB.prepare(
        `INSERT INTO orders (
          user, pickup, destination, pickup_postcode, destination_postcode, price, completed, shippingType, 
          weight, datetime, stripe_payment_intent_id, email, phone_number, pickup_date, time_slot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const values = [
        metadata.user,
        metadata.pickup,
        metadata.destination,
        metadata.pickup_postcode,
        metadata.destination_postcode,
        parseFloat(metadata.price),
        parseInt(metadata.completed),
        metadata.shippingType,
        parseFloat(metadata.weight),
        metadata.datetime,
        session.payment_intent as string,
        metadata.email,
        phoneNumber,
        metadata.pickup_date,
        metadata.time_slot
      ];

      const boundStatement = insertStatement.bind(...values);
      statements.push(boundStatement);

      if (metadata.pending_order_id) {
        const deleteStatement = env.MY_DB.prepare('DELETE FROM pending_orders WHERE id = ?')
          .bind(metadata.pending_order_id);
        statements.push(deleteStatement);
      }

      const results = await env.MY_DB.batch(statements);

      const insertResult = results[0];
      if (!insertResult.meta?.changes) {
        throw new Error('Failed to insert confirmed order');
      }

      // Improved email formatting with HTML
      const emailContent = `
        <html>
        <head>
          <style>
            table {
              border-collapse: collapse;
              width: 100%;
              max-width: 600px;
              margin: 20px 0;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .order-header {
              background-color: #4a90e2;
              color: white;
              padding: 20px;
              text-align: center;
              margin-bottom: 20px;
            }
            .section-header {
              background-color: #f8f9fa;
              font-weight: bold;
              padding: 10px;
            }
          </style>
        </head>
        <body>
          <div class="order-header">
            <h2>New Order Confirmation</h2>
          </div>
          
          <table>
            <tr>
              <th colspan="2" class="section-header">Customer Information</th>
            </tr>
            <tr>
              <th>Customer Name</th>
              <td>${metadata.user}</td>
            </tr>
            <tr>
              <th>Email</th>
              <td>${metadata.email}</td>
            </tr>
            <tr>
              <th>Phone</th>
              <td>${phoneNumber}</td>
            </tr>

            <tr>
              <th colspan="2" class="section-header">Delivery Details</th>
            </tr>
            <tr>
              <th>Pickup Address</th>
              <td>${metadata.pickup}</td>
            </tr>
            <tr>
              <th>Pickup Postcode</th>
              <td>${metadata.pickup_postcode}</td>
            </tr>
            <tr>
              <th>Destination Address</th>
              <td>${metadata.destination}</td>
            </tr>
            <tr>
              <th>Destination Postcode</th>
              <td>${metadata.destination_postcode}</td>
            </tr>

            <tr>
              <th colspan="2" class="section-header">Shipping Information</th>
            </tr>
            <tr>
              <th>Shipping Type</th>
              <td>${metadata.shippingType}</td>
            </tr>
            <tr>
              <th>Weight</th>
              <td>${metadata.weight}kg</td>
            </tr>
            <tr>
              <th>Delivery Date</th>
              <td>${metadata.pickup_date}</td>
            </tr>
            <tr>
              <th>Time Slot</th>
              <td>${metadata.time_slot}</td>
            </tr>

            <tr>
              <th colspan="2" class="section-header">Order Summary</th>
            </tr>
            <tr>
              <th>Order Date & Time</th>
              <td>${metadata.datetime}</td>
            </tr>
            <tr>
              <th>Total Price</th>
              <td>£${metadata.price}</td>
            </tr>
          </table>
        </body>
        </html>
      `;
      
      await sendEmail('arknetcouriers@outlook.com', 'New Order Confirmation', emailContent, env);

      console.log('Order successfully inserted and pending order deleted if applicable.');
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          ...paymentIntent.metadata,
        },
      });

      console.log(`Updated metadata for Payment Intent on success: ${paymentIntent.id}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    return new Response(
      `Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 400 }
    );
  }
}


async function handleCreatePaymentIntent(request: Request, env: Env): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://arknetcouriers.co.uk',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as Stripe.LatestApiVersion });
    const body = await request.json() as { price: number };

    if (typeof body.price !== 'number') {
      throw new Error('Invalid price provided');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(body.price * 100),
      currency: 'gbp',
    });

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), { headers });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return new Response(
      JSON.stringify({ error: 'Failed to create payment intent' }), 
      { status: 500, headers }
    );
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

function isPostcodesIOResponse(obj: unknown): obj is PostcodesIOResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'status' in obj &&
    'result' in obj &&
    (Array.isArray((obj as PostcodesIOResponse).result) || (obj as PostcodesIOResponse).result === null)
  );
}
