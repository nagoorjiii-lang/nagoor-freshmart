const NagoorAPI = {
  BASE_URL: "https://nagoor-freshmart.nagoorjiii.workers.dev",

  setBaseUrl(url) {
    this.BASE_URL = String(url || "").trim().replace(/\/+$/, "");
  },

  async request(path, options = {}) {
    if (!this.BASE_URL) {
      throw new Error("API URL is not configured yet.");
    }

    const response = await fetch(`${this.BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      body: options.body
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null
          ? data.error || data.message
          : data;

      throw new Error(message || `Request failed (${response.status})`);
    }

    return data;
  },

  health() {
    return this.request("/health");
  },

  dashboard() {
    return this.request("/dashboard");
  },

  products() {
    return this.request("/products");
  },

  suppliers() {
    return this.request("/suppliers");
  },

  customers() {
    return this.request("/customers");
  },

  inventory() {
    return this.request("/inventory");
  },

  reports() {
    return this.request("/reports");
  },

  goatLots() {
    return this.request("/goat-lots");
  },

  saveGoatPurchase(data) {
    return this.request("/goat-purchases", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  saveMeatPurchase(data) {
    return this.request("/meat-purchases", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  saveSlaughter(data) {
    return this.request("/slaughter", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  saveSale(data) {
    return this.request("/sales", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  addStock(data) {
    return this.request("/inventory", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  collectPayment(data) {
    return this.request("/payments", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  saveExpense(data) {
    return this.request("/expenses", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }
};

window.NagoorAPI = NagoorAPI;
