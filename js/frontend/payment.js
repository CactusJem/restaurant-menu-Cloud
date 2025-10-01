import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js"
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js"
import { firebaseConfig } from "../config/firebase-config.js"

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// --- CART MANAGEMENT ---
const cart = {
  key: "resto-cart",
  getItems: () => JSON.parse(sessionStorage.getItem(cart.key)) || {},
  saveItems: (items) => sessionStorage.setItem(cart.key, JSON.stringify(items)),
  updateItemQuantity: (key, change) => {
    const items = cart.getItems();
    if (items[key]) {
      items[key].quantity += change;
      if (items[key].quantity <= 0) {
        delete items[key]; // Remove if quantity is 0 or less
      }
      cart.saveItems(items);
      loadAndRenderCart();
    }
  },
  clear: () => sessionStorage.removeItem(cart.key),
}

// --- HELPERS ---
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function formatPrice(n) {
  return n?.toLocaleString?.("id-ID") ?? n;
}

// --- DATA FETCHING ---
async function fetchItemDetails(categoryId, itemID) {
  try {
    const docRef = doc(db, "menu", categoryId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const items = docSnap.data().items || [];
      return items.find((it) => it.itemID === itemID) || null;
    }
    return null;
  } catch (error) {
    console.error("Error fetching item:", error);
    return null;
  }
}

// --- RENDERING LOGIC ---
function renderLoading() {
  document.getElementById("payment-root").innerHTML = `<div class="loading">Loading your cart...</div>`;
}

function renderEmptyCart() {
  document.getElementById("payment-root").innerHTML = `
    <div class="empty-menu">
      <h3>Your cart is empty</h3>
      <p>Select items from the menu to get started.</p>
      <div style="margin-top:12px">
        <a class="pay-button" href="index.html">Back to Menu</a>
      </div>
    </div>
  `;
}

function renderSummary(itemsWithDetails) {
    const root = document.getElementById("payment-root");
    const total = itemsWithDetails.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
    root.innerHTML = `
      <h2 class="category-title">Order Summary</h2>
      <div class="menu-items">
        ${itemsWithDetails.map((item) => `
            <div class="payment-item">
              <div class="item-info">
                <span class="item-name">${item.quantity}x ${escapeHtml(item.name)}</span>
              </div>
              <div class="item-price-info">
                <div class="item-price">Rp ${formatPrice(item.price * item.quantity)}</div>
                <div class="quantity-controls">
                  <button class="quantity-btn" data-key="${item.key}" data-change="-1">-</button>
                  <button class="quantity-btn" data-key="${item.key}" data-change="1">+</button>
                  <button class="remove-btn" data-key="${item.key}">Remove</button>
                </div>
              </div>
            </div>
          `).join("")}
      </div>
      <div class="total-price">
        <strong>Total:</strong> Rp ${formatPrice(total)}
      </div>
      <div class="payment-actions">
        <button class="pay-button" id="pay-now">Confirm Order</button>
        <a class="pay-button secondary" href="index.html">Back to Menu</a>
      </div>
      <div id="payment-status" class="item-description"></div>
    `;
  
    document.getElementById("pay-now").addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("payment-status").innerHTML = "Thank you! Your order is confirmed. Please complete payment at the counter.";
      cart.clear();
      e.target.disabled = true;
      document.querySelectorAll('.quantity-btn, .remove-btn').forEach(btn => btn.disabled = true);
    });
  
    document.querySelectorAll('.quantity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const change = parseInt(btn.dataset.change, 10);
        cart.updateItemQuantity(key, change);
      });
    });
  
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const items = cart.getItems();
        delete items[key]; // remove directly
        cart.saveItems(items);
        loadAndRenderCart();
      });
    });
}
  

// --- MAIN FUNCTION ---
async function loadAndRenderCart() {
  renderLoading();
  const cartItems = cart.getItems();

  if (Object.keys(cartItems).length === 0) {
    renderEmptyCart();
    return;
  }

  try {
    const detailedItemsPromises = Object.keys(cartItems).map(async (key) => {
      const cartItem = cartItems[key];
      const details = await fetchItemDetails(cartItem.categoryId, cartItem.itemID);
      return details ? { ...details, ...cartItem, key } : null;
    });

    const validItems = (await Promise.all(detailedItemsPromises)).filter(Boolean);

    if (validItems.length === 0) {
      renderEmptyCart();
    } else {
      renderSummary(validItems);
    }
  } catch (err) {
    console.error("Payment load error:", err);
    renderEmptyCart();
  }
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", loadAndRenderCart);

