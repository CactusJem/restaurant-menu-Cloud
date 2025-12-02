// js/backend/admin.js
import { auth, db } from "../config/firebase-config.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js"

import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"

// ==========================
//  AUTO AUTH CHECK
// ==========================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("No user detected → redirect to login")
    window.location.href = "index.html"
    return
  }

  // READ ROLE FROM FIRESTORE
  const staffRef = collection(db, "staff")
  const snapshot = await getDocs(staffRef)

  let userRole = null
  snapshot.forEach((doc) => {
    const data = doc.data()
    if (data.email === user.email) {
      userRole = data.role
    }
  })

  // NOT ADMIN → KICK OUT
  if (userRole !== "admin") {
    alert("Access denied. You are not an admin.")
    await signOut(auth)
    window.location.href = "index.html"
    return
  }

  const userInfo = document.getElementById("userInfo")
  if (userInfo) {
    userInfo.textContent = `Logged in as: ${user.email}`
  }

  loadCategories() // load dashboard
})

// ==========================
//  LOGOUT
// ==========================
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth)
  window.location.href = "index.html"
})

// ==========================
//  ADD CATEGORY
// ==========================
export async function createCategory() {
  const name = document.getElementById("new-cat-name").value
  const prefix = document.getElementById("new-cat-prefix").value

  if (!name.trim() || !prefix.trim()) {
    alert("Both fields are required")
    return
  }

  await addDoc(collection(db, "categories"), {
    name,
    prefix,
    createdAt: serverTimestamp(),
  })

  alert("Category created!")
  loadCategories()
}

// ==========================
//  LOAD CATEGORIES
// ==========================
async function loadCategories() {
  const list = document.getElementById("categories-list")
  if (!list) return

  list.innerHTML = `<div class="loading">Loading...</div>`

  const snap = await getDocs(collection(db, "categories"))
  list.innerHTML = ""

  if (snap.empty) {
    list.innerHTML = `<p>No categories yet.</p>`
    return
  }

  snap.forEach((doc) => {
    const data = doc.data()
    const item = document.createElement("div")
    item.className = "category-item"
    item.innerHTML = `
      <strong>${data.name}</strong> 
      <span class="prefix">(${data.prefix})</span>
    `
    list.appendChild(item)
  })
}
