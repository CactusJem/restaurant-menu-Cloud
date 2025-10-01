import { db } from "../config/firebase-config.js"
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"

// --- CART MANAGEMENT ---
const cart = {
  key: "resto-cart",
  getItems: () => JSON.parse(sessionStorage.getItem(cart.key)) || {},
  saveItems: (items) => sessionStorage.setItem(cart.key, JSON.stringify(items)),
  addItem: (categoryId, itemID) => {
    const items = cart.getItems();
    const itemKey = `${categoryId}_${itemID}`; // Create a unique key for each item type

    if (items[itemKey]) {
      items[itemKey].quantity += 1; // If item exists, increment quantity
    } else {
      items[itemKey] = { categoryId, itemID, quantity: 1 }; // Otherwise, add it
    }
    
    cart.saveItems(items);
    updateCartButton();
  },
}

function updateCartButton() {
  const btn = document.getElementById("cart-button")
  const countEl = document.getElementById("cart-count")
  if (!btn || !countEl) return

  const items = cart.getItems();
  // Count total number of items, not just unique items
  const totalCount = Object.values(items).reduce((sum, item) => sum + item.quantity, 0);

  if (totalCount > 0) {
    countEl.textContent = totalCount;
    btn.style.display = "flex"
  } else {
    btn.style.display = "none"
  }
}

// --- RENDERING & UI LOGIC ---
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
  card.className = "category-card collapsed"
  card.innerHTML = `
    <h2 class="category-title">${escapeHtml(catData.categoryName || catId)}</h2>
    <div class="menu-items">
      ${
        items.length === 0
          ? `<div class="empty-menu"><em>No items in this category</em></div>`
          : items.map((it) => {
              const isOutOfStock = it.stockStatus?.toLowerCase() === 'out of stock';
              const stockStatusClass = isOutOfStock ? 'out-of-stock' : 'in-stock';
              return `
              <div class="menu-item">
                <div class="item-info">
                  <span class="item-name">${escapeHtml(it.name)}</span>
                  <span class="item-status ${stockStatusClass}">${escapeHtml(it.stockStatus || "In Stock")}</span>
                </div>
                <div class="item-price-info">
                  <div class="item-price">Rp ${formatPrice(it.price)}</div>
                  <button 
                    class="pay-button" 
                    data-category-id="${catId}" 
                    data-item-id="${it.itemID}"
                    ${isOutOfStock ? 'disabled' : ''}
                  >+</button>
                </div>
              </div>
            `}).join("")
      }
    </div>
  `

  // --- EVENT LISTENERS ---
  const title = card.querySelector(".category-title")
  title.addEventListener("click", () => {
    const isCurrentlyCollapsed = card.classList.contains("collapsed")
    document.querySelectorAll(".category-card").forEach(c => {
        c.classList.add("collapsed");
        c.classList.remove("active");
    });
    if (isCurrentlyCollapsed) {
      card.classList.remove("collapsed");
      card.classList.add("active");
    }
  });

  card.querySelectorAll(".pay-button").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation()
      const { categoryId, itemId } = btn.dataset
      cart.addItem(categoryId, itemId)
    })
  })

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
      const card = renderCategoryCard(docSnap.id, docSnap.data() || {})
      root.appendChild(card)
    })
  } catch (err) {
    console.error("Public menu load error:", err)
    renderEmpty(root)
  }
}

// --- INITIALIZATION ---
function init() {
  loadPublicMenu()
  updateCartButton()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}

