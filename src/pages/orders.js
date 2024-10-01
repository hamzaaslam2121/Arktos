export async function get({ locals }) {
    const { MY_DB } = locals;
    
    try {
      const { results } = await MY_DB.prepare("SELECT * FROM orders").all();
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      return new Response(JSON.stringify({ error: "Error fetching orders" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  }