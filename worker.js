
/* =========================================
   NAGOOR FRESHMART
   Cloudflare Worker API
   NEXORA Technologies
========================================= */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function error(message, status = 400) {
  return json({ success: false, message }, status);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toGrams(value) {
  return Math.round((Number(value) || 0) * 1000);
}

function toPaise(value) {
  return Math.round((Number(value) || 0) * 100);
}

function amount(value) {
  return Number(value) || 0;
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function getProduct(db, name) {
  return db.prepare(
    "SELECT id, product_name FROM products WHERE product_name = ? AND is_active = 1"
  ).bind(name).first();
}

async function getSupplier(db, name) {
  if (!name || !name.trim()) return null;

  let supplier = await db.prepare(
    "SELECT id FROM suppliers WHERE supplier_name = ? LIMIT 1"
  ).bind(name.trim()).first();

  if (supplier) return supplier.id;

  const result = await db.prepare(
    "INSERT INTO suppliers (supplier_name) VALUES (?)"
  ).bind(name.trim()).run();

  return result.meta.last_row_id;
}

async function getCustomer(db, name) {
  if (!name || !name.trim()) return null;

  let customer = await db.prepare(
    "SELECT id FROM customers WHERE customer_name = ? LIMIT 1"
  ).bind(name.trim()).first();

  if (customer) return customer.id;

  const result = await db.prepare(
    "INSERT INTO customers (customer_name) VALUES (?)"
  ).bind(name.trim()).run();

  return result.meta.last_row_id;
}

/* =========================================
   HEALTH CHECK
========================================= */

async function health(db) {
  await db.prepare("SELECT 1").first();

  return json({
    success: true,
    message: "Nagoor Freshmart API is running",
    database: "Connected",
    application: "NAGOOR FRESHMART",
    version: "1.0.0"
  });
}

/* =========================================
   DASHBOARD
========================================= */

async function dashboard(db) {
  const sales = await db.prepare(`
    SELECT COALESCE(SUM(total_amount_paise), 0) AS total
    FROM sales
    WHERE sale_date = ?
  `).bind(today()).first();

  const purchases = await db.prepare(`
    SELECT COALESCE(SUM(total_amount_paise), 0) AS total
    FROM (
      SELECT total_amount_paise FROM goat_purchases
      WHERE purchase_date = ?

      UNION ALL

      SELECT total_amount_paise FROM meat_purchases
      WHERE purchase_date = ?
    )
  `).bind(today(), today()).first();

  const stock = await db.prepare(`
    SELECT COALESCE(SUM(stock_quantity_grams), 0) AS total
    FROM inventory_balance
  `).first();

  const credit = await db.prepare(`
    SELECT COALESCE(SUM(outstanding_balance_paise), 0) AS total
    FROM customer_outstanding
  `).first();

  return json({
    success: true,
    todaySalesPaise: sales.total,
    todayPurchasePaise: purchases.total,
    availableStockGrams: stock.total,
    customerOutstandingPaise: credit.total
  });
}

/* =========================================
   PRODUCTS
========================================= */

async function listProducts(db) {
  const result = await db.prepare(`
    SELECT * FROM products
    WHERE is_active = 1
    ORDER BY product_name
  `).all();

  return json({ success: true, data: result.results });
}

async function createProduct(db, data) {
  if (!data.product_name) return error("Product name required");

  const result = await db.prepare(`
    INSERT INTO products (
      product_name,
      product_code,
      category,
      unit,
      selling_price_paise,
      low_stock_alert_grams
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    data.product_name.trim(),
    data.product_code || null,
    data.category || null,
    data.unit || "KG",
    toPaise(data.selling_price),
    toGrams(data.low_stock_alert_kg)
  ).run();

  return json({
    success: true,
    message: "Product created",
    id: result.meta.last_row_id
  }, 201);
}

/* =========================================
   SUPPLIERS
========================================= */

async function listSuppliers(db) {
  const result = await db.prepare(`
    SELECT * FROM suppliers
    WHERE is_active = 1
    ORDER BY supplier_name
  `).all();

  return json({ success: true, data: result.results });
}

async function createSupplier(db, data) {
  if (!data.supplier_name) return error("Supplier name required");

  const result = await db.prepare(`
    INSERT INTO suppliers (
      supplier_name, phone, address, supplier_type, notes
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(
    data.supplier_name.trim(),
    data.phone || null,
    data.address || null,
    data.supplier_type || "GENERAL",
    data.notes || null
  ).run();

  return json({
    success: true,
    message: "Supplier created",
    id: result.meta.last_row_id
  }, 201);
}

/* =========================================
   CUSTOMERS
========================================= */

async function listCustomers(db) {
  const result = await db.prepare(`
    SELECT * FROM customer_outstanding
    ORDER BY customer_name
  `).all();

  return json({ success: true, data: result.results });
}

async function createCustomer(db, data) {
  if (!data.customer_name) return error("Customer name required");

  const result = await db.prepare(`
    INSERT INTO customers (
      customer_name, phone, address, notes
    ) VALUES (?, ?, ?, ?)
  `).bind(
    data.customer_name.trim(),
    data.phone || null,
    data.address || null,
    data.notes || null
  ).run();

  return json({
    success: true,
    message: "Customer created",
    id: result.meta.last_row_id
  }, 201);
}

/* =========================================
   INVENTORY
========================================= */

async function inventory(db) {
  const result = await db.prepare(`
    SELECT * FROM inventory_balance
    ORDER BY product_name
  `).all();

  return json({ success: true, data: result.results });
}

async function addStock(db, data) {
  if (!data.product_name) return error("Product name required");

  const product = await getProduct(db, data.product_name);

  if (!product) return error("Product not found. Create product first.", 404);

  const grams = toGrams(data.weight_kg);

  if (grams <= 0) return error("Valid stock weight required");

  const result = await db.prepare(`
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity_grams,
      reference_type,
      notes
    ) VALUES (?, 'IN', ?, 'MANUAL', ?)
  `).bind(
    product.id,
    grams,
    data.notes || null
  ).run();

  return json({
    success: true,
    message: "Stock added",
    movementId: result.meta.last_row_id
  }, 201);
}

/* =========================================
   GOAT PURCHASE
========================================= */

async function createGoatPurchase(db, data) {
  const weight = toGrams(data.weight_kg);
  const rate = amount(data.rate_per_kg);
  const other = amount(data.other_cost);
  const count = Math.max(1, Number(data.goat_count) || 1);

  if (weight <= 0 || rate <= 0) {
    return error("Valid goat weight and rate required");
  }

  const supplierId = await getSupplier(db, data.supplier_name);

  const total = toPaise(
    (weight / 1000) * rate + other
  );

  const purchase = await db.prepare(`
    INSERT INTO goat_purchases (
      supplier_id,
      purchase_date,
      goat_count,
      total_live_weight_grams,
      total_amount_paise,
      paid_amount_paise,
      payment_status,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    supplierId,
    data.purchase_date || today(),
    count,
    weight,
    total,
    toPaise(data.paid_amount),
    amount(data.paid_amount) >= (total / 100) ? "PAID" : "PENDING",
    data.notes || null
  ).run();

  return json({
    success: true,
    message: "Goat purchase saved",
    purchaseId: purchase.meta.last_row_id,
    totalAmountPaise: total
  }, 201);
}

/* =========================================
   MEAT PURCHASE
========================================= */

async function createMeatPurchase(db, data) {
  const weight = toGrams(data.weight_kg);
  const rate = amount(data.rate_per_kg);
  const other = amount(data.other_cost);

  if (weight <= 0 || rate <= 0) {
    return error("Valid meat weight and rate required");
  }

  const product = await getProduct(db, data.product_name);

  if (!product) return error("Create the selected product first", 404);

  const supplierId = await getSupplier(db, data.supplier_name);
  const total = toPaise((weight / 1000) * rate + other);

  const purchase = await db.prepare(`
    INSERT INTO meat_purchases (
      supplier_id,
      purchase_date,
      invoice_number,
      total_weight_grams,
      total_amount_paise,
      paid_amount_paise,
      payment_status,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    supplierId,
    data.purchase_date || today(),
    data.invoice_number || null,
    weight,
    total,
    toPaise(data.paid_amount),
    amount(data.paid_amount) >= (total / 100) ? "PAID" : "PENDING",
    data.notes || null
  ).run();

  const purchaseId = purchase.meta.last_row_id;

  await db.batch([
    db.prepare(`
      INSERT INTO meat_purchase_items (
        meat_purchase_id,
        product_id,
        quantity_grams,
        unit_price_paise,
        total_amount_paise
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      purchaseId,
      product.id,
      weight,
      toPaise(rate),
      total
    ),

    db.prepare(`
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity_grams,
        reference_type,
        reference_id,
        notes
      ) VALUES (?, 'IN', ?, 'MEAT_PURCHASE', ?, ?)
    `).bind(
      product.id,
      weight,
      purchaseId,
      "Direct meat purchase"
    )
  ]);

  return json({
    success: true,
    message: "Meat purchase saved and stock updated",
    purchaseId
  }, 201);
}

/* =========================================
   SALES / BILLING
========================================= */

async function createSale(db, data) {
  if (!data.product_name) return error("Select a product");

  const weight = toGrams(data.weight_kg);
  const rate = amount(data.rate_per_kg);

  if (weight <= 0 || rate <= 0) {
    return error("Valid weight and rate required");
  }

  const product = await getProduct(db, data.product_name);

  if (!product) return error("Product not found", 404);

  const stock = await db.prepare(`
    SELECT stock_quantity_grams
    FROM inventory_balance
    WHERE product_id = ?
  `).bind(product.id).first();

  if (!stock || stock.stock_quantity_grams < weight) {
    return error("Insufficient stock", 409);
  }

  const customerId = await getCustomer(db, data.customer_name);

  const subtotal = toPaise((weight / 1000) * rate);
  const discount = toPaise(data.discount || 0);
  const total = Math.max(0, subtotal - discount);

  let paid = total;

  if (data.payment_method === "Credit") {
    paid = 0;
  } else if (data.paid_amount !== undefined) {
    paid = Math.min(total, toPaise(data.paid_amount));
  }

  const invoice = "NFS-" + Date.now();

  const sale = await db.prepare(`
    INSERT INTO sales (
      invoice_number,
      customer_id,
      sale_date,
      subtotal_paise,
      discount_paise,
      total_amount_paise,
      paid_amount_paise,
      payment_status,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    invoice,
    customerId,
    data.sale_date || today(),
    subtotal,
    discount,
    total,
    paid,
    paid >= total ? "PAID" : "PENDING",
    data.notes || null
  ).run();

  const saleId = sale.meta.last_row_id;

  await db.batch([
    db.prepare(`
      INSERT INTO sale_items (
        sale_id,
        product_id,
        quantity_grams,
        unit_price_paise,
        total_amount_paise
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      saleId,
      product.id,
      weight,
      toPaise(rate),
      total
    ),

    db.prepare(`
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity_grams,
        reference_type,
        reference_id,
        notes
      ) VALUES (?, 'OUT', ?, 'SALE', ?, ?)
    `).bind(
      product.id,
      -weight,
      saleId,
      "Customer sale"
    ),

    ...(paid > 0 ? [
      db.prepare(`
        INSERT INTO payments (
          payment_type,
          reference_type,
          reference_id,
          payment_date,
          amount_paise,
          payment_method
        ) VALUES ('IN', 'SALE', ?, ?, ?, ?)
      `).bind(
        saleId,
        today(),
        paid,
        data.payment_method || "CASH"
      )
    ] : [])
  ]);

  return json({
    success: true,
    message: "Bill created",
    invoiceNumber: invoice,
    saleId,
    totalAmountPaise: total,
    paidAmountPaise: paid
  }, 201);
}

/* =========================================
   SLAUGHTER
========================================= */

async function createSlaughter(db, data) {
  const lotId = Number(data.goat_lot_id);
  const carcass = toGrams(data.carcass_weight_kg);
  const output = toGrams(data.total_output_weight_kg);

  if (!lotId || carcass <= 0) {
    return error("Valid goat lot and carcass weight required");
  }

  const lot = await db.prepare(`
    SELECT id, live_weight_grams, slaughter_status
    FROM goat_purchase_lots
    WHERE id = ?
  `).bind(lotId).first();

  if (!lot) return error("Goat lot not found", 404);

  if (lot.slaughter_status === "COMPLETED") {
    return error("This goat lot is already slaughtered", 409);
  }

  const batch = await db.prepare(`
    INSERT INTO slaughter_batches (
      goat_lot_id,
      slaughter_date,
      live_weight_grams,
      carcass_weight_grams,
      total_output_weight_grams,
      slaughter_cost_paise,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    lotId,
    data.slaughter_date || today(),
    lot.live_weight_grams,
    carcass,
    output || carcass,
    toPaise(data.slaughter_cost),
    data.notes || null
  ).run();

  await db.prepare(`
    UPDATE goat_purchase_lots
    SET slaughter_status = 'COMPLETED',
        slaughter_date = ?
    WHERE id = ?
  `).bind(data.slaughter_date || today(), lotId).run();

  return json({
    success: true,
    message: "Slaughter record saved",
    batchId: batch.meta.last_row_id
  }, 201);
}

/* =========================================
   EXPENSES
========================================= */

async function createExpense(db, data) {
  if (!data.expense_category) {
    return error("Expense category required");
  }

  const amountPaise = toPaise(data.amount);

  if (amountPaise <= 0) return error("Valid expense amount required");

  const result = await db.prepare(`
    INSERT INTO expenses (
      expense_category,
      description,
      expense_date,
      amount_paise,
      payment_method,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    data.expense_category,
    data.description || null,
    data.expense_date || today(),
    amountPaise,
    data.payment_method || "CASH",
    data.notes || null
  ).run();

  return json({
    success: true,
    message: "Expense saved",
    id: result.meta.last_row_id
  }, 201);
}

/* =========================================
   REPORTS
========================================= */

async function reports(db) {
  const daily = await db.prepare(`
    SELECT * FROM daily_sales_summary
    ORDER BY sale_date DESC
    LIMIT 30
  `).all();

  const purchases = await db.prepare(`
    SELECT
      COALESCE(SUM(total_amount_paise), 0) AS total
    FROM (
      SELECT total_amount_paise FROM goat_purchases
      UNION ALL
      SELECT total_amount_paise FROM meat_purchases
    )
  `).first();

  const sales = await db.prepare(`
    SELECT COALESCE(SUM(total_amount_paise), 0) AS total
    FROM sales
  `).first();

  const credit = await db.prepare(`
    SELECT COALESCE(SUM(outstanding_balance_paise), 0) AS total
    FROM customer_outstanding
  `).first();

  return json({
    success: true,
    totalSalesPaise: sales.total,
    totalPurchasePaise: purchases.total,
    customerOutstandingPaise: credit.total,
    dailySales: daily.results
  });
}

/* =========================================
   MAIN ROUTER
========================================= */

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (!env.DB) {
      return error("D1 database binding DB is missing", 500);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method;

    try {
      if (method === "GET" && path === "/") {
        return json({
          success: true,
          application: "NAGOOR FRESHMART",
          message: "API is online"
        });
      }

      if (method === "GET" && path === "/api/health") {
        return await health(env.DB);
      }

      if (method === "GET" && path === "/api/dashboard") {
        return await dashboard(env.DB);
      }

      if (method === "GET" && path === "/api/products") {
        return await listProducts(env.DB);
      }

      if (method === "POST" && path === "/api/products") {
        return await createProduct(env.DB, await readBody(request));
      }

      if (method === "GET" && path === "/api/suppliers") {
        return await listSuppliers(env.DB);
      }

      if (method === "POST" && path === "/api/suppliers") {
        return await createSupplier(env.DB, await readBody(request));
      }

      if (method === "GET" && path === "/api/customers") {
        return await listCustomers(env.DB);
      }

      if (method === "POST" && path === "/api/customers") {
        return await createCustomer(env.DB, await readBody(request));
      }

      if (method === "GET" && path === "/api/inventory") {
        return await inventory(env.DB);
      }

      if (method === "POST" && path === "/api/inventory") {
        return await addStock(env.DB, await readBody(request));
      }

      if (method === "POST" && path === "/api/goat-purchases") {
        return await createGoatPurchase(env.DB, await readBody(request));
      }

      if (method === "POST" && path === "/api/meat-purchases") {
        return await createMeatPurchase(env.DB, await readBody(request));
      }

      if (method === "POST" && path === "/api/slaughter") {
        return await createSlaughter(env.DB, await readBody(request));
      }

      if (method === "POST" && path === "/api/sales") {
        return await createSale(env.DB, await readBody(request));
      }

      if (method === "POST" && path === "/api/expenses") {
        return await createExpense(env.DB, await readBody(request));
      }

      if (method === "GET" && path === "/api/reports") {
        return await reports(env.DB);
      }

      return error("API endpoint not found", 404);

    } catch (err) {
      console.error("Nagoor Freshmart API error:", err);

      return json({
        success: false,
        message: "Internal server error",
        detail: err.message
      }, 500);
    }
  }
};
