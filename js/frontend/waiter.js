// waiter.js
// loads menu from Firestore, lets waiter build an order and submit to "orders" collection

import { db } from "../config/firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const menuContainer = document.getElementById("waiter-menu");
const cartRoot = document.getElementById("order-cart");
const submitBtn = document.getElementById("submit-order");
const clearBtn = document.getElementById("clear-cart");
const customerNameInput = document.getElementById("customer-name");

let menuData = []; // loaded categories
let cart = {}; // key: itemID, value: { itemID, name, price, quantity, categoryId }

// helper
function formatPrice(n){ return typeof n === "number" ? n.toLocaleString("id-ID") : n; }

async function loadMenu() {
  menuContainer.innerHTML = "<div class='loading'>Loading menu...</div>";
  try {
    // read all docs from collection "menu" ordered by categoryName
    const q = query(collection(db, "menu"), orderBy("categoryName"));
    const snap = await getDocs(q);
    menuData = [];
    menuContainer.innerHTML = "";
    if (snap.empty) {
      menuContainer.innerHTML = "<p>No menu categories found</p>";
      return;
    }
    snap.forEach(docSnap => {
      const docId = docSnap.id;
      const data = docSnap.data();
      menuData.push({ id: docId, ...data });
      renderCategory(docId, data);
    });
  } catch (err) {
    console.error("Failed to load menu:", err);
    menuContainer.innerHTML = "<p>Failed to load menu</p>";
  }
}

function renderCategory(catId, cat) {
  const card = document.createElement("div");
  card.className = "category-card";
  card.innerHTML = `
    <h3 class="category-title">${escapeHtml(cat.categoryName || catId)}</h3>
    <div class="menu-items"></div>
  `;
  const itemsDiv = card.querySelector(".menu-items");
  const items = Array.isArray(cat.items) ? cat.items : [];
  if (items.length === 0) {
    itemsDiv.innerHTML = "<p class='empty-category'>No items</p>";
  } else {
    items.forEach(it => {
      const itemRow = document.createElement("div");
      itemRow.className = "menu-item";
      itemRow.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          ${it.imageUrl ? `<img src="${escapeHtml(it.imageUrl)}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;">` : ""}
          <div>
            <div class="item-name">${escapeHtml(it.name)}</div>
            <div class="item-desc">${it.price ? "Rp " + formatPrice(it.price) : ""}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="number" min="0" value="0" class="qty-input" data-itemid="${escapeHtml(it.itemID)}" style="width:70px;padding:6px;border-radius:6px;border:1px solid #ddd">
          <button class="btn-primary btn-add" data-itemid="${escapeHtml(it.itemID)}">Add</button>
        </div>
      `;
      itemsDiv.appendChild(itemRow);
    });
  }
  menuContainer.appendChild(card);
}

function escapeHtml(s){ return String(s||"").replaceAll('"',"&quot;"); }

function updateCartUI() {
  // build cart UI
  const keys = Object.keys(cart);
  if (keys.length === 0) {
    cartRoot.innerHTML = `<p class="empty-cart">No items yet</p>`;
    submitBtn.disabled = true;
    return;
  }
  submitBtn.disabled = false;
  const html = keys.map(k => {
    const it = cart[k];
    return `
      <div class="payment-item" data-key="${k}" style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;background:#fff;margin-bottom:8px;">
        <div>
          <div style="font-weight:600">${it.quantity}x ${escapeHtml(it.name)}</div>
          <div style="color:#666;font-size:0.9rem">Rp ${formatPrice(it.price)} each</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="qty-btn" data-op="dec" data-key="${k}">-</button>
          <button class="qty-btn" data-op="inc" data-key="${k}">+</button>
          <button class="remove-btn" data-key="${k}">Remove</button>
        </div>
      </div>
    `;
  }).join("");
  const total = keys.reduce((s,k)=> s + cart[k].price * cart[k].quantity, 0);
  cartRoot.innerHTML = html + `<div class="total-price"><strong>Total:</strong> Rp ${formatPrice(total)}</div>`;
}

function addToCart(itemID) {
  // find item in menuData
  for (const cat of menuData){
    const items = Array.isArray(cat.items) ? cat.items : [];
    const found = items.find(it => it.itemID === itemID);
    if (found) {
      if (!cart[itemID]) cart[itemID] = { itemID, name: found.name, price: found.price || 0, quantity: 0, categoryId: cat.id };
      cart[itemID].quantity += 1;
      updateCartUI();
      return;
    }
  }
}

function setQuantity(itemID, qty) {
  qty = Number(qty) || 0;
  if (!cart[itemID]) return;
  cart[itemID].quantity = qty;
  if (cart[itemID].quantity <= 0) delete cart[itemID];
  updateCartUI();
}

function removeFromCart(itemID) {
  delete cart[itemID];
  updateCartUI();
}

menuContainer.addEventListener("click", (e) => {
  if (e.target.matches(".btn-add")) {
    const id = e.target.dataset.itemid;
    addToCart(id);
  }
});

menuContainer.addEventListener("change", (e) => {
  if (e.target.matches(".qty-input")) {
    const id = e.target.dataset.itemid;
    const v = parseInt(e.target.value, 10) || 0;
    if (v > 0) {
      // if not in cart, add it
      // add up to v
      if (!cart[id]) {
        // find item
        for (const cat of menuData){
          const found = (cat.items||[]).find(it => it.itemID === id);
          if (found) { cart[id] = { itemID: id, name: found.name, price: found.price||0, quantity: 0, categoryId: cat.id }; break; }
        }
      }
      if (cart[id]) cart[id].quantity = v;
    } else {
      delete cart[id];
    }
    updateCartUI();
  }
});

cartRoot.addEventListener("click", (e) => {
  if (e.target.matches(".qty-btn")) {
    const key = e.target.dataset.key;
    const op = e.target.dataset.op;
    if (!cart[key]) return;
    if (op === "inc") cart[key].quantity += 1;
    else cart[key].quantity -= 1;
    if (cart[key].quantity <= 0) delete cart[key];
    updateCartUI();
  } else if (e.target.matches(".remove-btn")) {
    const key = e.target.dataset.key;
    removeFromCart(key);
  }
});

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear the current cart?")) return;
  cart = {};
  updateCartUI();
});

submitBtn.addEventListener("click", async () => {
  const customer = customerNameInput.value.trim();
  if (!customer) return alert("Please enter customer/table name.");
  const keys = Object.keys(cart);
  if (keys.length === 0) return alert("Cart is empty.");
  const items = keys.map(k => ({
    itemID: cart[k].itemID,
    name: cart[k].name,
    price: cart[k].price,
    quantity: cart[k].quantity
  }));
  const total = items.reduce((s,it) => s + (it.price||0) * (it.quantity||0), 0);

  try {
    await addDoc(collection(db, "orders"), {
      name: customer,
      items,
      total,
      status: "pending",
      timestamp: serverTimestamp()
    });
    alert("Order submitted to cashier.");
    // reset
    customerNameInput.value = "";
    cart = {};
    updateCartUI();
  } catch (err) {
    console.error("Error submitting order:", err);
    alert("Failed to submit order.");
  }
});

// init
loadMenu();
updateCartUI();
