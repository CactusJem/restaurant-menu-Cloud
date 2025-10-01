import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js"
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js"
import { firebaseConfig } from "../config/firebase-config.js"

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

function qs(id) {
  return new URLSearchParams(window.location.search).get(id)
}

function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text ?? ""
  return div.innerHTML
}

function formatPrice(n) {
  return n?.toLocaleString?.("id-ID") ?? n
}

async function findItem(categoryId, itemID) {
  if (categoryId) {
    const snap = await getDoc(doc(db, "menu", categoryId))
    if (snap.exists()) {
      const data = snap.data()
      const items = Array.isArray(data.items) ? data.items : []
      const item = items.find((i) => i.itemID === itemID)
      if (item) return { categoryId, categoryName: data.categoryName || categoryId, item }
    }
    return null
  }

  // Fallback: search all categories by itemID
  const snapAll = await getDocs(collection(db, "menu"))
  for (const d of snapAll.docs) {
    const data = d.data()
    const items = Array.isArray(data.items) ? data.items : []
    const item = items.find((i) => i.itemID === itemID)
    if (item) return { categoryId: d.id, categoryName: data.categoryName || d.id, item }
  }
  return null
}

function renderLoading() {
  document.getElementById("payment-root").innerHTML = `
    <div class="loading">Loading selection...</div>
  `
}

function renderNotFound() {
  document.getElementById("payment-root").innerHTML = `
    <div class="empty-menu">
      <h3>Item not found</h3>
      <p>Please go back and pick an item.</p>
      <div style="margin-top:12px">
        <a class="pay-button" href="index.html">Back to Menu</a>
      </div>
    </div>
  `
}

function renderSummary(ctx) {
  const { categoryName, item } = ctx
  const root = document.getElementById("payment-root")
  root.innerHTML = `
    <div style="display:flex; flex-direction:column; gap: var(--spacing-md);">
      <div>
        <div class="item-name" style="margin:0;">${escapeHtml(item.name)}</div>
        <div class="item-description" style="margin-top:4px;">Category: ${escapeHtml(categoryName)}</div>
      </div>

      <div class="item-price" style="margin:0;">Total: Rp ${formatPrice(item.price)}</div>

      <div style="display:flex; gap: var(--spacing-sm); flex-wrap:wrap;">
        <a class="pay-button" id="pay-now" href="#">Proceed to Payment</a>
        <a class="pay-button" style="background-color: var(--color-secondary);" href="index.html">Back to Menu</a>
      </div>

      <div id="payment-status" class="item-description"></div>
    </div>
  `

  const payBtn = document.getElementById("pay-now")
  const status = document.getElementById("payment-status")
  payBtn.addEventListener("click", (e) => {
    e.preventDefault()
    status.innerHTML = "Thank you! Your order has been recorded. Please complete payment at the counter."
  })
}

document.addEventListener("DOMContentLoaded", async () => {
  renderLoading()
  const categoryId = qs("category")
  const itemID = qs("item")

  if (!itemID) {
    renderNotFound()
    return
  }

  try {
    const ctx = await findItem(categoryId, itemID)
    if (!ctx) return renderNotFound()
    renderSummary(ctx)
  } catch (err) {
    console.error("[v0] payment load error:", err)
    renderNotFound()
  }
})
