import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js"
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js"
import { firebaseConfig } from "../config/firebase-config.js"
import { staffStorage } from "./staff-tracking.js"

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
  getOrderDiscount: () => {
    const discount = sessionStorage.getItem("order-discount")
    return discount ? JSON.parse(discount) : { amount: 0, type: "fixed" }
  },
  setOrderDiscount: (amount, type) => {
    sessionStorage.setItem("order-discount", JSON.stringify({ amount, type }))
    loadAndRenderCart()
  },
  updateItemNotes: (key, notes) => {
    const items = cart.getItems()
    if (items[key]) {
      items[key].notes = notes
      cart.saveItems(items)
    }
  },
  clear: () => {
    sessionStorage.removeItem(cart.key)
    sessionStorage.removeItem("order-discount")
  },
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

function calculateDiscount(itemPrice, quantity, discount, discountType) {
  const totalPrice = itemPrice * quantity
  if (discountType === "percentage") {
    return (totalPrice * discount) / 100
  }
  return Math.min(discount, totalPrice)
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
        <a class="pay-button" href="menu.html">Back to Menu</a>
      </div>
    </div>
  `
}

function renderSummary(itemsWithDetails) {
  const root = document.getElementById("payment-root")
  const orderDiscount = cart.getOrderDiscount()

  const subtotal = itemsWithDetails.reduce((sum, item) => {
    const itemPrice = (item.price || 0) * item.quantity
    return sum + itemPrice
  }, 0)

  // Calculate order-level discount
  let discountAmount = 0
  if (orderDiscount.type === "percentage") {
    discountAmount = (subtotal * orderDiscount.amount) / 100
  } else {
    discountAmount = Math.min(orderDiscount.amount, subtotal)
  }

  const total = subtotal - discountAmount

  root.innerHTML = `
    <h2 class="category-title">Order Summary</h2>
    <div class="menu-items">
      ${itemsWithDetails
        .map((item) => {
          const itemPrice = (item.price || 0) * item.quantity
          return `
        <div class="payment-item">
          <div class="item-info">
            <span class="item-name">${item.quantity}x ${escapeHtml(item.name)}</span>
            <div style="margin-top: 8px;">
              <textarea 
                class="notes-input" 
                data-key="${item.key}" 
                placeholder="Special instructions (e.g., make it spicier)" 
                maxlength="200"
                style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85em; resize: vertical; min-height: 50px;"
              >${escapeHtml(item.notes || "")}</textarea>
            </div>
          </div>
          <div class="item-price-info">
            <div class="item-price">
              <div style="font-weight: bold;">Rp ${formatPrice(itemPrice)}</div>
            </div>
            <div class="quantity-controls">
              <button class="quantity-btn" data-key="${item.key}" data-change="-1">-</button>
              <button class="quantity-btn" data-key="${item.key}" data-change="1">+</button>
              <button class="remove-btn" data-key="${item.key}">Remove</button>
            </div>
          </div>
        </div>
      `
        })
        .join("")}
    </div>

    <div style="border-top: 2px solid #ddd; margin-top: 16px; padding-top: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 1.1em;">
        <strong>Subtotal:</strong>
        <span>Rp ${formatPrice(Math.floor(subtotal))}</span>
      </div>

      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 16px;">
        <label style="font-weight: 600; min-width: 100px;">Discount:</label>
        <input 
          type="number" 
          id="order-discount-input" 
          value="${orderDiscount.amount || 0}" 
          min="0" 
          style="width: 100px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"
        >
        <select id="order-discount-type" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
          <option value="fixed" ${orderDiscount.type === "fixed" ? "selected" : ""}>Rp</option>
          <option value="percentage" ${orderDiscount.type === "percentage" ? "selected" : ""}>%</option>
        </select>
      </div>

      ${
        discountAmount > 0
          ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px; color: #e74c3c; font-size: 0.95em;">
          <strong>Discount Amount:</strong>
          <span>${orderDiscount.type === "percentage" ? `-${orderDiscount.amount}%` : `-Rp ${formatPrice(Math.floor(discountAmount))}`}</span>
        </div>
      `
          : ""
      }
    </div>

    <div class="total-price">
      <strong>Total:</strong> Rp ${formatPrice(Math.floor(total))}
    </div>
    <div class="payment-actions">
      <button class="pay-button" id="pay-now">Confirm Order</button>
      <a class="pay-button secondary" href="menu.html">Back to Menu</a>
    </div>
    <div id="payment-status" class="item-description"></div>
  `

  document.getElementById("pay-now").addEventListener("click", async (e) => {
    e.preventDefault()

    const cartItems = cart.getItems()
    if (Object.keys(cartItems).length === 0) return

    const staff = staffStorage.get()
    if (!staff) {
      alert("Staff information missing. Please refresh and select your role.")
      return
    }

    const customerName = prompt("Enter customer name:") || "Customer"
    const finalOrderDiscount = cart.getOrderDiscount()

    const orderData = {
      customerName,
      staffName: staff.name,
      staffRole: staff.role,
      items: itemsWithDetails.map((item) => {
        return {
          ...item,
          notes: item.notes || "",
          itemTotal: (item.price || 0) * item.quantity,
        }
      }),
      discount: finalOrderDiscount.amount,
      discountType: finalOrderDiscount.type,
      status: "pending",
      timestamp: serverTimestamp(),
      subtotal: subtotal,
      total: total,
    }

    try {
      const orderId = await generateOrderId(db)
      await setDoc(doc(db, "orders", orderId), orderData)

      await setDoc(doc(db, "staff", staff.name, "orders", orderId), {
        orderId,
        customerName,
        total,
        timestamp: serverTimestamp(),
      })

      document.getElementById("payment-status").innerHTML = "Order submitted! Please proceed to cashier."
      cart.clear()
      e.target.disabled = true
    } catch (err) {
      console.error("Error saving order:", err)
      alert("Failed to save order to cashier.")
    }
  })

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

  document.getElementById("order-discount-input").addEventListener("change", () => {
    const amount = Number.parseFloat(document.getElementById("order-discount-input").value || 0)
    const type = document.getElementById("order-discount-type").value
    cart.setOrderDiscount(amount, type)
  })

  document.getElementById("order-discount-type").addEventListener("change", () => {
    const amount = Number.parseFloat(document.getElementById("order-discount-input").value || 0)
    const type = document.getElementById("order-discount-type").value
    cart.setOrderDiscount(amount, type)
  })

  document.querySelectorAll(".notes-input").forEach((textarea) => {
    textarea.addEventListener("blur", () => {
      const key = textarea.dataset.key
      const notes = textarea.value
      cart.updateItemNotes(key, notes)
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

async function generateOrderId(db) {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, "0")
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const year = String(now.getFullYear())
  const dateKey = `${day}${month}${year}`

  // Get today's order count from localStorage
  const countKey = `order-count-${dateKey}`
  const orderCount = Number.parseInt(localStorage.getItem(countKey) || "0") + 1
  localStorage.setItem(countKey, orderCount)

  const orderNumber = String(orderCount).padStart(2, "0")
  return `${dateKey}${orderNumber}`
}
