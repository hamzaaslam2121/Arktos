addEventListener('fetch', event => {
	event.respondWith(handleRequest(event.request))
  })
  
  async function handleRequest(request: Request): Promise<Response> {
	const url = new URL(request.url)
	
	if (url.pathname.startsWith('/api')) {
	  // Handle API routes
	  return handleApiRequest(url.pathname, request)
	}
	
	// Handle other requests (e.g., serving the static Astro site)
	return fetch(request)
  }
  
  async function handleApiRequest(pathname: string, request: Request): Promise<Response> {
	// Example API route
	if (pathname === '/api/hello') {
	  const responseData = JSON.stringify({ message: 'Hello from Cloudflare Worker!' });
	  return new Response(responseData, {
		headers: { 
		  'Content-Type': 'application/json',
		  'Access-Control-Allow-Origin': '*', // Allow all origins in development
		},
	  });
	}
	
	return new Response('Not Found', { status: 404 });
  }