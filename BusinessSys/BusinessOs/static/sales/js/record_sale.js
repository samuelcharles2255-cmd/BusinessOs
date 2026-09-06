/**
 * Biashara OS — POS Record Sale Interactive Controller
 * Keeps calculations strictly in sync with views.record_sale():
 *   has_balance = amount_received < total
 * Enforces stock bounds and automatically reveals customer debt fields.
 */

(function () {
  const body = document.getElementById("line-items-body");
  const rowTemplate = document.getElementById("row-template");
  const addRowBtn = document.getElementById("add-row");
  const totalEl = document.getElementById("sale-total");
  const balanceRow = document.getElementById("balance-row");
  const balanceEl = document.getElementById("sale-balance");
  const amountInput = document.getElementById("id_amount_received");
  const customerFields = document.getElementById("customer-fields");
  const customerNameInput = document.getElementById("id_customer_name");
  const customerPhoneInput = document.getElementById("id_customer_phone");
  const form = document.getElementById("sale-form");
  const submitBtn = document.getElementById("submit-sale");

  if (!form || !rowTemplate || !body) return;

  function addRow() {
    const clone = rowTemplate.content.cloneNode(true);
    body.appendChild(clone);
    const newRow = body.lastElementChild;
    wireRow(newRow);
    recalculate();
    // Focus the new product select
    const select = newRow.querySelector(".product-select");
    if (select) select.focus();
  }

  function wireRow(row) {
    const select = row.querySelector(".product-select");
    const qty = row.querySelector(".qty-input");
    const removeBtn = row.querySelector(".btn-remove-row");

    if (select) select.addEventListener("change", () => updateRow(row));
    if (qty) qty.addEventListener("input", () => updateRow(row));
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        row.remove();
        recalculate();
        if (body.children.length === 0) {
          addRow();
        }
      });
    }
  }

  function updateRow(row) {
    const select = row.querySelector(".product-select");
    const qtyInput = row.querySelector(".qty-input");
    const unitPriceCell = row.querySelector(".unit-price");
    const subtotalCell = row.querySelector(".row-subtotal");
    const stockWarn = row.querySelector(".stock-warn");
    const option = select ? select.options[select.selectedIndex] : null;

    const price = option && option.dataset.price ? parseFloat(option.dataset.price) : 0;
    const stock = option && option.dataset.stock !== undefined ? parseInt(option.dataset.stock, 10) : null;

    if (stock !== null && !Number.isNaN(stock)) {
      qtyInput.max = String(stock);
      const currentQty = parseInt(qtyInput.value || "0", 10);
      if (currentQty > stock) {
        qtyInput.value = String(Math.max(stock, 1));
        if (stockWarn) stockWarn.textContent = `Max available: ${stock}`;
      } else {
        if (stockWarn) stockWarn.textContent = "";
      }
    }

    const qty = parseInt(qtyInput.value || "0", 10) || 0;
    const subtotal = price * qty;

    if (unitPriceCell) unitPriceCell.textContent = price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (subtotalCell) subtotalCell.textContent = subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    row.dataset.rawSubtotal = String(subtotal);

    recalculate();
  }

  function recalculate() {
    let total = 0;
    body.querySelectorAll(".line-item-row").forEach((row) => {
      total += parseFloat(row.dataset.rawSubtotal || "0") || 0;
    });

    if (totalEl) totalEl.textContent = total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const received = parseFloat(amountInput.value || "0") || 0;
    const balance = total - received;
    const hasBalance = balance > 0;

    if (balanceRow) {
      balanceRow.hidden = !hasBalance;
    }
    if (balanceEl) {
      balanceEl.textContent = hasBalance ? balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
    }

    if (customerFields) {
      customerFields.hidden = !hasBalance;
    }
    if (customerNameInput) {
      customerNameInput.required = hasBalance;
    }
    if (customerPhoneInput) {
      customerPhoneInput.required = hasBalance;
    }
  }

  // Quick Amount Buttons (e.g. "Full Payment", "0 Amount")
  const payExactBtn = document.getElementById("pay-exact-btn");
  if (payExactBtn) {
    payExactBtn.addEventListener("click", () => {
      let total = 0;
      body.querySelectorAll(".line-item-row").forEach((row) => {
        total += parseFloat(row.dataset.rawSubtotal || "0") || 0;
      });
      amountInput.value = total.toFixed(2);
      recalculate();
    });
  }

  if (addRowBtn) addRowBtn.addEventListener("click", addRow);
  if (amountInput) amountInput.addEventListener("input", recalculate);

  // Initialize with one row if table is empty
  if (body.children.length === 0) {
    addRow();
  } else {
    body.querySelectorAll(".line-item-row").forEach(wireRow);
    recalculate();
  }

  // Prevent duplicate submit
  form.addEventListener("submit", (e) => {
    const rows = body.querySelectorAll(".line-item-row");
    let hasValidItem = false;
    rows.forEach((r) => {
      const sel = r.querySelector(".product-select");
      if (sel && sel.value) hasValidItem = true;
    });

    if (!hasValidItem) {
      e.preventDefault();
      alert("Please select at least one product for this sale.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Recording sale…";
    }
  });
})();
