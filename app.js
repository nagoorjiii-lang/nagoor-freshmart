
const App = {
  language: "ta",

  init() {
    this.setupCalculations();
    this.setupDate();
    this.setupGoatPurchase();
    this.updateGoatMode();
  },

  money(value) {
    return "₹" + (Number(value) || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  number(id) {
    return Number(document.getElementById(id)?.value) || 0;
  },

  calculateGoatPurchase() {
    const type = document.getElementById("goatType")?.value;
    const count = this.number("goatCount");
    const rate = this.number("goatRate");
    const otherCost = this.number("goatOtherCost");

    let weights = [];

    if (!Number.isInteger(count) || count < 1) {
      alert("Please enter a valid number of goats.");
      return;
    }

    if (type === "individual") {
      for (let i = 1; i <= count; i++) {
        const input = document.getElementById("goatWeight_" + i);
        const weight = Number(input?.value);

        if (!input || !Number.isFinite(weight) || weight <= 0) {
          alert("Please enter the weight of Goat " + i);
          input?.focus();
          return;
        }

        weights.push(weight);
      }
    } else {
      const combinedWeight = this.number("goatCombinedWeight");

      if (combinedWeight <= 0) {
        alert("Please enter the combined goat weight.");
        return;
      }

      const averageWeight = combinedWeight / count;

      for (let i = 0; i < count; i++) {
        weights.push(averageWeight);
      }
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const totalAmount = (totalWeight * rate) + otherCost;

    document.getElementById("goatTotalWeight").textContent =
      totalWeight.toFixed(3) + " kg";

    document.getElementById("goatTotal").textContent =
      this.money(totalAmount);

    return {
      type,
      count,
      weights,
      totalWeight,
      rate,
      otherCost,
      totalAmount
    };
  },

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

    ["goatRate", "goatOtherCost", "goatCombinedWeight"].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", () => this.calculateGoatPreview());
      }
    });
  },

  updateGoatMode() {
    const type = document.getElementById("goatType")?.value;
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
                class="individual-goat-weight"
                type="number"
                min="0"
                step="0.001"
                placeholder="Enter weight"
                value="${oldValues[id] || ""}"
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

  calculateGoatPreview() {
    const type = document.getElementById("goatType")?.value;
    const count = this.number("goatCount");

    if (!Number.isInteger(count) || count < 1 || count > 100) {
      this.resetGoatTotals();
      return;
    }

    let totalWeight = 0;

    if (type === "individual") {
      for (let i = 1; i <= count; i++) {
        const input = document.getElementById("goatWeight_" + i);

        if (!input || input.value === "") {
          this.resetGoatTotals();
          return;
        }

        const weight = Number(input.value);

        if (!Number.isFinite(weight) || weight <= 0) {
          this.resetGoatTotals();
          return;
        }

        totalWeight += weight;
      }
    } else {
      totalWeight = this.number("goatCombinedWeight");

      if (totalWeight <= 0) {
        this.resetGoatTotals();
        return;
      }
    }

    const rate = this.number("goatRate");
    const otherCost = this.number("goatOtherCost");
    const totalAmount = (totalWeight * rate) + otherCost;

    document.getElementById("goatTotalWeight").textContent =
      totalWeight.toFixed(3) + " kg";

    document.getElementById("goatTotal").textContent =
      this.money(totalAmount);
  },

  resetGoatTotals() {
    const weight = document.getElementById("goatTotalWeight");
    const total = document.getElementById("goatTotal");

    if (weight) weight.textContent = "0.000 kg";
    if (total) total.textContent = "₹0.00";
  },

  calculateMeatPurchase() {
    const weight = this.number("meatWeight");
    const rate = this.number("meatRate");
    const otherCost = this.number("meatOtherCost");

    const total = (weight * rate) + otherCost;

    document.getElementById("meatTotal").textContent =
      this.money(total);

    return total;
  },

  calculateBill() {
    const weight = this.number("billWeight");
    const rate = this.number("billRate");

    const total = weight * rate;

    document.getElementById("billTotal").textContent =
      this.money(total);

    return total;
  },

  setupCalculations() {
    ["meatWeight", "meatRate", "meatOtherCost"].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", () => this.calculateMeatPurchase());
      }
    });

    ["billWeight", "billRate"].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", () => this.calculateBill());
      }
    });
  },

  toggleLanguage() {
    this.language = this.language === "ta" ? "en" : "ta";

    document.querySelectorAll("[data-ta][data-en]").forEach(element => {
      element.textContent = element.getAttribute(
        this.language === "ta" ? "data-ta" : "data-en"
      );
    });

    const button = document.getElementById("langButton");

    if (button) {
      button.textContent = this.language === "ta" ? "தமிழ்" : "English";
    }
  },

  showPage(pageId, button) {
    document.querySelectorAll(".page").forEach(page => {
      page.classList.remove("active");
    });

    document.querySelectorAll(".nav-btn").forEach(nav => {
      nav.classList.remove("active");
    });

    const page = document.getElementById(pageId);

    if (page) page.classList.add("active");
    if (button) button.classList.add("active");

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  setupDate() {
    const dateInput = document.getElementById("slaughterDate");

    if (dateInput && !dateInput.value) {
      const now = new Date();
      const localDate = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
      ).toISOString().slice(0, 10);

      dateInput.value = localDate;
    }
  }
};

function calculateGoatPurchase() {
  return App.calculateGoatPurchase();
}

function calculateMeatPurchase() {
  return App.calculateMeatPurchase();
}

function calculateBill() {
  return App.calculateBill();
}

function toggleLanguage() {
  App.toggleLanguage();
}

function showPage(pageId, button) {
  App.showPage(pageId, button);
}

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
