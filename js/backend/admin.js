import { auth, db } from "../config/firebase-config.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js"

import {
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  query,
  orderBy,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"

// ==========================
//  GLOBAL STATE
// ==========================
let currentEditingDish = null
let currentEditingCategory = null
let deletingCategoryId = null
let allCategories = []

// ==========================
//  AUTO AUTH CHECK
// ==========================
onAuthStateChanged(auth, async (user) => {
  const loadingState = document.getElementById("loading-state")
  const dashboard = document.getElementById("dashboard")

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
  snapshot.forEach((docSnap) => {
    const data = docSnap.data()
    if (data.email === user.email) {
      userRole = data.role
    }
  })

  // NOT ADMIN → KICK OUT
  if (userRole !== "admin") {
    loadingState.innerHTML = '<p style="color: var(--color-danger);">Access denied. You are not an admin.</p>'
    setTimeout(() => {
      signOut(auth)
      window.location.href = "index.html"
    }, 1500)
    return
  }

  // User is authenticated admin → show dashboard
  const userInfo = document.getElementById("userInfo")
  if (userInfo) {
    userInfo.textContent = `Logged in as: ${user.email}`
  }

  loadingState.style.display = "none"
  dashboard.style.display = "block"

  await loadCategories()
  await loadMenuItems()
})

// ==========================
//  LOGOUT
// ==========================
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth)
  window.location.href = "index.html"
})

// ==========================
//  LOAD CATEGORIES
// ==========================
async function loadCategories() {
  const q = query(collection(db, "menu"), orderBy("categoryName"))
  const snap = await getDocs(q)
  allCategories = []

  snap.forEach((doc) => {
    allCategories.push({
      id: doc.id,
      ...doc.data(),
    })
  })

  // Populate category dropdown
  const categorySelect = document.getElementById("dish-category")
  categorySelect.innerHTML = '<option value="">Select a category...</option>'

  allCategories.forEach((cat) => {
    const option = document.createElement("option")
    option.value = cat.id
    option.textContent = cat.categoryName || "Unnamed Category"
    categorySelect.appendChild(option)
  })
}

// ==========================
//  LOAD MENU ITEMS
// ==========================
async function loadMenuItems() {
  const container = document.getElementById("categories-container")
  container.innerHTML = ""

  for (const category of allCategories) {
    const items = Array.isArray(category.items) ? category.items : []

    const categoryBlock = document.createElement("div")
    categoryBlock.className = "category-block"

    const categoryHeader = document.createElement("div")
    categoryHeader.className = "category-header"
    categoryHeader.innerHTML = `
      <div>
        <h3 class="category-name">${escapeHtml(category.categoryName)}</h3>
        <span class="category-id">ID: ${escapeHtml(category.id)} | Prefix: ${escapeHtml(category.prefix || "")}</span>
      </div>
      <button type="button" class="btn-danger" onclick="openDeleteCategoryModal('${escapeHtml(category.id)}', '${escapeHtml(category.categoryName)}')">Delete Category</button>
    `
    categoryBlock.appendChild(categoryHeader)

    if (items.length === 0) {
      const empty = document.createElement("div")
      empty.className = "empty-category"
      empty.textContent = "No items in this category yet"
      categoryBlock.appendChild(empty)
    } else {
      const itemsList = document.createElement("div")
      itemsList.className = "items-list"

      items.forEach((item) => {
        const itemRow = document.createElement("div")
        itemRow.className = "item-row"
        itemRow.innerHTML = `
          <div>
            <strong>${escapeHtml(item.name)}</strong><br>
            <small style="color: var(--color-text-muted);">ID: ${escapeHtml(item.itemID)}</small>
          </div>
          <div>Rp ${item.price?.toLocaleString("id-ID") || "0"}</div>
          <div>${escapeHtml(item.stockStatus || "In Stock")}</div>
          <button type="button" class="btn-secondary" onclick="openEditModal('${category.id}', '${item.itemID}', ${JSON.stringify(item).replace(/'/g, "&#39;").replace(/"/g, "&quot;")})">Edit</button>
          <button type="button" class="btn-danger" onclick="deleteDish('${category.id}', '${item.itemID}')">Delete</button>
        `
        itemsList.appendChild(itemRow)
      })

      categoryBlock.appendChild(itemsList)
    }

    container.appendChild(categoryBlock)
  }
}

// ==========================
//  ADD DISH
// ==========================
document.getElementById("add-dish-form")?.addEventListener("submit", async (e) => {
  e.preventDefault()

  const categoryId = document.getElementById("dish-category").value
  const name = document.getElementById("dish-name").value.trim()
  const price = Number.parseInt(document.getElementById("dish-price").value)
  const stockStatus = document.getElementById("dish-stock").value

  if (!categoryId || !name || !price) {
    alert("Please fill in all required fields")
    return
  }

  try {
    const docRef = doc(db, "menu", categoryId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) {
      alert("Category not found")
      return
    }

    const categoryData = snap.data()
    const items = Array.isArray(categoryData.items) ? categoryData.items.slice() : []
    const prefix = categoryData.prefix || categoryId.substring(0, 2)

    const usedNumbers = new Set()
    items.forEach((it) => {
      const match = it.itemID.match(new RegExp(`^${prefix}_(\\d+)$`))
      if (match) {
        const num = Number.parseInt(match[1], 10)
        usedNumbers.add(num)
      }
    })

    let nextNum = 1
    while (usedNumbers.has(nextNum)) {
      nextNum++
    }

    const itemID = `${prefix}_${String(nextNum).padStart(3, "0")}`

    items.push({ itemID, name, price, stockStatus })
    await updateDoc(docRef, { items })

    alert("Dish added successfully!")
    document.getElementById("add-dish-form").reset()
    await loadMenuItems()
  } catch (error) {
    console.error("Error adding dish:", error)
    alert("Error adding dish: " + error.message)
  }
})

// ==========================
//  EDIT DISH
// ==========================
async function openEditModal(categoryId, itemId, itemData) {
  currentEditingCategory = categoryId
  currentEditingDish = itemId

  document.getElementById("edit-dish-name").value = itemData.name
  document.getElementById("edit-dish-price").value = itemData.price
  document.getElementById("edit-dish-stock").value = itemData.stockStatus

  document.getElementById("edit-modal").style.display = "flex"
}

function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none"
  currentEditingDish = null
  currentEditingCategory = null
}

document.getElementById("edit-dish-form")?.addEventListener("submit", async (e) => {
  e.preventDefault()

  if (!currentEditingCategory || !currentEditingDish) return

  const name = document.getElementById("edit-dish-name").value.trim()
  const price = Number.parseInt(document.getElementById("edit-dish-price").value)
  const stockStatus = document.getElementById("edit-dish-stock").value

  if (!name || !price) {
    alert("Please fill in all required fields")
    return
  }

  try {
    const docRef = doc(db, "menu", currentEditingCategory)
    const snap = await getDoc(docRef)
    if (!snap.exists()) {
      alert("Category not found")
      return
    }

    const categoryData = snap.data()
    const items = Array.isArray(categoryData.items) ? categoryData.items.slice() : []
    const itemIndex = items.findIndex((x) => x.itemID === currentEditingDish)

    if (itemIndex === -1) {
      alert("Item not found")
      return
    }

    items[itemIndex] = { ...items[itemIndex], name, price, stockStatus }
    await updateDoc(docRef, { items })

    alert("Dish updated successfully!")
    closeEditModal()
    await loadMenuItems()
  } catch (error) {
    console.error("Error updating dish:", error)
    alert("Error updating dish: " + error.message)
  }
})

// ==========================
//  DELETE DISH
// ==========================
async function deleteDish(categoryId, itemId) {
  if (!confirm("Are you sure you want to delete this dish?")) return

  try {
    const docRef = doc(db, "menu", categoryId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) {
      alert("Category not found")
      return
    }

    const categoryData = snap.data()
    const items = Array.isArray(categoryData.items) ? categoryData.items.slice() : []
    const filtered = items.filter((x) => x.itemID !== itemId)

    await updateDoc(docRef, { items: filtered })

    alert("Dish deleted successfully!")
    await loadMenuItems()
  } catch (error) {
    console.error("Error deleting dish:", error)
    alert("Error deleting dish: " + error.message)
  }
}

// ==========================
//  ADD CATEGORY
// ==========================
document.getElementById("add-category-form")?.addEventListener("submit", async (e) => {
  e.preventDefault()

  const categoryName = document.getElementById("category-name").value.trim()
  const categoryId = document.getElementById("category-id").value.trim().toLowerCase()
  const prefix = document.getElementById("category-prefix").value.trim().toLowerCase()

  if (!categoryName || !categoryId || !prefix) {
    alert("Please fill in all required fields")
    return
  }

  if (!/^[a-z0-9_-]+$/.test(categoryId)) {
    alert("Category ID must contain only lowercase letters, numbers, hyphens, and underscores")
    return
  }

  if (prefix.length < 2 || prefix.length > 3) {
    alert("Prefix must be 2-3 characters long")
    return
  }

  try {
    const existingDoc = await getDoc(doc(db, "menu", categoryId))
    if (existingDoc.exists()) {
      alert("This category ID already exists. Please use a different ID.")
      return
    }

    await updateDoc(doc(db, "menu", categoryId), {
      categoryName,
      prefix,
      items: [],
    }).catch(async (error) => {
      // If document doesn't exist, create it
      if (error.code === "not-found") {
        await setDoc(doc(db, "menu", categoryId), {
          categoryName,
          prefix,
          items: [],
        })
      } else {
        throw error
      }
    })

    alert(`Category "${categoryName}" created successfully!`)
    document.getElementById("add-category-form").reset()
    await loadCategories()
    await loadMenuItems()
  } catch (error) {
    console.error("Error creating category:", error)
    alert("Error creating category: " + error.message)
  }
})

// ==========================
//  DELETE CATEGORY
// ==========================
function openDeleteCategoryModal(categoryId, categoryName) {
  deletingCategoryId = categoryId
  const warning = document.getElementById("delete-category-warning")
  warning.textContent = `This will permanently delete the "${categoryName}" category and all its items!`
  document.getElementById("delete-category-modal").style.display = "flex"
}

function closeDeleteCategoryModal() {
  document.getElementById("delete-category-modal").style.display = "none"
  deletingCategoryId = null
}

async function confirmDeleteCategory() {
  if (!deletingCategoryId) return

  try {
    const docRef = doc(db, "menu", deletingCategoryId)

    await deleteDoc(docRef)

    alert("Category deleted successfully!")
    closeDeleteCategoryModal()
    await loadCategories()
    await loadMenuItems()
  } catch (error) {
    console.error("Error deleting category:", error)
    alert("Error deleting category: " + error.message)
  }
}

// ==========================
//  HELPERS
// ==========================
function escapeHtml(str) {
  return String(str || "")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

// Export functions for inline onclick handlers
window.openEditModal = openEditModal
window.closeEditModal = closeEditModal
window.deleteDish = deleteDish
window.loadMenuItems = loadMenuItems
window.openDeleteCategoryModal = openDeleteCategoryModal
window.closeDeleteCategoryModal = closeDeleteCategoryModal
window.confirmDeleteCategory = confirmDeleteCategory
