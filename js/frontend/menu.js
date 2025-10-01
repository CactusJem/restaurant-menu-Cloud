import { auth, db } from "../config/firebase-config.js"
import { storage } from "../config/firebase-config.js"
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js"
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js"

// --- helper for image upload ---
async function uploadMenuImage(file, categoryId, itemID) {
  if (!file) return ""
  const imageRef = ref(storage, `menu_images/${categoryId}/${itemID}-${Date.now()}`)
  await uploadBytes(imageRef, file)
  return await getDownloadURL(imageRef)
}

// --- LOGIN ---
window.login = async () => {
  const email = document.getElementById("email").value
  const pass = document.getElementById("password").value

  try {
    await signInWithEmailAndPassword(auth, email, pass)
    document.getElementById("login-box").style.display = "none"
    document.getElementById("dashboard").style.display = "block"
    loadCategories()
  } catch (err) {
    alert("Login failed: " + err.message)
  }
}

// --- CREATE CATEGORY ---
window.createCategory = async () => {
  const name = document.getElementById("new-cat-name").value.trim()
  const prefix = document.getElementById("new-cat-prefix").value.trim().toLowerCase()

  if (!name || !prefix) return alert("Fill both category name and prefix.")

  const id = name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
  const docRef = doc(db, "menu", id)
  const snap = await getDoc(docRef)
  if (snap.exists()) return alert("Category already exists: " + id)

  await setDoc(docRef, {
    categoryName: name,
    prefix,
    items: [],
  })

  document.getElementById("new-cat-name").value = ""
  document.getElementById("new-cat-prefix").value = ""
  await loadCategories()
}

// --- DELETE CATEGORY ---
window.deleteCategory = async (categoryId) => {
  if (!confirm("Delete entire category and all its items?")) return
  await deleteDoc(doc(db, "menu", categoryId))
  await loadCategories()
}

// --- CREATE ITEM inside category ---
window.addItemToCategory = async (categoryId) => {
  const name = document.getElementById(`add-name-${categoryId}`).value.trim()
  const priceRaw = document.getElementById(`add-price-${categoryId}`).value
  const stockStatus = document.getElementById(`add-stock-${categoryId}`).value.trim() || "In Stock"

  if (!name || !priceRaw) return alert("Fill item name and price.")
  const price = Number.parseInt(priceRaw, 10)

  const docRef = doc(db, "menu", categoryId)
  const snap = await getDoc(docRef)
  if (!snap.exists()) return alert("Category not found.")

  const data = snap.data()
  const items = Array.isArray(data.items) ? data.items.slice() : []
  const prefix = data.prefix || categoryId.substring(0, 2)

  let maxNum = 0
  items.forEach((it) => {
    const match = it.itemID.match(new RegExp(`^${prefix}_(\\d+)$`))
    if (match) {
      const num = Number.parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  })
  const newNum = String(maxNum + 1).padStart(3, "0")
  const itemID = `${prefix}_${newNum}`

  items.push({ itemID, name, price, stockStatus })
  await updateDoc(docRef, { items })

  document.getElementById(`add-name-${categoryId}`).value = ""
  document.getElementById(`add-price-${categoryId}`).value = ""
  document.getElementById(`add-stock-${categoryId}`).value = ""

  await loadCategories()
}

// --- LOAD CATEGORIES + ITEMS ---
export async function loadCategories() {
  const list = document.getElementById("categories-list")
  list.innerHTML = "Loading..."

  const q = query(collection(db, "menu"), orderBy("categoryName"))
  const snapshot = await getDocs(q)

  list.innerHTML = ""
  if (snapshot.empty) {
    list.innerHTML = "<p>No categories yet</p>"
    return
  }

  snapshot.forEach((catDoc) => {
    const cat = catDoc.data()
    const catId = catDoc.id
    const items = Array.isArray(cat.items) ? cat.items : []

    const catBlock = document.createElement("div")
    catBlock.className = "category-block"
    catBlock.innerHTML = `
      <div class="category-header">
        <h3 class="category-name">${escapeHtml(cat.categoryName)} <span class="category-id">(id: ${escapeHtml(catId)})</span></h3>
        <button class="btn-danger" onclick="deleteCategory('${catId}')">Delete Category</button>
      </div>

      <div class="add-item-form">
        <input id="add-name-${catId}" class="form-input" placeholder="Item name">
        <input id="add-price-${catId}" class="form-input" type="number" placeholder="Price">
        <select id="add-stock-${catId}" class="form-input">
          <option value="In Stock">In Stock</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>
        <button class="btn-primary" onclick="addItemToCategory('${catId}')">Add Item</button>
      </div>

      <div id="items-${catId}" class="items-list"></div>
    `
    list.appendChild(catBlock)

    const itemsDiv = catBlock.querySelector(`#items-${catId}`)
    if (items.length === 0) {
      itemsDiv.innerHTML = "<div class='empty-category'><em>No items</em></div>"
    } else {
      items.forEach((it) => {
        const row = document.createElement("div")
        row.className = "item-row"
        row.innerHTML = `
          <input id="name-${catId}-${it.itemID}" class="form-input" value="${escapeHtml(it.name)}">
          <input id="price-${catId}-${it.itemID}" class="form-input" type="number" value="${it.price}">
          <input id="stock-${catId}-${it.itemID}" class="form-input" value="${escapeHtml(it.stockStatus || "")}">
          <div style="display:flex; gap: var(--spacing-xs); justify-content:flex-end;">
            <button class="btn-secondary" onclick="saveItem('${catId}','${it.itemID}')">Save</button>
            <button class="btn-danger" onclick="deleteItem('${catId}','${it.itemID}')">Delete</button>
          </div>
        `
        itemsDiv.appendChild(row)
      })
    }
  })
}

// --- SAVE ITEM ---
window.saveItem = async (categoryId, itemID) => {
  const name = document.getElementById(`name-${categoryId}-${itemID}`).value.trim()
  const priceRaw = document.getElementById(`price-${categoryId}-${itemID}`).value
  const stock = document.getElementById(`stock-${categoryId}-${itemID}`).value.trim()

  if (!name || !priceRaw) return alert("Fill name and price.")
  const price = Number.parseInt(priceRaw, 10)

  const docRef = doc(db, "menu", categoryId)
  const snap = await getDoc(docRef)
  if (!snap.exists()) return alert("Category not found.")

  const items = Array.isArray(snap.data().items) ? snap.data().items.slice() : []
  const idx = items.findIndex((x) => x.itemID === itemID)
  if (idx === -1) return alert("Item not found.")

  items[idx] = { itemID, name, price, stockStatus: stock || "In Stock" }
  await updateDoc(docRef, { items })
  alert("Saved")
  await loadCategories()
}

// --- DELETE ITEM ---
window.deleteItem = async (categoryId, itemID) => {
  if (!confirm("Delete this item?")) return
  const docRef = doc(db, "menu", categoryId)
  const snap = await getDoc(docRef)
  if (!snap.exists()) return alert("Category not found.")

  const items = Array.isArray(snap.data().items) ? snap.data().items.slice() : []
  const filtered = items.filter((x) => x.itemID !== itemID)
  await updateDoc(docRef, { items: filtered })
  await loadCategories()
}

// --- helper to avoid XSS ---
function escapeHtml(str) {
  return String(str || "").replaceAll('"', "&quot;")
}

window.loadCategories = loadCategories

// Show Admin link if logged in as admin
onAuthStateChanged(auth, (user) => {
  if (user && user.email === "admin@restaurant.com") {
    document.getElementById("admin-link").style.display = "block";
  }
});
