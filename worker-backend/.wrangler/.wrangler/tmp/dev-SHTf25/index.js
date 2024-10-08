// .wrangler/.wrangler/tmp/bundle-Kt97jH/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/index.ts
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return handleApiRequest(url.pathname, request, env);
    }
    return fetch(request);
  }
};
async function handleApiRequest(pathname, request, env) {
  if (pathname === "/api/submit-quote" && request.method === "POST") {
    try {
      const { results } = await env.MY_DB.prepare("PRAGMA table_info(orders)").all();
      console.log("Table schema:", JSON.stringify(results));
      const data = await request.json();
      console.log("Received data:", JSON.stringify(data));
      const result = await env.MY_DB.prepare(
        `INSERT INTO orders (user, stripe_price_id, pickup, destination, price, completed, serviceLevel, shippingType, weight) 
		   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.user,
        null,
        // stripe_price_id
        data.pickup,
        data.destination,
        data.price,
        data.completed,
        data.serviceLevel,
        data.shippingType,
        data.weight
      ).run();
      console.log("Database operation result:", JSON.stringify(result));
      if (result && result.meta && result.meta.changes === 1) {
        return new Response(JSON.stringify({ success: true, orderId: result.meta.last_row_id }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } else {
        throw new Error("Failed to insert the order");
      }
    } catch (error) {
      console.error("Error submitting quote:", error);
      return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
  if (pathname === "/api/hello") {
    const responseData = JSON.stringify({ message: "Hello from Cloudflare Worker!" });
    return new Response(responseData, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  if (pathname === "/api/orders") {
    try {
      const { results } = await env.MY_DB.prepare("SELECT * FROM orders").all();
      return new Response(JSON.stringify(results), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch orders" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
  if (pathname === "/api/postcode-suggestions") {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    if (!query || query.length < 2) {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      let isPostcodesIOResponse2 = function(obj) {
        return typeof obj === "object" && obj !== null && "status" in obj && "result" in obj && (Array.isArray(obj.result) || obj.result === null);
      };
      var isPostcodesIOResponse = isPostcodesIOResponse2;
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(query)}/autocomplete`);
      if (!response.ok)
        throw new Error("Failed to fetch suggestions from postcodes.io");
      const data = await response.json();
      if (!isPostcodesIOResponse2(data)) {
        throw new Error("Unexpected response format from postcodes.io");
      }
      const suggestions = data.result || [];
      return new Response(JSON.stringify(suggestions), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (error) {
      console.error("Error fetching postcode suggestions:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch postcode suggestions" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
  if (pathname === "/api/calculate-distance") {
    const url = new URL(request.url);
    const origin = url.searchParams.get("origin");
    const destination = url.searchParams.get("destination");
    if (!origin || !destination) {
      return new Response(JSON.stringify({ error: "Origin and destination addresses are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${env.GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(distanceMatrixUrl);
      if (!response.ok)
        throw new Error("Failed to fetch distance from Google Maps API");
      const data = await response.json();
      if (!isDistanceMatrixResponse(data)) {
        throw new Error("Invalid response format from Google Maps API");
      }
      if (data.status !== "OK" || data.rows[0]?.elements[0]?.status !== "OK") {
        throw new Error("Google Maps API unable to calculate distance");
      }
      const distanceInMeters = data.rows[0].elements[0].distance?.value;
      if (typeof distanceInMeters !== "number") {
        throw new Error("Invalid distance value from Google Maps API");
      }
      const distanceInMiles = distanceInMeters / 1609.34;
      return new Response(JSON.stringify({
        distance: distanceInMiles.toFixed(2),
        unit: "miles"
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (error) {
      console.error("Error calculating distance:", error);
      return new Response(JSON.stringify({ error: "Failed to calculate distance" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
  return new Response("Not Found", { status: 404 });
}
function isDistanceMatrixResponse(data) {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const response = data;
  return typeof response.status === "string" && Array.isArray(response.rows) && response.rows.every(
    (row) => Array.isArray(row.elements) && row.elements.every(
      (element) => typeof element.status === "string" && (element.distance === void 0 || typeof element.distance.value === "number" && typeof element.distance.text === "string")
    )
  );
}

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
};
var middleware_ensure_req_body_drained_default = drainBody;

// .wrangler/.wrangler/tmp/bundle-Kt97jH/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default
];
var middleware_insertion_facade_default = src_default;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}

// .wrangler/.wrangler/tmp/bundle-Kt97jH/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  };
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      };
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
