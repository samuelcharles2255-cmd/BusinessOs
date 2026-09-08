/**
 * Biashara OS — Sale Return Controller
 * Calculates refund subtotal, applies discount/fee deductions, and verifies remaining eligible units.
 */

(function () {
  const form = document.getElementById("sale-return-form");
  const returnRows = document.querySelectorAll(".return-item-row");
  const discountInput = document.getElementById("id_discount");
  const subtotalEl = document.getElementById("return-subtotal");
  const refundTotalEl = document.getElementById("net-refund-total");
  const submitBtn = document.getElementById("submit-return");

  if (!form) return;

  function recalculate() {
    let subtotal = 0;
    returnRows.forEach((row) => {
      const qtyInput = row.querySelector(".return-qty-input");
      const unitPrice = parseFloat(row.dataset.price || "0") || 0;
      const maxQty = parseInt(row.dataset.max || "0", 10) || 0;
      let qty = parseInt(qtyInput ? qtyInput.value : "0", 10) || 0;

      if (qty < 0) {
        qty = 0;
        qtyInput.value = "0";
      }
      if (qty > maxQty) {
        qty = maxQty;
        qtyInput.value = String(maxQty);
      }

      const rowTotal = qty * unitPrice;
      const rowSubtotalCell = row.querySelector(".row-subtotal");
      if (rowSubtotalCell) {
        rowSubtotalCell.textContent = rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      subtotal += rowTotal;
    });

    const discount = parseFloat(discountInput ? discountInput.value : "0") || 0;
    const netRefund = Math.max(0, subtotal - discount);

    if (subtotalEl) {
      subtotalEl.textContent = subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (refundTotalEl) {
      refundTotalEl.textContent = netRefund.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  returnRows.forEach((row) => {
    const qtyInput = row.querySelector(".return-qty-input");
    if (qtyInput) {
      qtyInput.addEventListener("input", recalculate);
    }
  });

  if (discountInput) {
    discountInput.addEventListener("input", recalculate);
  }

  recalculate();

  form.addEventListener("submit", (e) => {
    let totalUnits = 0;
    returnRows.forEach((row) => {
      const qtyInput = row.querySelector(".return-qty-input");
      totalUnits += parseInt(qtyInput ? qtyInput.value : "0", 10) || 0;
    });

    if (totalUnits === 0) {
      e.preventDefault();
      alert("Please enter a return quantity for at least one item.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Processing return…";
    }
  });
})();

