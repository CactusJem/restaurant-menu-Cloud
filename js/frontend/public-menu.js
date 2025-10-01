import { db } from "../config/firebase-config.js"
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"

function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text ?? ""
  return div.innerHTML
}

function formatPrice(n) {
  return n?.toLocaleString?.("id-ID") ?? n
}

function renderEmpty(container) {
  container.innerHTML = `
    <div class="empty-menu">
      <h3>No menu available yet</h3>
      <p>Please check back later.</p>
    </div>
  `
}

function renderCategoryCard(catId, catData) {
  const items = Array.isArray(catData.items) ? catData.items : []

  const card = document.createElement("div")
  card.className = "category-card"
  card.innerHTML = `
    <div class="category-title">
      ${escapeHtml(catData.categoryName || catId)}
    </div>
    <div class="menu-items">
      ${
        items.length === 0
          ? `<div class="empty-menu"><em>No items in this category</em></div>`
          : items
              .map((it) => {
                const toPay = `payment.html?category=${encodeURIComponent(catId)}&item=${encodeURIComponent(it.itemID)}`
                return `
                  <div class="menu-item">
                    <div class="item-info">
                      <div>
                        <div class="item-name">${escapeHtml(it.name)}</div>
                        <div class="item-description">
                          ${escapeHtml(it.stockStatus || "In Stock")}
                        </div>
                      </div>
                    </div>
                    <div class="item-price-info">
                      <div class="item-price">Rp ${formatPrice(it.price)}</div>
                      <a class="pay-button" href="${toPay}">Select</a>
                    </div>
                  </div>
                `
              })
              .join("")
      }
    </div>
  `
  return card
}

async function loadPublicMenu() {
  const root = document.getElementById("menu")
  if (!root) return

  root.innerHTML = `<div class="loading">Loading our carefully curated menu...</div>`

  try {
    const q = query(collection(db, "menu"), orderBy("categoryName"))
    const snap = await getDocs(q)

    root.innerHTML = ""
    if (snap.empty) {
      renderEmpty(root)
      return
    }

    snap.forEach((docSnap) => {
      const catId = docSnap.id
      const data = docSnap.data() || {}
      const card = renderCategoryCard(catId, data)
      root.appendChild(card)
    })
  } catch (err) {
    console.error("[v0] public menu load error:", err)
    renderEmpty(root)
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadPublicMenu)
} else {
  loadPublicMenu()
}
