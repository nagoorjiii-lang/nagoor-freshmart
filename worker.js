
/* =========================================
   NAGOOR FRESHMART
   Cloudflare Worker API
   NEXORA Technologies
   Version: 2.0.0
========================================= */

const APP_NAME = "NAGOOR FRESHMART";
const VERSION = "2.0.0";

/* =========================================
   COMMON HELPERS
========================================= */

function cors(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };

  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function error(message, status = 400, headers = {}) {
  return json({
    success: false,
    error: message
  }, status, headers);
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function toGrams(value) {
  return Math.round(number(value) * 1000);
}

function toPaise(value) {
  return Math.round(number(value) * 100);
}

function validText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validDate(value) {
  if (!value) return today();

  const date = String(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

async function readBody(request) {
  try {
    const data = await request.json();

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

async function getProduct(db, name) {
  if (!validText(name)) return null;

  return db.prepare(`
    SELECT id, product_name
    FROM products
    WHERE product_name = ?
      AND is_active = 1
    LIMIT 1
  `).bind(name.trim()).first();
}

async function getSupplier(db, name) {
  if (!validText(name)) return null;

  const cleanName = name.trim();

  const existing = await db.prepare(`
    SELECT id
    FROM suppliers
    WHERE supplier_name = ?
    LIMIT 1
  `).bind(cleanName).first();

  if (existing) return existing.id;

  const result = await db.prepare(`
    INSERT INTO suppliers (supplier_name)
    VALUES (?)
  `).bind(cleanName).run();

  return result.meta.last_row_id;
}

async function getCustomer(db, name) {
  if (!validText(name)) return null;

  const cleanName = name.trim();

  const existing = await db.prepare(`
    SELECT id
    FROM customers
    WHERE customer_name = ?
    LIMIT 1
  `).bind(cleanName).first();

  if (existing) return existing.id;

  const result = await db.prepare(`
    INSERT INTO customers (customer_name)
    VALUES (?)
  `).bind(cleanName).run();

  return result.meta.last_row_id;
}

function paymentStatus(paid, total) {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "PENDING";
}

/* =========================================
   HEALTH CHECK
========================================= */

async function health(db) {
  await db.prepare("SELECT 1").first();

  return json({
    success: true,
    application: APP_NAME,
    version: VERSION,
    database: "Connected",
    message: "Nagoor Freshmart API is running"
  });
}

/* =========================================
   DASHBOARD
========================================= */

async function dashboard(db) {
  const date = today();

  const sales = await db.prepare(`
    SELECT COALESCE(SUM(total_amount_paise), 0) AS total
    FROM sales
    WHERE sale_date = ?
  `).bind(date).first();

  const purchases = await db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total
    FROM (
      SELECT total_amount_paise AS total
      FROM goat_purchases
      WHERE purchase_date = ?

      UNION ALL

      SELECT total_amount_paise AS total
      FROM meat_purchases
      WHERE purchase_date = ?
    )
  `).bind(date, date).first();

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
    date,
    todaySalesPaise: sales?.total || 0,
    todayPurchasePaise: purchases?.total || 0,
    availableStockGrams: stock?.total || 0,
    customerOutstandingPaise: credit?.total || 0
  });
}

/* =========================================
   PRODUCTS
========================================= */

async function listProducts(db) {
  const result = await db.prepare(`
    SELECT *
    FROM products
    WHERE is_active = 1
    ORDER BY product_name
  `).all();

  return json({
    success: true,
    data: result.results
  });
}

async function createProduct(db, data) {
  if (!validText(data.product_name)) {
    return error("Product name required");
  }

  if (number(data.selling_price) < 0) {
    return error("Invalid selling price");
  }

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
    Math.max(0, toGrams(data.low_stock_alert_kg))
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
    SELECT *
    FROM suppliers
    WHERE is_active = 1
    ORDER BY supplier_name
  `).all();

  return json({
    success: true,
    data: result.results
  });
}

async function createSupplier(db, data) {
  if (!validText(data.supplier_name)) {
    return error("Supplier name required");
  }

  const result = await db.prepare(`
    INSERT INTO suppliers (
      supplier_name,
      phone,
      address,
      supplier_type,
      notes
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
    SELECT *
    FROM customer_outstanding
    ORDER BY customer_name
  `).all();

  return json({
    success: true,
    data: result.results
  });
}

async function createCustomer(db, data) {
  if (!validText(data.customer_name)) {
    return error("Customer name required");
  }

  const result = await db.prepare(`
    INSERT INTO customers (
      customer_name,
      phone,
      address,
      notes
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
    SELECT *
    FROM inventory_balance
    ORDER BY product_name
  `).all();

  return json({
    success: true,
    data: result.results
  });
}

async function addStock(db, data) {
  if (!validText(data.product_name)) {
    return error("Product name required");
  }

  const product = await getProduct(db, data.product_name);

  if (!product) {
    return error("Product not found. Create product first.", 404);
  }

  const grams = toGrams(data.weight_kg);

  if (grams <= 0) {
    return error("Valid stock weight required");
  }

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
   GOAT LOTS
========================================= */

async function listGoatLots(db) {
  const result = await db.prepare(`
    SELECT
      l.id,
      l.goat_purchase_id,
      l.goat_tag,
      l.live_weight_grams,
      l.purchase_cost_paise,
      l.slaughter_status,
      l.slaughter_date,
      l.notes,
      p.purchase_date,
      s.supplier_name
    FROM goat_purchase_lots l
    JOIN goat_purchases p
      ON p.id = l.goat_purchase_id
    LEFT JOIN suppliers s
      ON s.id = p.supplier_id
    ORDER BY l.id DESC
  `).all();

  return json({
    success: true,
    data: result.results
  });
}

/* =========================================
   GOAT PURCHASE
========================================= */

async function createGoatPurchase(db, data) {
  const purchaseDate = validDate(data.purchase_date);

  if (!purchaseDate) {
    return error("Invalid purchase date");
  }

  const count = Math.floor(number(data.goat_count));

  if (count < 1 || count > 100) {
    return error("Goat count must be between 1 and 100");
  }

  const rate = number(data.rate_per_kg);
  const otherCost = number(data.other_cost);
  const paidAmount = number(data.paid_amount);

  if (rate <= 0 || otherCost < 0 || paidAmount < 0) {
    return error("Invalid rate, cost or paid amount");
  }

  let weights = [];

  if (Array.isArray(data.goat_weights_kg)) {
    if (data.goat_weights_kg.length !== count) {
      return error("Enter the weight for every goat");
    }

    weights = data.goat_weights_kg.map(toGrams);

    if (weights.some(weight => weight <= 0)) {
      return error("Every goat must have a valid weight");
    }
  } else {
    const totalWeight = toGrams(data.total_weight_kg ?? data.weight_kg);

    if (totalWeight <= 0) {
      return error("Valid total goat weight required");
    }

    const average = Math.floor(totalWeight / count);
    let remaining = totalWeight;

    for (let i = 0; i < count; i++) {
      const weight = i === count - 1 ? remaining : average;
      weights.push(weight);
      remaining -= weight;
    }
  }

  const totalWeightGrams = weights.reduce((sum, weight) => sum + weight, 0);

  const baseCost = (totalWeightGrams / 1000) * rate;
  const totalAmount = toPaise(baseCost + otherCost);

  const paidPaise = toPaise(paidAmount);

  if (paidPaise > totalAmount) {
    return error("Paid amount cannot exceed purchase amount");
  }

  const supplierId = await getSupplier(db, data.supplier_name);

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
    purchaseDate,
    count,
    totalWeightGrams,
    totalAmount,
    paidPaise,
    paymentStatus(paidPaise, totalAmount),
    data.notes || null
  ).run();

  const purchaseId = purchase.meta.last_row_id;

  const statements = weights.map((weight, index) => {
    const goatCost = Math.round(
      (weight / totalWeightGrams) * totalAmount
    );

    return db.prepare(`
      INSERT INTO goat_purchase_lots (
        goat_purchase_id,
        goat_tag,
        live_weight_grams,
        purchase_cost_paise,
        slaughter_status,
        notes
      ) VALUES (?, ?, ?, ?, 'PENDING', ?)
    `).bind(
      purchaseId,
      `GOAT-${purchaseId}-${String(index + 1).padStart(3, "0")}`,
      weight,
      goatCost,
      null
    );
  });

  if (statements.length) {
    await db.batch(statements);
  }

  if (paidPaise > 0) {
    await db.prepare(`
      INSERT INTO payments (
        payment_type,
        reference_type,
        reference_id,
        payment_date,
        amount_paise,
        payment_method
      ) VALUES ('OUT', 'GOAT_PURCHASE', ?, ?, ?, ?)
    `).bind(
      purchaseId,
      purchaseDate,
      paidPaise,
      data.payment_method || "CASH"
    ).run();
  }

  const lots = await db.prepare(`
    SELECT id, goat_tag, live_weight_grams
    FROM goat_purchase_lots
    WHERE goat_purchase_id = ?
    ORDER BY id
  `).bind(purchaseId).all();

  return json({
    success: true,
    message: "Goat purchase and individual lots saved",
    purchaseId,
    goatCount: count,
    totalWeightGrams,
    totalAmountPaise: totalAmount,
    lots: lots.results
  }, 201);
}

/* =========================================
   MEAT PURCHASE
========================================= */

async function createMeatPurchase(db, data) {
  const purchaseDate = validDate(data.purchase_date);

  if (!purchaseDate) {
    return error("Invalid purchase date");
  }

  const weight = toGrams(data.weight_kg);
  const rate = number(data.rate_per_kg);
  const otherCost = number(data.other_cost);
  const paidAmount = number(data.paid_amount);

  if (weight <= 0 || rate <= 0 || otherCost < 0 || paidAmount < 0) {
    return error("Valid weight, rate and cost required");
  }

  const product = await getProduct(db, data.product_name);

  if (!product) {
    return error("Selected product not found", 404);
  }

  const supplierId = await getSupplier(db, data.supplier_name);

  const total = toPaise((weight / 1000) * rate + otherCost);
  const paid = toPaise(paidAmount);

  if (paid > total) {
    return error("Paid amount cannot exceed purchase amount");
  }

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
    purchaseDate,
    data.invoice_number || null,
    weight,
    total,
    paid,
    paymentStatus(paid, total),
    data.notes || null
  ).run();

  const purchaseId = purchase.meta.last_row_id;

  const statements = [
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
  ];

  if (paid > 0) {
    statements.push(db.prepare(`
      INSERT INTO payments (
        payment_type,
        reference_type,
        reference_id,
        payment_date,
        amount_paise,
        payment_method
      ) VALUES ('OUT', 'MEAT_PURCHASE', ?, ?, ?, ?)
    `).bind(
      purchaseId,
      purchaseDate,
      paid,
      data.payment_method || "CASH"
    ));
  }

  await db.batch(statements);

  return json({
    success: true,
    message: "Meat purchase saved and stock updated",
    purchaseId,
    totalAmountPaise: total,
    paidAmountPaise: paid
  }, 201);
}

/* =========================================
   SALES / BILLING
========================================= */

async function createSale(db, data) {
  if (!validText(data.product_name)) {
    return error("Select a product");
  }

  const saleDate = validDate(data.sale_date);

  if (!saleDate) {
    return error("Invalid sale date");
  }

  const weight = toGrams(data.weight_kg);
  const rate = number(data.rate_per_kg);
  const discount = toPaise(data.discount || 0);

  if (weight <= 0 || rate <= 0 || discount < 0) {
    return error("Valid weight and rate required");
  }

  const product = await getProduct(db, data.product_name);

  if (!product) {
    return error("Product not found", 404);
  }

  const stock = await db.prepare(`
    SELECT stock_quantity_grams
    FROM inventory_balance
    WHERE product_id = ?
  `).bind(product.id).first();

  if (!stock || number(stock.stock_quantity_grams) < weight) {
    return error("Insufficient stock", 409);
  }

  const customerId = await getCustomer(db, data.customer_name);

  const subtotal = toPaise((weight / 1000) * rate);
  const total = Math.max(0, subtotal - discount);

  let paid = total;

  if (String(data.payment_method || "").toUpperCase() === "CREDIT") {
    paid = 0;
  } else if (data.paid_amount !== undefined) {
    paid = toPaise(data.paid_amount);
  }

  if (paid < 0 || paid > total) {
    return error("Invalid paid amount");
  }

  const invoice = `NFS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

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
    saleDate,
    subtotal,
    discount,
    total,
    paid,
    paymentStatus(paid, total),
    data.notes || null
  ).run();

  const saleId = sale.meta.last_row_id;

  const statements = [
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
    )
  ];

  if (paid > 0) {
    statements.push(db.prepare(`
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
      saleDate,
      paid,
      data.payment_method || "CASH"
    ));
  }

  await db.batch(statements);

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
  const lotId = Math.floor(number(data.goat_lot_id));
  const slaughterDate = validDate(data.slaughter_date);

  const carcass = toGrams(data.carcass_weight_kg);
  const totalOutput = toGrams(data.total_output_weight_kg);
  const slaughterCost = toPaise(data.slaughter_cost || 0);

  if (!lotId || carcass <= 0 || !slaughterDate) {
    return error("Valid goat lot, date and carcass weight required");
  }

  if (slaughterCost < 0) {
    return error("Invalid slaughter cost");
  }

  const lot = await db.prepare(`
    SELECT id, live_weight_grams, slaughter_status
    FROM goat_purchase_lots
    WHERE id = ?
  `).bind(lotId).first();

  if (!lot) {
    return error("Goat lot not found", 404);
  }

  if (lot.slaughter_status === "COMPLETED") {
    return error("This goat lot is already slaughtered", 409);
  }

  if (carcass > lot.live_weight_grams) {
    return error("Carcass weight cannot exceed live weight");
  }

  const outputs = Array.isArray(data.outputs) ? data.outputs : [];

  if (outputs.length > 30) {
    return error("Too many output items");
  }

  const preparedOutputs = [];

  for (const item of outputs) {
    const product = await getProduct(db, item.product_name);
    const grams = toGrams(item.weight_kg);

    if (!product || grams <= 0) {
      return error("Every slaughter output needs a valid product and weight");
    }

    preparedOutputs.push({
      productId: product.id,
      productName: product.product_name,
      grams
    });
  }

  const outputSum = preparedOutputs.reduce(
    (sum, item) => sum + item.grams,
    0
  );

  if (totalOutput > 0 && outputSum > totalOutput) {
    return error("Output item weights exceed total output weight");
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
    slaughterDate,
    lot.live_weight_grams,
    carcass,
    totalOutput || outputSum || carcass,
    slaughterCost,
    data.notes || null
  ).run();

  const batchId = batch.meta.last_row_id;

  const statements = [
    db.prepare(`
      UPDATE goat_purchase_lots
      SET slaughter_status = 'COMPLETED',
          slaughter_date = ?
      WHERE id = ?
        AND slaughter_status != 'COMPLETED'
    `).bind(slaughterDate, lotId)
  ];

  for (const item of preparedOutputs) {
    statements.push(db.prepare(`
      INSERT INTO slaughter_output_items (
        slaughter_batch_id,
        product_id,
        quantity_grams
      ) VALUES (?, ?, ?)
    `).bind(
      batchId,
      item.productId,
      item.grams
    ));

    statements.push(db.prepare(`
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity_grams,
        reference_type,
        reference_id,
        notes
      ) VALUES (?, 'IN', ?, 'SLAUGHTER', ?, ?)
    `).bind(
      item.productId,
      item.grams,
      batchId,
      `Slaughter output from goat lot ${lotId}`
    ));
  }

  await db.batch(statements);

  return json({
    success: true,
    message: "Slaughter record saved and output stock updated",
    batchId,
    goatLotId: lotId,
    outputItems: preparedOutputs.length
  }, 201);
}

/* =========================================
   PAYMENT COLLECTION
========================================= */

async function collectPayment(db, data) {
  const type = String(data.payment_type || "").toUpperCase();
  const referenceType = String(data.reference_type || "").toUpperCase();
  const referenceId = Math.floor(number(data.reference_id));
  const paid = toPaise(data.amount);
  const paymentDate = validDate(data.payment_date);

  if (!["IN", "OUT"].includes(type)) {
    return error("Payment type must be IN or OUT");
  }

  if (!referenceId || paid <= 0 || !paymentDate) {
    return error("Valid reference, amount and date required");
  }

  const allowed = {
    SALE: {
      table: "sales",
      direction: "IN"
    },
    GOAT_PURCHASE: {
      table: "goat_purchases",
      direction: "OUT"
    },
    MEAT_PURCHASE: {
      table: "meat_purchases",
      direction: "OUT"
    }
  };

  const reference = allowed[referenceType];

  if (!reference || reference.direction !== type) {
    return error("Unsupported payment reference or payment direction");
  }

  const record = await db.prepare(`
    SELECT id, total_amount_paise, paid_amount_paise
    FROM ${reference.table}
    WHERE id = ?
  `).bind(referenceId).first();

  if (!record) {
    return error("Payment reference not found", 404);
  }

  const balance = number(record.total_amount_paise) -
    number(record.paid_amount_paise);

  if (paid > balance) {
    return error("Payment exceeds remaining balance");
  }

  const newPaid = number(record.paid_amount_paise) + paid;
  const status = paymentStatus(newPaid, number(record.total_amount_paise));

  await db.batch([
    db.prepare(`
      UPDATE ${reference.table}
      SET paid_amount_paise = ?,
          payment_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(newPaid, status, referenceId),

    db.prepare(`
      INSERT INTO payments (
        payment_type,
        reference_type,
        reference_id,
        payment_date,
        amount_paise,
        payment_method,
        transaction_reference,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      type,
      referenceType,
      referenceId,
      paymentDate,
      paid,
      data.payment_method || "CASH",
      data.transaction_reference || null,
      data.notes || null
    )
  ]);

  return json({
    success: true,
    message: "Payment saved",
    referenceType,
    referenceId,
    paidAmountPaise: newPaid,
    balancePaise: balance - paid,
    paymentStatus: status
  }, 201);
}

/* =========================================
   EXPENSES
========================================= */

async function createExpense(db, data) {
  if (!validText(data.expense_category)) {
    return error("Expense category required");
  }

  const expenseDate = validDate(data.expense_date);
  const amountPaise = toPaise(data.amount);

  if (!expenseDate || amountPaise <= 0) {
    return error("Valid expense date and amount required");
  }

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
    data.expense_category.trim(),
    data.description || null,
    expenseDate,
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
    SELECT *
    FROM daily_sales_summary
    ORDER BY sale_date DESC
    LIMIT 30
  `).all();

  const purchases = await db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total
    FROM (
      SELECT total_amount_paise AS total FROM goat_purchases
      UNION ALL
      SELECT total_amount_paise AS total FROM meat_purchases
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

  const expenses = await db.prepare(`
    SELECT COALESCE(SUM(amount_paise), 0) AS total
    FROM expenses
  `).first();

  return json({
    success: true,
    totalSalesPaise: sales?.total || 0,
    totalPurchasePaise: purchases?.total || 0,
    totalExpensesPaise: expenses?.total || 0,
    customerOutstandingPaise: credit?.total || 0,
    dailySales: daily.results
  });
}

/* =========================================
   MAIN ROUTER
========================================= */

export default {
  async fetch(request, env) {
    const headers = cors(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers
      });
    }

    if (!env.DB) {
      return error("D1 database binding DB is missing", 500, headers);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method;

    try {
      if (method === "GET" && path === "/") {
        return json({
          success: true,
          application: APP_NAME,
          version: VERSION,
          message: "API is online"
        }, 200, headers);
      }

      if (method === "GET" && path === "/health") {
        return await health(env.DB).then(response =>
          new Response(response.body, {
            status: response.status,
            headers: { ...Object.fromEntries(response.headers), ...headers }
          })
        );
      }

      if (method === "GET" && path === "/dashboard") {
        return await dashboard(env.DB).then(response =>
          new Response(response.body, {
            status: response.status,
            headers: { ...Object.fromEntries(response.headers), ...headers }
          })
        );
      }

      if (method === "GET" && path === "/products") {
        return await listProducts(env.DB).then(response =>
          new Response(response.body, {
            status: response.status,
            headers: { ...Object.fromEntries(response.headers), ...headers }
          })
        );
      }

      if (method === "POST" && path === "/products") {
        const data = await readBody(request);
        if (!data) return error("Invalid JSON body", 400, headers);
        const response = await createProduct(env.DB, data);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "GET" && path === "/suppliers") {
        const response = await listSuppliers(env.DB);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "POST" && path === "/suppliers") {
        const data = await readBody(request);
        if (!data) return error("Invalid JSON body", 400, headers);
        const response = await createSupplier(env.DB, data);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "GET" && path === "/customers") {
        const response = await listCustomers(env.DB);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "POST" && path === "/customers") {
        const data = await readBody(request);
        if (!data) return error("Invalid JSON body", 400, headers);
        const response = await createCustomer(env.DB, data);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "GET" && path === "/inventory") {
        const response = await inventory(env.DB);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "POST" && path === "/inventory") {
        const data = await readBody(request);
        if (!data) return error("Invalid JSON body", 400, headers);
        const response = await addStock(env.DB, data);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "GET" && path === "/goat-lots") {
        const response = await listGoatLots(env.DB);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "POST" && path === "/goat-purchases") {
        const data = await readBody(request);
        if (!data) return error("Invalid JSON body", 400, headers);
        const response = await createGoatPurchase(env.DB, data);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "POST" && path === "/meat-purchases") {
        const data = await readBody(request);
        if (!data) return error("Invalid JSON body", 400, headers);
        const response = await createMeatPurchase(env.DB, data);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "POST" && path === "/slaughter") {
        const data = await readBody(request);
        if (!data) return error("Invalid JSON body", 400, headers);
        const response = await createSlaughter(env.DB, data);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "POST" && path === "/sales") {
        const data = await readBody(request);
        if (!data) return error("Invalid JSON body", 400, headers);
        const response = await createSale(env.DB, data);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "POST" && path === "/payments") {
        const data = await readBody(request);
        if (!data) return error("Invalid JSON body", 400, headers);
        const response = await collectPayment(env.DB, data);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "POST" && path === "/expenses") {
        const data = await readBody(request);
        if (!data) return error("Invalid JSON body", 400, headers);
        const response = await createExpense(env.DB, data);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      if (method === "GET" && path === "/reports") {
        const response = await reports(env.DB);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...headers }
        });
      }

      return error("API endpoint not found", 404, headers);

    } catch (err) {
      console.error("Nagoor Freshmart API error:", err);

      return error(
        "Internal server error. Check Worker logs.",
        500,
        headers
      );
    }
  }
};
