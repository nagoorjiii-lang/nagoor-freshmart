
/* =========================================
   NAGOOR FRESHMART
   Application Logic
   NEXORA Technologies
========================================= */

const NagoorApp = {

  language: "ta",

  init() {
    this.setupCalculations();
    this.setupDate();
    console.log("Nagoor FreshMart application initialized");
  },

  money(value) {
    return "₹" + (Number(value) || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  value(id) {
    return Number(document.getElementById(id)?.value) || 0;
  },

  calculateGoatPurchase() {
    const weight = this.value("goatWeight");
    const rate = this.value("goatRate");
    const other = this.value("goatOtherCost");

    document.getElementById("goatTotal").textContent =
      this.money(weight * rate + other);
  },

  calculateMeatPurchase() {
    const weight = this.value("meatWeight");
    const rate = this.value("meatRate");
    const other = this.value("meatOtherCost");

    document.getElementById("meatTotal").textContent =
      this.money(weight * rate + other);
  },

  calculateBill() {
    const weight = this.value("billWeight");
    const rate = this.value("billRate");

    document.getElementById("billTotal").textContent =
      this.money(weight * rate);
  },

  setupCalculations() {
    const fields = [
      ["goatWeight", "goatRate", "goatOtherCost"],
      ["meatWeight", "meatRate", "meatOtherCost"],
      ["billWeight", "billRate"]
    ];

    fields.forEach(group => {
      group.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
          element.addEventListener("input", () => {
            if (group[0] === "goatWeight") {
              this.calculateGoatPurchase();
            } else if (group[0] === "meatWeight") {
              this.calculateMeatPurchase();
            } else {
              this.calculateBill();
            }
          });
        }
      });
    });
  },

  toggleLanguage() {
    this.language = this.language === "ta" ? "en" : "ta";

    document.querySelectorAll("[data-ta][data-en]").forEach(element => {
      element.textContent =
        this.language === "ta"
          ? element.dataset.ta
          : element.dataset.en;
    });

    const button = document.getElementById("langButton");

    if (button) {
      button.textContent =
        this.language === "ta" ? "தமிழ்" : "English";
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

    if (!page) {
      console.error("Page not found:", pageId);
      return;
    }

    page.classList.add("active");

    if (button) {
      button.classList.add("active");
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  },

  setupDate() {
    const date = document.getElementById("slaughterDate");

    if (date && !date.value) {
      date.value = new Date().toLocaleDateString("en-CA");
    }
  }

};

/* Connect HTML buttons to application functions */

window.showPage = (pageId, button) =>
  NagoorApp.showPage(pageId, button);

window.toggleLanguage = () =>
  NagoorApp.toggleLanguage();

window.calculateGoatPurchase = () =>
  NagoorApp.calculateGoatPurchase();

window.calculateMeatPurchase = () =>
  NagoorApp.calculateMeatPurchase();

window.calculateBill = () =>
  NagoorApp.calculateBill();

/* Start application */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    NagoorApp.init();
  });
} else {
  NagoorApp.init();
}
