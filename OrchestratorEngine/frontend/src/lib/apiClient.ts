export const API_BASE = "http://localhost:8000";
export const WS_BASE = "ws://localhost:8000";

export const apiClient = {
  getModels: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/models/gemini`);
      if (!res.ok) throw new Error("API Network Error");
      const json = await res.json();
      if (json.status === "success") return json.data as string[];
      throw new Error(json.message || "Failed to fetch models");
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  
  generateAgents: async (payload: { name: string, audience: string, aspectRatio: string, pacing: string, language: string, description: string, includeVocals: boolean }) => {
    try {
      const res = await fetch(`${API_BASE}/api/factory/ai-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("API Network Error");
      const json = await res.json();
      if (json.status === "success") return json.data;
      throw new Error(json.message || "Failed to generate agents");
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  saveProject: async (payload: { name: string, config: any }) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("API Network Error");
      const json = await res.json();
      if (json.status === "success") return json;
      throw new Error(json.message || "Failed to save project");
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
};
