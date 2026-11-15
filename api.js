
/* =========================================
   NAGOOR FRESHMART
   Frontend API Connector
   NEXORA Technologies
   Version: 2.2.0
========================================= */

const NagoorAPI = {
  BASE_URL: "https://nagoor-freshmart.nagoorjiii.workers.dev",

  setBaseUrl(url) {
    this.BASE_URL = String(url || "")
      .trim()
      .replace(/\/+$/, "");
  },

  async request(path, options = {}) {
    if (!this.BASE_URL) {
      throw new Error("API URL is not configured yet.");
    }

    const config = {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    };

    if (options.body !== undefined) {
      config.body = options.body;
    }

    let response;

    try {
      response = await fetch(`${this.BASE_URL}${path}`, config);
    } catch (err) {
      throw new Error(
        "Server connection failed. Please check your internet connection."
      );
    }

    const contentType = response.headers.get("content-type") || "";

    let data;

    try {
      data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
    } catch (err) {
      throw new Error("Invalid response received from server.");
    }

    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null
          ? data.error || data.message
          : data;

      throw new Error(
        message || `Request failed (${response.status})`
      );
    }

    return data;
  },

  /* =========================================
     HEALTH & DASHBOARD
  ========================================= */

  health() {
    return this.request("/health");
  },

  dashboard() {
    return this.request("/dashboard");
  },

  /* =========================================
     MASTER DATA
  ========================================= */

  products() {
    return this.request("/products");
  },

  suppliers() {
    return this.request("/suppliers");
  },

  customers() {
    return this.request("/customers");
  },

  /* =========================================
     INVENTORY
  ========================================= */

  inventory() {
    return this.request("/inventory");
  },

  addStock(data) {
    return this.request("/inventory", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  /* =========================================
     REPORTS
  ========================================= */

  reports() {
    return this.request("/reports");
  },

  /* =========================================
     GOAT PURCHASE
  ========================================= */

  goatLots() {
    return this.request("/goat-lots");
  },

  saveGoatPurchase(data) {
    return this.request("/goat-purchases", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  /* =========================================
     MEAT PURCHASE
  ========================================= */

  saveMeatPurchase(data) {
    return this.request("/meat-purchases", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  /* =========================================
     SLAUGHTER
  ========================================= */

  saveSlaughter(data) {
    return this.request("/slaughter", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  /* =========================================
     SALES / BILLING

     Supports:
     - Single product sale
     - Multi-product cart sale
     - One invoice with multiple items

     Example:

     saveSale({
       customer_name: "Customer",
       items: [
         {
           product_name: "Bone-in Mutton",
           weight_kg: 2,
           rate_per_kg: 850
         },
         {
           product_name: "Liver",
           weight_kg: 0.5,
           rate_per_kg: 400
         }
       ],
       discount: 0,
       paid_amount: 1900,
       payment_method: "Cash"
     });
  ========================================= */

  saveSale(data) {
    if (!data || typeof data !== "object") {
      return Promise.reject(
        new Error("Invalid sale details.")
      );
    }

    const hasItems =
      Array.isArray(data.items) && data.items.length > 0;

    const hasSingleProduct =
      Boolean(data.product_name);

    if (!hasItems && !hasSingleProduct) {
      return Promise.reject(
        new Error("Please add at least one product to the bill.")
      );
    }

    return this.request("/sales", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  /* =========================================
     PAYMENT
  ========================================= */

  collectPayment(data) {
    return this.request("/payments", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  /* =========================================
     EXPENSES
  ========================================= */

  saveExpense(data) {
    return this.request("/expenses", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }
};

/* =========================================
   GLOBAL ACCESS
========================================= */

window.NagoorAPI = NagoorAPI;
