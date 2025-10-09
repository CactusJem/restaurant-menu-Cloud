// cashier.js
// shows live orders where status == "pending"
// allows marking paid and deleting

import { db } from "../config/firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const ordersList = document.getElementById("orders-list");

function formatPrice(n){ return typeof n === "number" ? n.toLocaleString("id-ID") : n; }

function renderEmpty() {
  ordersList.innerHTML = `<div class="empty-menu">
    <div class="empty-icon">🧾</div>
    <h3>No pending orders</h3>
    <p>Waiting for waiters to submit orders.</p>
  </div>`;
}

function renderLoading() {
  ordersList.innerHTML = `<div class="loading">Loading orders...</div>`;
}

function createOrderCard(id, data) {
  const itemsHtml = (data.items || []).map(it => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #eee;">
      <div>${escapeHtml(it.name)} <small style="color:#666">x${it.quantity}</small></div>
      <div>Rp ${formatPrice((it.price||0)* (it.quantity||1))}</div>
    </div>
  `).join("");

  const total = data.total || (data.items||[]).reduce((s,it)=> s + (it.price||0)*(it.quantity||0), 0);

  return `
    <div class="category-card" style="padding:12px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700">${escapeHtml(data.name || "Unnamed")}</div>
          <div style="color:#666;font-size:0.9rem">Order ID: ${id}</div>
          <div style="color:#666;font-size:0.9rem">Submitted: ${data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toLocaleString() : ""}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">Rp ${formatPrice(total)}</div>
          <div style="margin-top:8px;">
            <select class="payment-select" data-id="${id}">
              <option value="Cash">Cash</option>
              <option value="QRIS">QRIS</option>
              <option value="Credit Card">Credit Card</option>
            </select>
          </div>
        </div>
      </div>

      <div style="margin-top:12px">${itemsHtml}</div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
        <button class="btn-primary mark-paid" data-id="${id}">Mark as Paid</button>
        <button class="btn-secondary delete-order" data-id="${id}">Delete Order</button>
      </div>
    </div>
  `;
}

function escapeHtml(s){ return String(s||"").replaceAll('"',"&quot;"); }

async function confirmMarkPaid(orderId, method) {
  if (!confirm("Mark this order as PAID?")) return;
  try {
    await updateDoc(doc(db, "orders", orderId), {
      status: "paid",
      paymentMethod: method,
      paidAt: new Date()
    });
    alert("Order marked as paid.");
  } catch (err) {
    console.error("Failed marking paid:", err);
    alert("Failed to mark paid.");
  }
}

async function confirmDelete(orderId) {
  if (!confirm("Delete this order permanently? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "orders", orderId));
    alert("Order deleted.");
  } catch (err) {
    console.error("Delete failed:", err);
    alert("Failed to delete order.");
  }
}

function listenOrders() {
  renderLoading();
  const q = query(collection(db, "orders"), where("status", "==", "pending"), orderBy("timestamp", "asc"));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      renderEmpty();
      return;
    }
    const html = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      html.push(createOrderCard(docSnap.id, data));
    });
    ordersList.innerHTML = html.join("");
    // attach listeners
    document.querySelectorAll(".mark-paid").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = btn.dataset.id;
        const sel = document.querySelector(`.payment-select[data-id="${id}"]`);
        const method = sel ? sel.value : "Cash";
        confirmMarkPaid(id, method);
      });
    });
    document.querySelectorAll(".delete-order").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = btn.dataset.id;
        confirmDelete(id);
      });
    });
  }, (err) => {
    console.error("Orders snapshot error:", err);
    ordersList.innerHTML = "<p>Failed to load orders.</p>";
  });
}

// start listening
listenOrders();
