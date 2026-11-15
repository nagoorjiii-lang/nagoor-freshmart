
/* =========================================
   NAGOOR FRESHMART
   Frontend Application
   NEXORA Technologies
   Version: 2.3.0
========================================= */

const App = {
  language: "ta",
  products: [],
  cart: [],
  savedBill: null,
  goatRecords: [],
  meatRecords: [],
  slaughterRecords: [],

  init() {
    this.setupDate();
    this.setupGoatPurchase();
    this.setupEventListeners();
    this.setupCalculations();
    this.updateGoatMode();
    this.loadApplication();
  },

  /* =========================================
     COMMON HELPERS
  ========================================= */

  money(value) {
    return "₹" + (Number(value) || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  number(id) {
    return Number(document.getElementById(id)?.value) || 0;
  },

  value(id) {
    return document.getElementById(id)?.value?.trim() || "";
  },

  setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  },

  setHTML(id, html) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = html;
  },

  escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  },

  today() {
    const now = new Date();
    const local = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    );
    return local.toISOString().slice(0, 10);
  },

  async apiCall(method, data) {
    if (!window.NagoorAPI || typeof NagoorAPI[method] !== "function") {
      throw new Error("API method missing: " + method);
    }

    const result = await NagoorAPI[method](data);

    if (result && result.success === false) {
      throw new Error(result.error || result.message || "Request failed");
    }

    return result;
  },

  showMessage(message, type = "info") {
    const old = document.getElementById("appMessage");
    if (old) old.remove();

    const box = document.createElement("div");
    box.id = "appMessage";
    box.textContent = message;

    Object.assign(box.style, {
      position: "fixed",
      top: "15px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "9999",
      maxWidth: "90%",
      padding: "13px 18px",
      borderRadius: "12px",
      color: "#fff",
      background: type === "error" ? "#a83d3d" :
        type === "success" ? "#174b3a" : "#354b42",
      boxShadow: "0 4px 18px #0002",
      fontWeight: "800",
      textAlign: "center"
    });

    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  },

  setButtonLoading(button, loading, originalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : originalText;
    button.style.opacity = loading ? "0.65" : "1";
  },

  setupDate() {
    [
      "goatPurchaseDate",
      "meatPurchaseDate",
      "slaughterDate"
    ].forEach(id => {
      const input = document.getElementById(id);
      if (input && !input.value) input.value = this.today();
    });
  },

  /* =========================================
     INITIAL DATA LOADING
  ========================================= */

  async loadApplication() {
    try {
      await this.loadProducts();
    } catch (error) {
      console.error("Product loading error:", error);
      this.showMessage(error.message, "error");
    }

    await Promise.allSettled([
      this.loadDashboard(),
      this.loadInventory(),
      this.loadGoatLots()
    ]);
  },

  async loadProducts() {
    const result = await this.apiCall("products");
    this.products = Array.isArray(result.data) ? result.data : [];

    this.updateProductDropdowns();
  },

  updateProductDropdowns() {
    const ids = ["meatProduct", "stockProduct", "billProduct"];

    ids.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;

      const previous = select.value;
      const placeholder = id === "billProduct"
        ? '<option value="">Select product</option>'
        : "";

      select.innerHTML = placeholder + this.products.map(product => {
        const name = this.escapeHTML(product.product_name);
        return `<option value="${name}">${name}</option>`;
      }).join("");

      if (previous && this.products.some(
        product => product.product_name === previous
      )) {
        select.value = previous;
      }
    });
  },

  async loadDashboard() {
    try {
      const result = await this.apiCall("dashboard");

      this.setText(
        "todaySales",
        this.money(Number(result.todaySalesPaise || 0) / 100)
      );

      this.setText(
        "todayPurchase",
        this.money(Number(result.todayPurchasePaise || 0) / 100)
      );

      this.setText(
        "availableStock",
        (Number(result.availableStockGrams || 0) / 1000).toFixed(3) + " kg"
      );

      this.setText(
        "creditAmount",
        this.money(Number(result.customerOutstandingPaise || 0) / 100)
      );
    } catch (error) {
      console.error("Dashboard error:", error);
    }
  },

  /* =========================================
     EVENT LISTENERS
  ========================================= */

  setupEventListeners() {
    this.bindClick("saveGoatPurchaseBtn", () => this.saveGoatPurchase());
    this.bindClick("saveMeatPurchaseBtn", () => this.saveMeatPurchase());
    this.bindClick("saveSlaughterBtn", () => this.saveSlaughter());
    this.bindClick("addStockBtn", () => this.addStock());
    this.bindClick("addBillItemBtn", () => this.addBillItem());
    this.bindClick("saveBillBtn", () => this.saveBill());
    this.bindClick("printBillBtn", () => this.printSavedBill());

    const billProduct = document.getElementById("billProduct");
    if (billProduct) {
      billProduct.addEventListener("change", () => this.updateBillRate());
    }

    ["billWeight", "billRate"].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", () => this.calculateBill());
      }
    });

    const paid = document.getElementById("billPaidAmount");
    if (paid) {
      paid.addEventListener("input", () => this.validatePaidAmount());
    }
  },

  bindClick(id, callback) {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener("click", callback);
    }
  },

  /* =========================================
     GOAT PURCHASE
  ========================================= */

  setupGoatPurchase() {
    const type = document.getElementById("goatType");
    const count = document.getElementById("goatCount");

    if (type) {
      type.addEventListener("change", () => {
        this.updateGoatMode();
        this.calculateGoatPreview();
      });
    }

    if (count) {
      count.addEventListener("input", () => {
        this.generateGoatWeightFields();
        this.calculateGoatPreview();
      });
    }

    [
      "goatRate",
      "goatOtherCost",
      "goatCombinedWeight",
      "goatPaidAmount"
    ].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", () => this.calculateGoatPreview());
      }
    });
  },

  updateGoatMode() {
    const type = this.value("goatType");
    const individual = document.getElementById("individualWeightSection");
    const combined = document.getElementById("combinedWeightSection");

    if (!individual || !combined) return;

    if (type === "combined") {
      individual.style.display = "none";
      combined.style.display = "block";
    } else {
      individual.style.display = "block";
      combined.style.display = "none";
      this.generateGoatWeightFields();
    }

    this.calculateGoatPreview();
  },

  generateGoatWeightFields() {
    const container = document.getElementById("goatIndividualWeights");
    const count = this.number("goatCount");

    if (!container) return;

    if (!Number.isInteger(count) || count < 1) {
      container.innerHTML =
        '<div class="empty">Enter number of goats to create weight fields.</div>';
      return;
    }

    if (count > 100) {
      container.innerHTML =
        '<div class="empty">Maximum 100 goats per purchase entry.</div>';
      return;
    }

    const oldValues = {};

    container.querySelectorAll("input").forEach(input => {
      oldValues[input.id] = input.value;
    });

    let html = "";

    for (let i = 1; i <= count; i++) {
      const id = "goatWeight_" + i;

      html += `
        <div class="field">
          <div class="weight-row">
            <div>
              <label for="${id}">Goat ${i} Weight (kg)</label>
              <input
                id="${id}"
                type="number"
                min="0"
                step="0.001"
                placeholder="Enter weight"
                value="${this.escapeHTML(oldValues[id] || "")}"
              >
            </div>
            <div class="goat-number">Goat ${i}</div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    container.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", () => this.calculateGoatPreview());
    });
  },

  getGoatWeights() {
    const count = this.number("goatCount");
    const type = this.value("goatType");

    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new Error("Enter a valid goat count (1 to 100).");
    }

    let weights = [];

    if (type === "individual") {
      for (let i = 1; i <= count; i++) {
        const input = document.getElementById("goatWeight_" + i);
        const weight = Number(input?.value);

        if (!input || !Number.isFinite(weight) || weight <= 0) {
          input?.focus();
          throw new Error("Enter a valid weight for Goat " + i);
        }

        weights.push(weight);
      }
    } else {
      const totalWeight = this.number("goatCombinedWeight");

      if (totalWeight <= 0) {
        throw new Error("Enter the combined goat weight.");
      }

      const average = totalWeight / count;
      weights = Array(count).fill(average);
    }

    return weights;
  },

  calculateGoatPurchase() {
    try {
      const weights = this.getGoatWeights();
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const rate = this.number("goatRate");
      const otherCost = this.number("goatOtherCost");

      if (rate <= 0 || otherCost < 0) {
        throw new Error("Enter a valid rate and other cost.");
      }

      const totalAmount = totalWeight * rate + otherCost;

      this.setText("goatTotalWeight", totalWeight.toFixed(3) + " kg");
      this.setText("goatTotal", this.money(totalAmount));

      return {
        weights,
        totalWeight,
        rate,
        otherCost,
        totalAmount
      };
    } catch (error) {
      this.resetGoatTotals();
      throw error;
    }
  },

  calculateGoatPreview() {
    try {
      this.calculateGoatPurchase();
    } catch {
      this.resetGoatTotals();
    }
  },

  resetGoatTotals() {
    this.setText("goatTotalWeight", "0.000 kg");
    this.setText("goatTotal", this.money(0));
  },

  async saveGoatPurchase() {
    const button = document.getElementById("saveGoatPurchaseBtn");
    const originalText = "கொள்முதல் சேமிக்க / Save Purchase";

    try {
      const calculation = this.calculateGoatPurchase();

      const supplier = this.value("goatSupplier");
      if (!supplier) throw new Error("Enter supplier name.");

      const paidAmount = this.number("goatPaidAmount");

      if (paidAmount < 0 || paidAmount > calculation.totalAmount) {
        throw new Error("Paid amount cannot exceed purchase total.");
      }

      const payload = {
        supplier_name: supplier,
        purchase_date: this.value("goatPurchaseDate") || this.today(),
        goat_count: calculation.weights.length,
        goat_weights_kg: calculation.weights,
        rate_per_kg: calculation.rate,
        other_cost: calculation.otherCost,
        paid_amount: paidAmount,
        payment_method: this.value("goatPaymentMethod") || "Cash"
      };

      this.setButtonLoading(button, true, originalText);

      const result = await this.apiCall("saveGoatPurchase", payload);

      this.goatRecords.unshift({
        date: payload.purchase_date,
        supplier,
        count: payload.goat_count,
        weight: calculation.totalWeight,
        total: calculation.totalAmount
      });

      this.renderGoatRecords();
      this.showMessage(
        "Goat purchase saved successfully. Purchase ID: " + result.purchaseId,
        "success"
      );

      this.resetGoatForm();
      await this.loadGoatLots();
      await this.loadDashboard();

    } catch (error) {
      this.showMessage(error.message, "error");
    } finally {
      this.setButtonLoading(button, false, originalText);
    }
  },

  resetGoatForm() {
    [
      "goatSupplier",
      "goatCount",
      "goatCombinedWeight",
      "goatRate",
      "goatOtherCost",
      "goatPaidAmount"
    ].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });

    this.generateGoatWeightFields();
    this.resetGoatTotals();
  },

  renderGoatRecords() {
    const body = document.getElementById("goatPurchaseTableBody");
    if (!body) return;

    if (!this.goatRecords.length) return;

    body.innerHTML = this.goatRecords.map(record => `
      <tr>
        <td>${this.escapeHTML(record.date)}</td>
        <td>${this.escapeHTML(record.supplier)}</td>
        <td>${record.count}</td>
        <td>${record.weight.toFixed(3)} kg</td>
        <td>${this.money(record.total)}</td>
      </tr>
    `).join("");
  },

  /* =========================================
     MEAT PURCHASE
  ========================================= */

  calculateMeatPurchase() {
    const weight = this.number("meatWeight");
    const rate = this.number("meatRate");
    const otherCost = this.number("meatOtherCost");

    if (weight <= 0 || rate <= 0 || otherCost < 0) {
      this.setText("meatTotal", this.money(0));
      return 0;
    }

    const total = weight * rate + otherCost;
    this.setText("meatTotal", this.money(total));

    return total;
  },

  async saveMeatPurchase() {
    const button = document.getElementById("saveMeatPurchaseBtn");
    const originalText = "கொள்முதல் சேமிக்க / Save Purchase";

    try {
      const supplier = this.value("meatSupplier");
      const product = this.value("meatProduct");
      const weight = this.number("meatWeight");
      const rate = this.number("meatRate");
      const otherCost = this.number("meatOtherCost");
      const paidAmount = this.number("meatPaidAmount");
      const total = this.calculateMeatPurchase();

      if (!supplier) throw new Error("Enter supplier name.");
      if (!product) throw new Error("Select a product.");
      if (weight <= 0 || rate <= 0) {
        throw new Error("Enter valid weight and rate.");
      }
      if (paidAmount < 0 || paidAmount > total) {
        throw new Error("Paid amount cannot exceed purchase total.");
      }

      const payload = {
        supplier_name: supplier,
        product_name: product,
        purchase_date: this.value("meatPurchaseDate") || this.today(),
        weight_kg: weight,
        rate_per_kg: rate,
        other_cost: otherCost,
        paid_amount: paidAmount,
        payment_method: this.value("meatPaymentMethod") || "Cash"
      };

      this.setButtonLoading(button, true, originalText);

      const result = await this.apiCall("saveMeatPurchase", payload);

      this.meatRecords.unshift({
        date: payload.purchase_date,
        supplier,
        product,
        weight,
        total
      });

      this.renderMeatRecords();

      this.showMessage(
        "Meat purchase saved. Purchase ID: " + result.purchaseId,
        "success"
      );

      [
        "meatSupplier",
        "meatWeight",
        "meatRate",
        "meatOtherCost",
        "meatPaidAmount"
      ].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = "";
      });

      this.setText("meatTotal", this.money(0));

      await this.loadInventory();
      await this.loadDashboard();

    } catch (error) {
      this.showMessage(error.message, "error");
    } finally {
      this.setButtonLoading(button, false, originalText);
    }
  },

  renderMeatRecords() {
    const body = document.getElementById("meatPurchaseTableBody");
    if (!body || !this.meatRecords.length) return;

    body.innerHTML = this.meatRecords.map(record => `
      <tr>
        <td>${this.escapeHTML(record.date)}</td>
        <td>${this.escapeHTML(record.supplier)}</td>
        <td>${this.escapeHTML(record.product)}</td>
        <td>${record.weight.toFixed(3)} kg</td>
        <td>${this.money(record.total)}</td>
      </tr>
    `).join("");
  },

  /* =========================================
     GOAT LOTS AND SLAUGHTER
  ========================================= */

  async loadGoatLots() {
    try {
      const result = await this.apiCall("goatLots");
      const lots = Array.isArray(result.data) ? result.data : [];

      const input = document.getElementById("batchId");
      if (!input) return;

      // Keep the existing input field, but attach lot suggestions.
      let list = document.getElementById("goatLotSuggestions");

      if (!list) {
        list = document.createElement("datalist");
        list.id = "goatLotSuggestions";
        document.body.appendChild(list);
        input.setAttribute("list", list.id);
      }

      list.innerHTML = lots
        .filter(lot => lot.slaughter_status !== "COMPLETED")
        .map(lot => `
          <option value="${Number(lot.id)}">
            ${this.escapeHTML(lot.goat_tag)} - ${this.escapeHTML(lot.supplier_name || "")}
          </option>
        `).join("");

    } catch (error) {
      console.error("Goat lot loading error:", error);
    }
  },

  async saveSlaughter() {
    const button = document.getElementById("saveSlaughterBtn");
    const originalText = "பதிவு செய்ய / Save Record";

    try {
      const lotId = Number(this.value("batchId"));
      const slaughterDate = this.value("slaughterDate") || this.today();
      const goats = this.number("slaughterGoats");
      const carcass = this.number("carcassWeight");
      const edible = this.number("edibleWeight");
      const waste = this.number("wasteWeight");

      if (!Number.isInteger(lotId) || lotId <= 0) {
        throw new Error("Enter a valid Goat Lot ID.");
      }

      // Worker API links one slaughter entry to one goat lot.
      if (goats !== 1) {
        throw new Error(
          "One Goat Lot ID represents one goat. Enter 1 goat for this record."
        );
      }

      if (carcass <= 0 || edible < 0 || waste < 0) {
        throw new Error("Enter valid carcass, edible and waste weights.");
      }

      const outputs = [
        {
          product_name: "Bone-in Mutton",
          weight_kg: carcass
        }
      ];

      if (edible > 0) {
        outputs.push({
          product_name: "Other Edible Parts",
          weight_kg: edible
        });
      }

      const payload = {
        goat_lot_id: lotId,
        slaughter_date: slaughterDate,
        carcass_weight_kg: carcass,
        total_output_weight_kg: carcass + edible,
        outputs,
        notes: waste > 0 ? `Waste / loss: ${waste} kg` : ""
      };

      this.setButtonLoading(button, true, originalText);

      const result = await this.apiCall("saveSlaughter", payload);

      this.slaughterRecords.unshift({
        date: slaughterDate,
        batch: lotId,
        carcass,
        edible,
        waste
      });

      this.renderSlaughterRecords();

      this.showMessage(
        "Slaughter saved. Batch ID: " + result.batchId,
        "success"
      );

      [
        "batchId",
        "slaughterGoats",
        "carcassWeight",
        "edibleWeight",
        "wasteWeight"
      ].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = "";
      });

      await this.loadGoatLots();
      await this.loadInventory();
      await this.loadDashboard();

    } catch (error) {
      this.showMessage(error.message, "error");
    } finally {
      this.setButtonLoading(button, false, originalText);
    }
  },

  renderSlaughterRecords() {
    const body = document.getElementById("slaughterTableBody");
    if (!body || !this.slaughterRecords.length) return;

    body.innerHTML = this.slaughterRecords.map(record => `
      <tr>
        <td>${this.escapeHTML(record.date)}</td>
        <td>${record.batch}</td>
        <td>${record.carcass.toFixed(3)} kg</td>
        <td>${record.edible.toFixed(3)} kg</td>
        <td>${record.waste.toFixed(3)} kg</td>
      </tr>
    `).join("");
  },

  /* =========================================
     INVENTORY
  ========================================= */

  async addStock() {
    const button = document.getElementById("addStockBtn");
    const originalText = "சரக்கு சேர்க்க / Add Stock";

    try {
      const product = this.value("stockProduct");
      const source = this.value("stockSource");
      const weight = this.number("stockWeight");
      const rate = this.number("stockRate");

      if (!product) throw new Error("Select a product.");
      if (weight <= 0 || rate <= 0) {
        throw new Error("Enter valid stock weight and selling rate.");
      }

      const payload = {
        product_name: product,
        source,
        weight_kg: weight,
        selling_rate: rate
      };

      this.setButtonLoading(button, true, originalText);

      await this.apiCall("addStock", payload);

      this.showMessage("Stock added successfully.", "success");

      document.getElementById("stockWeight").value = "";
      document.getElementById("stockRate").value = "";

      await this.loadInventory();
      await this.loadProducts();
      await this.loadDashboard();

    } catch (error) {
      this.showMessage(error.message, "error");
    } finally {
      this.setButtonLoading(button, false, originalText);
    }
  },

  async loadInventory() {
    try {
      const result = await this.apiCall("inventory");
      const rows = Array.isArray(result.data) ? result.data : [];

      const body = document.getElementById("inventoryTableBody");
      if (!body) return;

      if (!rows.length) {
        body.innerHTML =
          '<tr><td colspan="4" class="empty">No stock available</td></tr>';
        return;
      }

      body.innerHTML = rows.map(item => `
        <tr>
          <td>${this.escapeHTML(item.product_name)}</td>
          <td>${this.escapeHTML(item.stock_source || "Available")}</td>
          <td>${(Number(item.stock_quantity_grams || 0) / 1000).toFixed(3)} kg</td>
          <td>${this.money(Number(item.selling_price_paise || 0) / 100)}</td>
        </tr>
      `).join("");

    } catch (error) {
      console.error("Inventory loading error:", error);
    }
  },

  /* =========================================
     BILLING CALCULATIONS
  ========================================= */

  updateBillRate() {
    const productName = this.value("billProduct");
    const product = this.products.find(
      item => item.product_name === productName
    );

    const rateInput = document.getElementById("billRate");

    if (rateInput && product) {
      rateInput.value = (
        Number(product.selling_price_paise || 0) / 100
      ).toFixed(2);
    }

    this.calculateBill();
  },

  calculateBill() {
    const weight = this.number("billWeight");
    const rate = this.number("billRate");
    const total = weight > 0 && rate > 0 ? weight * rate : 0;

    this.setText("billTotal", this.money(total));

    return total;
  },

  /* =========================================
     MULTI-ITEM CART
  ========================================= */

  addBillItem() {
    try {
      if (this.savedBill) {
        throw new Error("This bill is already saved. Start a new bill first.");
      }

      const product = this.value("billProduct");
      const weight = this.number("billWeight");
      const rate = this.number("billRate");

      if (!product) throw new Error("Select a product.");
      if (weight <= 0 || rate <= 0) {
        throw new Error("Enter valid weight and rate.");
      }

      this.cart.push({
        product_name: product,
        weight_kg: weight,
        rate_per_kg: rate,
        total: weight * rate
      });

      this.renderCart();

      document.getElementById("billWeight").value = "";
      document.getElementById("billRate").value = "";
      this.setText("billTotal", this.money(0));

      this.showMessage("Product added to bill.", "success");

    } catch (error) {
      this.showMessage(error.message, "error");
    }
  },

  removeBillItem(index) {
    if (this.savedBill) return;

    if (!Number.isInteger(index) || index < 0 || index >= this.cart.length) {
      return;
    }

    this.cart.splice(index, 1);
    this.renderCart();
  },

  renderCart() {
    const body = document.getElementById("billCartBody");
    if (!body) return;

    if (!this.cart.length) {
      body.innerHTML =
        '<tr><td colspan="5" class="empty">No products added</td></tr>';
      this.setText("billGrandTotal", this.money(0));
      return;
    }

    body.innerHTML = this.cart.map((item, index) => `
      <tr>
        <td>${this.escapeHTML(item.product_name)}</td>
        <td>${item.weight_kg.toFixed(3)} kg</td>
        <td>${this.money(item.rate_per_kg)}</td>
        <td>${this.money(item.total)}</td>
        <td class="no-print">
          <button
            class="btn danger"
            type="button"
            onclick="App.removeBillItem(${index})"
            style="min-height:35px;padding:6px 10px"
            ${this.savedBill ? "disabled" : ""}
          >Remove</button>
        </td>
      </tr>
    `).join("");

    const grandTotal = this.cart.reduce(
      (sum, item) => sum + item.total,
      0
    );

    this.setText("billGrandTotal", this.money(grandTotal));
  },

  validatePaidAmount() {
    const paid = this.number("billPaidAmount");
    const total = this.cart.reduce(
      (sum, item) => sum + item.total,
      0
    );

    const input = document.getElementById("billPaidAmount");
    if (!input) return true;

    input.setCustomValidity(
      paid < 0 || paid > total
        ? "Paid amount cannot exceed bill total."
        : ""
    );

    return input.checkValidity();
  },

  /* =========================================
     SAVE BILL
  ========================================= */

  async saveBill() {
    const button = document.getElementById("saveBillBtn");
    const originalText = "Save Bill";

    try {
      if (this.savedBill) {
        throw new Error("This bill is already saved. Printing will not create another sale.");
      }

      if (!this.cart.length) {
        throw new Error("Add at least one product to the bill.");
      }

      const total = this.cart.reduce(
        (sum, item) => sum + item.total,
        0
      );

      const paymentMethod = this.value("paymentMethod") || "Cash";
      const paidInput = document.getElementById("billPaidAmount");
      let paidAmount;

      if (paymentMethod.toUpperCase() === "CREDIT") {
        paidAmount = paidInput && paidInput.value !== ""
          ? Number(paidInput.value)
          : 0;
      } else {
        paidAmount = paidInput && paidInput.value !== ""
          ? Number(paidInput.value)
          : total;
      }

      if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > total) {
        throw new Error("Enter a valid received amount.");
      }

      const payload = {
        customer_name: this.value("customerName"),
        sale_date: this.today(),
        items: this.cart.map(item => ({
          product_name: item.product_name,
          weight_kg: item.weight_kg,
          rate_per_kg: item.rate_per_kg
        })),
        discount: 0,
        paid_amount: paidAmount,
        payment_method: paymentMethod.toUpperCase(),
        notes: this.value("billNotes")
      };

      this.setButtonLoading(button, true, originalText);

      const result = await this.apiCall("saveSale", payload);

      // Store server response only after successful save.
      this.savedBill = {
        ...result,
        customerName: result.customerName || payload.customer_name || "Walk-in Customer",
        items: Array.isArray(result.items) ? result.items : [],
        totalAmount: Number(result.totalAmountPaise || 0) / 100,
        paidAmount: Number(result.paidAmountPaise || 0) / 100,
        balance: Number(result.balancePaise || 0) / 100
      };

      this.renderCart();
      this.renderReceipt();

      if (button) {
        button.disabled = true;
        button.textContent = "Bill Saved";
      }

      this.showMessage(
        "Bill saved successfully. Invoice: " + result.invoiceNumber,
        "success"
      );

      await this.loadInventory();
      await this.loadDashboard();

    } catch (error) {
      this.showMessage(error.message, "error");
    } finally {
      if (!this.savedBill) {
        this.setButtonLoading(button, false, originalText);
      }
    }
  },

  /* =========================================
     RECEIPT
  ========================================= */

  renderReceipt() {
    if (!this.savedBill) return;

    const bill = this.savedBill;
    const items = bill.items || [];

    const itemRows = items.map(item => `
      <tr>
        <td>${this.escapeHTML(item.productName)}</td>
        <td>${Number(item.weightKg || 0).toFixed(3)}</td>
        <td>${this.money(item.ratePerKg)}</td>
        <td>${this.money(Number(item.amountPaise || 0) / 100)}</td>
      </tr>
    `).join("");

    const html = `
      <div style="text-align:center;margin-bottom:12px">
        <strong>Invoice: ${this.escapeHTML(bill.invoiceNumber)}</strong><br>
        Date: ${this.escapeHTML(bill.saleDate || this.today())}<br>
        Customer: ${this.escapeHTML(bill.customerName)}
      </div>

      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th>Product</th>
            <th>Kg</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="margin-top:14px;text-align:right">
        <p>Subtotal: <strong>${this.money(Number(bill.subtotalPaise || 0) / 100)}</strong></p>
        <p>Discount: <strong>${this.money(Number(bill.discountPaise || 0) / 100)}</strong></p>
        <h3>Grand Total: ${this.money(bill.totalAmount)}</h3>
        <p>Received: <strong>${this.money(bill.paidAmount)}</strong></p>
        <p>Balance: <strong>${this.money(bill.balance)}</strong></p>
        <p>Payment: <strong>${this.escapeHTML(bill.paymentMethod || "")}</strong></p>
        <p>Status: <strong>${this.escapeHTML(bill.paymentStatus || "")}</strong></p>
      </div>

      <p style="text-align:center;margin-top:20px">
        Thank you! Visit Again.
      </p>
    `;

    this.setHTML("receiptContent", html);

    const receipt = document.getElementById("savedReceipt");
    if (receipt) receipt.style.display = "block";
  },

  printSavedBill() {
    if (!this.savedBill) {
      this.showMessage("Save the bill before printing.", "error");
      return;
    }

    this.renderReceipt();
    window.print();
  },

  /* =========================================
     CALCULATIONS / NAVIGATION
  ========================================= */

  setupCalculations() {
    [
      "meatWeight",
      "meatRate",
      "meatOtherCost"
    ].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", () => this.calculateMeatPurchase());
      }
    });
  },

  showPage(pageId) {
    const pages = document.querySelectorAll(".page");
    pages.forEach(page => page.classList.remove("active"));

    const selected = document.getElementById(pageId);
    if (!selected) return;

    selected.classList.add("active");

    document.querySelectorAll(".nav-btn").forEach(button => {
      button.classList.toggle(
        "active",
        button.getAttribute("data-page") === pageId ||
        button.getAttribute("onclick")?.includes(`'${pageId}'`)
      );
    });

    if (pageId === "dashboard") this.loadDashboard();
    if (pageId === "inventory") this.loadInventory();
    if (pageId === "slaughter") this.loadGoatLots();
  },

  toggleLanguage() {
    this.language = this.language === "ta" ? "en" : "ta";

    document.querySelectorAll("[data-ta][data-en]").forEach(element => {
      element.textContent = element.getAttribute(
        this.language === "ta" ? "data-ta" : "data-en"
      );
    });

    this.setText(
      "langButton",
      this.language === "ta" ? "தமிழ்" : "English"
    );
  }
};

/* =========================================
   GLOBAL FUNCTIONS
   Used by existing HTML onclick attributes
========================================= */

function calculateGoatPurchase() {
  try {
    return App.calculateGoatPurchase();
  } catch (error) {
    App.showMessage(error.message, "error");
    return null;
  }
}

function calculateMeatPurchase() {
  return App.calculateMeatPurchase();
}

function calculateBill() {
  return App.calculateBill();
}

function toggleLanguage() {
  return App.toggleLanguage();
}

function showPage(pageId) {
  return App.showPage(pageId);
}

/* =========================================
   START APPLICATION
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
