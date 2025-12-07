import { auth, db } from "../config/firebase-config.js"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js"

const ordersList = document.getElementById("orders-list")
const loadingState = document.getElementById("loading-state")
const ordersContent = document.getElementById("orders-content")

let currentDiscount = { type: "percentage", value: 0 }
let currentCustomerID = null

function formatPrice(n) {
  return typeof n === "number" ? n.toLocaleString("id-ID") : n
}

window.generateCustomerID = () => {
  const nameInput = document.getElementById("customer-name").value.trim()
  if (!nameInput) {
    alert("Please enter customer name")
    return
  }

  const now = new Date()
  const day = String(now.getDate()).padStart(2, "0")
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const year = String(now.getFullYear()).slice(-2)

  const dateStr = `${day}${month}${year}`
  const orderCountKey = `order-count-${dateStr}`
  const currentCount = Number.parseInt(localStorage.getItem(orderCountKey) || "0") + 1
  localStorage.setItem(orderCountKey, currentCount)

  currentCustomerID = `${currentCount}${dateStr}`

  const displayDiv = document.getElementById("customer-id-display")
  const displaySpan = document.getElementById("customer-id-value")
  displaySpan.textContent = currentCustomerID
  displayDiv.style.display = "block"
}

window.applyDiscount = () => {
  const value = document.getElementById("discount-value").value
  const type = document.getElementById("discount-type").value

  if (!value || value <= 0) {
    alert("Please enter a valid discount value")
    return
  }

  currentDiscount = { type, value: Number.parseFloat(value) }

  const previewDiv = document.getElementById("discount-preview")
  const previewText = document.getElementById("discount-text")

  if (type === "percentage") {
    previewText.textContent = `${value}% off`
  } else {
    previewText.textContent = `Rp ${formatPrice(value)} off`
  }
  previewDiv.style.display = "block"
  updateOrderTotal()
}

function updateOrderTotal() {
  const subtotalEl = document.getElementById("subtotal")
  const discountAmountEl = document.getElementById("discount-amount")
  const grandTotalEl = document.getElementById("grand-total")
  const discountRowEl = document.getElementById("discount-row")
  const orderTotalSectionEl = document.getElementById("order-total-section")

  // Skip if elements aren't ready
  if (!subtotalEl || !discountAmountEl || !grandTotalEl) return

  const subtotal = Array.from(document.querySelectorAll("[data-order-total]")).reduce(
    (sum, el) => sum + Number.parseFloat(el.dataset.orderTotal || 0),
    0,
  )

  let discountAmount = 0
  if (currentDiscount.type === "percentage") {
    discountAmount = (subtotal * currentDiscount.value) / 100
  } else {
    discountAmount = currentDiscount.value
  }

  const grandTotal = subtotal - discountAmount

  subtotalEl.textContent = formatPrice(Math.floor(subtotal))
  discountAmountEl.textContent = formatPrice(Math.floor(discountAmount))
  grandTotalEl.textContent = formatPrice(Math.floor(grandTotal))

  if (discountAmount > 0 && discountRowEl) {
    discountRowEl.style.display = "flex"
  }

  if (subtotal > 0 && orderTotalSectionEl) {
    orderTotalSectionEl.style.display = "block"
  }
}

function renderEmpty() {
  ordersList.innerHTML = `<div class="empty-menu">
    <div class="empty-icon">🧾</div>
    <h3>No pending orders</h3>
    <p>Waiting for waiters to submit orders.</p>
  </div>`
}

function renderLoading() {
  ordersList.innerHTML = `<div class="loading">Loading orders...</div>`
}

function createOrderCard(id, data) {
  const itemsHtml = (data.items || [])
    .map((it) => {
      let discountDisplay = ""
      if (it.discount && it.discount > 0) {
        if (it.discountType === "percentage") {
          const discountAmount = ((it.price || 0) * it.quantity * it.discount) / 100
          discountDisplay = `<div style="color:#e74c3c;font-size:0.85rem;">Discount: ${it.discount}% (-Rp ${formatPrice(Math.floor(discountAmount))})</div>`
        } else {
          discountDisplay = `<div style="color:#e74c3c;font-size:0.85rem;">Discount: -Rp ${formatPrice(it.discount)}</div>`
        }
      }
      return `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #eee;">
          <div>
            <div>${escapeHtml(it.name)} <small style="color:#666">x${it.quantity}</small></div>
            ${it.notes ? `<small style="color:#3498db;font-style:italic;">📝 ${escapeHtml(it.notes)}</small>` : ""}
            ${discountDisplay}
          </div>
          <div style="text-align:right;">
            <div>Rp ${formatPrice((it.price || 0) * (it.quantity || 1))}</div>
            ${it.discount ? `<div style="color:#27ae60;font-weight:600;">Rp ${formatPrice(it.itemTotal || 0)}</div>` : ""}
          </div>
        </div>
      `
    })
    .join("")

  const total =
    data.total || (data.items || []).reduce((s, it) => s + (it.itemTotal || (it.price || 0) * (it.quantity || 0)), 0)

  return `
    <div class="category-card" style="padding:12px;margin-bottom:12px;" data-order-total="${total}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-weight:700">${escapeHtml(data.customerName || "Unnamed")}</div>
          <div style="color:#666;font-size:0.9rem">Order ID: ${id}</div>
          <div style="color:#666;font-size:0.85rem;">📋 Staff: ${escapeHtml(data.staffName || "Unknown")} (${escapeHtml(data.staffRole || "Unknown")})</div>
          <div style="color:#666;font-size:0.9rem">Submitted: ${data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toLocaleString() : ""}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:1.1rem">Rp ${formatPrice(Math.floor(total))}</div>
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
        <button class="btn-secondary delete-order" data-id="${id}">Cancel Order</button>
      </div>
    </div>
  `
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

async function confirmMarkPaid(orderId, method) {
  if (!confirm("Mark this order as PAID?")) return
  try {
    console.log("[v0] Attempting to mark order as paid:", orderId)

    const paymentData = {
      status: "paid",
      paymentMethod: method,
      paidAt: new Date(),
    }

    if (currentCustomerID) {
      paymentData.customerID = currentCustomerID
    }

    const docRef = doc(db, "orders", orderId)
    console.log("[v0] Document reference created for:", orderId)

    await updateDoc(docRef, paymentData)
    console.log("[v0] Order successfully marked as paid:", orderId)
    alert("Order marked as paid.")

    currentDiscount = { type: "percentage", value: 0 }
    if (document.getElementById("discount-preview")) {
      document.getElementById("discount-preview").style.display = "none"
    }
    if (document.getElementById("discount-value")) {
      document.getElementById("discount-value").value = ""
    }
    if (document.getElementById("customer-name")) {
      document.getElementById("customer-name").value = ""
    }
    if (document.getElementById("customer-id-display")) {
      document.getElementById("customer-id-display").style.display = "none"
    }
  } catch (err) {
    console.error("[v0] Error marking paid - Details:", {
      error: err.message,
      code: err.code,
      orderId: orderId,
    })
    alert("Failed to mark paid. Check console for details.")
  }
}

async function confirmDelete(orderId) {
  if (!confirm("Cancel this order? It will be removed permanently.")) return
  try {
    console.log("[v0] Attempting to delete order:", orderId)
    await deleteDoc(doc(db, "orders", orderId))
    console.log("[v0] Order successfully deleted:", orderId)
    alert("Order canceled.")
  } catch (err) {
    console.error("[v0] Error deleting order:", err.message)
    alert("Failed to cancel order.")
  }
}

function attachButtonListeners() {
  if (attachButtonListeners.attached) return
  attachButtonListeners.attached = true

  ordersList.addEventListener("click", (e) => {
    if (e.target.classList.contains("mark-paid")) {
      const id = e.target.dataset.id
      const sel = document.querySelector(`.payment-select[data-id="${id}"]`)
      const method = sel ? sel.value : "Cash"
      confirmMarkPaid(id, method)
    }

    if (e.target.classList.contains("delete-order")) {
      const id = e.target.dataset.id
      confirmDelete(id)
    }
  })
}

function listenOrders() {
  renderLoading()
  const q = query(collection(db, "orders"), where("status", "==", "pending"), orderBy("timestamp", "asc"))
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        renderEmpty()
        return
      }
      const html = []
      snapshot.forEach((docSnap) => {
        const data = docSnap.data()
        html.push(createOrderCard(docSnap.id, data))
      })
      ordersList.innerHTML = html.join("")
      updateOrderTotal()
    },
    (err) => {
      console.error("Orders snapshot error:", err)
      ordersList.innerHTML = "<p>Failed to load orders.</p>"
    },
  )
}

// ==========================
//  AUTO AUTH CHECK FOR CASHIER
// ==========================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("No user detected → redirect to login")
    loadingState.innerHTML = '<p style="color: var(--color-danger);">Access denied. Redirecting to login...</p>'
    setTimeout(() => {
      window.location.href = "index.html"
    }, 1500)
    return
  }

  // READ ROLE FROM FIRESTORE
  const staffRef = collection(db, "users")
  const snapshot = await getDocs(staffRef)

  let userRole = null
  snapshot.forEach((doc) => {
    const data = doc.data()
    if (data.email === user.email) {
      userRole = data.role
    }
  })

  // NOT CASHIER → KICK OUT
  if (userRole !== "cashier") {
    loadingState.innerHTML = '<p style="color: var(--color-danger);">Access denied. You are not a cashier.</p>'
    setTimeout(() => {
      signOut(auth)
      window.location.href = "index.html"
    }, 1500)
    return
  }

  // User is authenticated cashier → show orders
  const userInfo = document.getElementById("userInfo")
  if (userInfo) {
    userInfo.textContent = `Logged in as: ${user.email}`
  }

  loadingState.style.display = "none"
  ordersContent.style.display = "block"

  attachButtonListeners()
  listenOrders()
})

// ==========================
//  LOGOUT
// ==========================
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth)
  window.location.href = "index.html"
})
