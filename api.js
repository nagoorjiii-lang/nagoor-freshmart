
/* =========================================
   NAGOOR FRESHMART
   API CONNECTION LAYER
   NEXORA Technologies
========================================= */

const NagoorAPI = {

  // Cloudflare Worker URL ready aanadhum inga add pannuvom.
  BASE_URL: "",

  async request(endpoint, options = {}) {

    if (!this.BASE_URL) {
      throw new Error("API URL not configured yet.");
    }

    const response = await fetch(
      this.BASE_URL.replace(/\/+$/, "") + endpoint,
      {
        method: options.method || "GET",

        headers: {
          "Content-Type": "application/json",
          ...options.headers
        },

        body: options.body
          ? JSON.stringify(options.body)
          : undefined
      }
    );

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("Invalid server response.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message || "Server request failed."
      );
    }

    return result;
  },

  health() {
    return this.request("/api/health");
  },

  dashboard() {
    return this.request("/api/dashboard");
  },

  products() {
    return this.request("/api/products");
  },

  suppliers() {
    return this.request("/api/suppliers");
  },

  customers() {
    return this.request("/api/customers");
  },

  inventory() {
    return this.request("/api/inventory");
  },

  reports() {
    return this.request("/api/reports");
  },

  saveGoatPurchase(data) {
    return this.request("/api/goat-purchases", {
      method: "POST",
      body: data
    });
  },

  saveMeatPurchase(data) {
    return this.request("/api/meat-purchases", {
      method: "POST",
      body: data
    });
  },

  saveSlaughter(data) {
    return this.request("/api/slaughter", {
      method: "POST",
      body: data
    });
  },

  saveSale(data) {
    return this.request("/api/sales", {
      method: "POST",
      body: data
    });
  },

  addStock(data) {
    return this.request("/api/inventory", {
      method: "POST",
      body: data
    });
  }

};

window.NagoorAPI = NagoorAPI;
