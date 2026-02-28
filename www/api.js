import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from "./config.js";

export function createApi({ supabaseClient, getToken }) {
  const REQUEST_TIMEOUT_MS = 12000;

  function authHeaders() {
    return {
      Authorization: `Bearer ${getToken() || ""}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    };
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let resp;

    try {
      resp = await fetch(`${FUNCTIONS_BASE}${path}`, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) },
        signal: controller.signal
      });
    } catch (err) {
      if (err?.name === "AbortError") throw new Error("请求超时，请检查网络");
      throw err;
    } finally {
      clearTimeout(timer);
    }

    let data = {};
    try {
      data = await resp.json();
    } catch {
      data = {};
    }

    if (!resp.ok) {
      throw new Error(data.error || "请求失败");
    }
    return data;
  }

  return {
    async fetchFoodItems() {
      const data = await request("/food-items", { method: "GET" });
      return data.items || [];
    },

    async createFoodItem(payload) {
      const data = await request("/food-items", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      return data.item;
    },

    async updateFoodItem(payload) {
      const data = await request("/food-items", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      return data.item;
    },

    async deleteFoodItem(id) {
      const data = await request(`/food-items?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      return data.ok;
    },

    async fetchStats(range) {
      const path = range === "all" ? "/dashboard-stats" : `/dashboard-stats?range=${range}`;
      const data = await request(path, { method: "GET" });
      return data.stats;
    },

    async getSettings() {
      const { data, error } = await supabaseClient
        .from("user_settings")
        .select("expire_reminder")
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async ensureSettings(userId) {
      const exists = await this.getSettings();
      if (exists) return exists;
      const { data, error } = await supabaseClient
        .from("user_settings")
        .upsert({ user_id: userId, expire_reminder: true }, { onConflict: "user_id" })
        .select("expire_reminder")
        .single();
      if (error) throw error;
      return data;
    },

    async updateSettings(userId, expireReminder) {
      const { data, error } = await supabaseClient
        .from("user_settings")
        .update({ expire_reminder: expireReminder })
        .eq("user_id", userId)
        .select("expire_reminder")
        .single();
      if (error) throw error;
      return data;
    }
  };
}
