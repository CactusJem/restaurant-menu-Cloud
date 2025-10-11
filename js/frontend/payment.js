import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js"
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js"
import { firebaseConfig } from "../config/firebase-config.js"

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// --- CART MANAGEMENT ---
const cart = {
  key: "resto-cart",
  getItems: () => JSON.parse(sessionStorage.getItem(cart.key)) || {},
  saveItems: (items) => sessionStorage.setItem(cart.key, JSON.stringify(items)),
  updateItemQuantity: (key, change) => {
    const items = cart.getItems()
    if (items[key]) {
      items[key].quantity += change
      if (items[key].quantity <= 0) delete items[key]
      cart.saveItems(items)
      loadAndRenderCart()
    }
  },
  clear: () => sessionStorage.removeItem(cart.key),
}

// --- HELPERS ---
function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text ?? ""
  return div.innerHTML
}

function formatPrice(n) {
  return n?.toLocaleString?.("id-ID") ?? n
}

function slugifyName(name) {
  const base = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return base || "order"
}

async function ensureUniqueOrderId(db, baseId) {
  let candidate = baseId
  let i = 0
  // Try base, then base1, base2, ...
  // Stop-gap upper bound to avoid infinite loops
  while (i < 10000) {
    const ref = doc(db, "orders", candidate)
    const snap = await getDoc(ref)
    if (!snap.exists()) return candidate
    i += 1
    candidate = `${baseId}${i}`
  }
  throw new Error("Too many duplicate order IDs")
}

// --- DATA FETCHING ---
async function fetchItemDetails(categoryId, itemID) {
  try {
    const docRef = doc(db, "menu", categoryId)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const items = docSnap.data().items || []
      return items.find((it) => it.itemID === itemID) || null
    }
    return null
  } catch (error) {
    console.error("Error fetching item:", error)
    return null
  }
}

// --- RENDERING LOGIC ---
function renderLoading() {
  document.getElementById("payment-root").innerHTML = `<div class="loading">Loading your cart...</div>`
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
  `
}

function renderSummary(itemsWithDetails) {
  const root = document.getElementById("payment-root")
  const total = itemsWithDetails.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)

  root.innerHTML = `
    <h2 class="category-title">Order Summary</h2>
    <div class="menu-items">
      ${itemsWithDetails
        .map(
          (item) => `
        <div class="payment-item">
          <div class="item-info">
            <span class="item-name">${item.quantity}x ${escapeHtml(item.name)}</span>
          </div>
          <div class="item-price-info">
            <div class="item-price">Rp ${formatPrice((item.price || 0) * item.quantity)}</div>
            <div class="quantity-controls">
              <button class="quantity-btn" data-key="${item.key}" data-change="-1">-</button>
              <button class="quantity-btn" data-key="${item.key}" data-change="1">+</button>
              <button class="remove-btn" data-key="${item.key}">Remove</button>
            </div>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
    <div class="total-price">
      <strong>Total:</strong> Rp ${formatPrice(total)}
    </div>
    <div class="payment-actions">
      <button class="pay-button" id="pay-now">Confirm Order</button>
      <a class="pay-button secondary" href="index.html">Back to Menu</a>
    </div>
    <div id="payment-status" class="item-description"></div>
  `

  // --- Confirm Order Button ---
  document.getElementById("pay-now").addEventListener("click", async (e) => {
    e.preventDefault()

    const cartItems = cart.getItems()
    if (Object.keys(cartItems).length === 0) return

    const name = prompt("Enter customer name:") || "Customer"

    const orderData = {
      name,
      items: itemsWithDetails,
      status: "pending",
      timestamp: serverTimestamp(),
      total: total,
    }

    try {
      const baseId = slugifyName(name)
      const orderId = await ensureUniqueOrderId(db, baseId)
      await setDoc(doc(db, "orders", orderId), orderData)

      document.getElementById("payment-status").innerHTML = "Order submitted! Please proceed to cashier."
      cart.clear()
      e.target.disabled = true
    } catch (err) {
      console.error("Error saving order:", err)
      alert("Failed to save order to cashier.")
    }
  })

  // --- Quantity Controls ---
  document.querySelectorAll(".quantity-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key
      const change = Number.parseInt(btn.dataset.change, 10)
      cart.updateItemQuantity(key, change)
    })
  })

  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key
      const items = cart.getItems()
      delete items[key]
      cart.saveItems(items)
      loadAndRenderCart()
    })
  })
}

// --- MAIN FUNCTION ---
async function loadAndRenderCart() {
  renderLoading()
  const cartItems = cart.getItems()

  if (Object.keys(cartItems).length === 0) {
    renderEmptyCart()
    return
  }

  try {
    const detailedItemsPromises = Object.keys(cartItems).map(async (key) => {
      const cartItem = cartItems[key]
      const details = await fetchItemDetails(cartItem.categoryId, cartItem.itemID)
      if (details) {
        return {
          ...cartItem,
          key,
          name: details.name || cartItem.name || "Unknown",
          price: details.price || cartItem.price || 0,
        }
      }
      return null
    })

    const validItems = (await Promise.all(detailedItemsPromises)).filter(Boolean)

    if (validItems.length === 0) {
      renderEmptyCart()
    } else {
      renderSummary(validItems)
    }
  } catch (err) {
    console.error("Payment load error:", err)
    renderEmptyCart()
  }
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", loadAndRenderCart)
