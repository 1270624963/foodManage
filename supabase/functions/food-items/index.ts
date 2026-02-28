import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS"
};

function getSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!supabaseAnonKey) {
    throw new Error("Missing apikey");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
}

function getAccessToken(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = getSupabaseClient(req);

  const accessToken = getAccessToken(req);
  const {
    data: { user },
    error: userErr
  } = await supabase.auth.getUser(accessToken || undefined);

  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("food_items")
      .select("id,name,category,quantity,in_date,expire_date,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ items: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const payload = {
      user_id: user.id,
      name: body.name,
      category: body.category,
      quantity: body.quantity,
      in_date: body.in_date,
      expire_date: body.expire_date
    };

    const { data, error } = await supabase
      .from("food_items")
      .insert(payload)
      .select("id,name,category,quantity,in_date,expire_date,created_at,updated_at")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ item: data }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (req.method === "PATCH") {
    const body = await req.json();
    if (!body.id) {
      return new Response(JSON.stringify({ error: "id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.quantity !== undefined) updates.quantity = body.quantity;
    if (body.in_date !== undefined) updates.in_date = body.in_date;
    if (body.expire_date !== undefined) updates.expire_date = body.expire_date;

    const { data, error } = await supabase
      .from("food_items")
      .update(updates)
      .eq("id", body.id)
      .select("id,name,category,quantity,in_date,expire_date,created_at,updated_at")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ item: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { error } = await supabase.from("food_items").delete().eq("id", id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
