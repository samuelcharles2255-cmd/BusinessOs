/**
 * Biashara OS — Inbound Purchase Controller
 * Multi-row purchase receiving with dynamic cost calculations and supplier debt tracking.
 */

(function () {
  const body = document.getElementById("purchase-items-body");
  const rowTemplate = document.getElementById("purchase-row-template");
  const addRowBtn = document.getElementById("add-purchase-row");
  const totalEl = document.getElementById("purchase-total");
  const balanceRow = document.getElementById("purchase-balance-row");
  const balanceEl = document.getElementById("purchase-balance");
  const amountInput = document.getElementById("id_amount_paid");
  const form = document.getElementById("purchase-form");
  const submitBtn = document.getElementById("submit-purchase");

  if (!form || !rowTemplate || !body) return;

  function addRow() {
    const clone = rowTemplate.content.cloneNode(true);
    body.appendChild(clone);
    const newRow = body.lastElementChild;
    wireRow(newRow);
    recalculate();
  }

  function wireRow(row) {
    const select = row.querySelector(".product-select");
    const qty = row.querySelector(".qty-input");
    const cost = row.querySelector(".cost-input");
    const removeBtn = row.querySelector(".btn-remove-row");

    if (select) {
      select.addEventListener("change", () => {
        const opt = select.options[select.selectedIndex];
        if (opt && opt.dataset.cost && (!cost.value || parseFloat(cost.value) === 0)) {
          cost.value = opt.dataset.cost;
        }
        updateRow(row);
      });
    }
    if (qty) qty.addEventListener("input", () => updateRow(row));
    if (cost) cost.addEventListener("input", () => updateRow(row));
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
    const qtyInput = row.querySelector(".qty-input");
    const costInput = row.querySelector(".cost-input");
    const subtotalCell = row.querySelector(".row-subtotal");

    const qty = parseInt(qtyInput ? qtyInput.value : "0", 10) || 0;
    const cost = parseFloat(costInput ? costInput.value : "0") || 0;
    const subtotal = qty * cost;

    if (subtotalCell) {
      subtotalCell.textContent = subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    row.dataset.rawSubtotal = String(subtotal);

    recalculate();
  }

  function recalculate() {
    let total = 0;
    body.querySelectorAll(".purchase-row").forEach((row) => {
      total += parseFloat(row.dataset.rawSubtotal || "0") || 0;
    });

    if (totalEl) totalEl.textContent = total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const paid = parseFloat(amountInput ? amountInput.value : "0") || 0;
    const balance = total - paid;
    const hasBalance = balance > 0;

    if (balanceRow) {
      balanceRow.hidden = !hasBalance;
    }
    if (balanceEl) {
      balanceEl.textContent = hasBalance ? balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
    }
  }

  // Quick Pay Full Bill
  const payExactBtn = document.getElementById("pay-full-purchase-btn");
  if (payExactBtn) {
    payExactBtn.addEventListener("click", () => {
      let total = 0;
      body.querySelectorAll(".purchase-row").forEach((row) => {
        total += parseFloat(row.dataset.rawSubtotal || "0") || 0;
      });
      if (amountInput) {
        amountInput.value = total.toFixed(2);
        recalculate();
      }
    });
  }

  if (addRowBtn) addRowBtn.addEventListener("click", addRow);
  if (amountInput) amountInput.addEventListener("input", recalculate);

  // Initialize with at least 1 row
  if (body.children.length === 0) {
    addRow();
  } else {
    body.querySelectorAll(".purchase-row").forEach(wireRow);
    recalculate();
  }

  form.addEventListener("submit", (e) => {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving purchase…";
    }
  });
})();

