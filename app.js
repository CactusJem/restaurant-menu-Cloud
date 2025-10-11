import { auth, db, storage } from "./js/config/firebase-config.js"
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js"
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js"

// ================== AUTH ==================
export async function registerUser(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    console.log("User registered:", userCredential.user)
  } catch (err) {
    console.error("Registration error:", err)
  }
}

export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    console.log("User logged in:", userCredential.user)
  } catch (err) {
    console.error("Login error:", err)
  }
}

export async function logoutUser() {
  await signOut(auth)
  console.log("User logged out")
}

// ================== MENU CRUD ==================
const menuRef = collection(db, "menu")

// Listen for live menu updates
onSnapshot(menuRef, (snapshot) => {
  const menuDiv = document.getElementById("menu")
  menuDiv.innerHTML = ""
  snapshot.forEach((docSnap) => {
    const item = docSnap.data()
    menuDiv.innerHTML += `
      <p><b>${item.name}</b> - Rp ${item.price} 
      <button onclick="deleteMenuItem('${docSnap.id}')">❌</button></p>
    `
  })
})

export async function addMenuItem(name, price, imageFile) {
  try {
    // Upload image if provided
    let imageUrl = ""
    if (imageFile) {
      const storageRef = ref(storage, "menu/" + imageFile.name)
      await uploadBytes(storageRef, imageFile)
      imageUrl = await getDownloadURL(storageRef)
    }

    await addDoc(menuRef, {
      name,
      price,
      imageUrl,
      createdAt: new Date(),
    })
    console.log("Menu item added!")
  } catch (err) {
    console.error("Add menu error:", err)
  }
}

export async function deleteMenuItem(id) {
  try {
    await deleteDoc(doc(db, "menu", id))
    console.log("Menu item deleted")
  } catch (err) {
    console.error("Delete menu error:", err)
  }
}

// ================== ORDERS ==================
// Helper functions to generate unique doc IDs from customer name
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

async function ensureUniqueOrderId(dbRef, baseId) {
  let candidate = baseId
  let i = 0
  while (i < 10000) {
    const ref = doc(dbRef, "orders", candidate)
    const snap = await getDoc(ref)
    if (!snap.exists()) return candidate
    i += 1
    candidate = `${baseId}${i}`
  }
  throw new Error("Too many duplicate order IDs")
}

export async function placeOrder(customerName, items) {
  try {
    // Use deterministic doc id with suffixes
    const baseId = slugifyName(customerName)
    const orderId = await ensureUniqueOrderId(db, baseId)

    await setDoc(doc(db, "orders", orderId), {
      customerName,
      items, // array of menu item IDs
      status: "pending",
      timestamp: serverTimestamp(), // Align with cashier ordering
      createdAt: new Date(),
    })
    console.log("Order placed!")
  } catch (err) {
    console.error("Order error:", err)
  }
}
