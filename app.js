import { auth, db, storage } from "./js/config/firebase-config.js";
import { 
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
  ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";


// ================== AUTH ==================
export async function registerUser(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("User registered:", userCredential.user);
  } catch (err) {
    console.error("Registration error:", err);
  }
}

export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("User logged in:", userCredential.user);
  } catch (err) {
    console.error("Login error:", err);
  }
}

export async function logoutUser() {
  await signOut(auth);
  console.log("User logged out");
}


// ================== MENU CRUD ==================
const menuRef = collection(db, "menu");

// Listen for live menu updates
onSnapshot(menuRef, (snapshot) => {
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";
  snapshot.forEach((docSnap) => {
    const item = docSnap.data();
    menuDiv.innerHTML += `
      <p><b>${item.name}</b> - Rp ${item.price} 
      <button onclick="deleteMenuItem('${docSnap.id}')">❌</button></p>
    `;
  });
});

export async function addMenuItem(name, price, imageFile) {
  try {
    // Upload image if provided
    let imageUrl = "";
    if (imageFile) {
      const storageRef = ref(storage, "menu/" + imageFile.name);
      await uploadBytes(storageRef, imageFile);
      imageUrl = await getDownloadURL(storageRef);
    }

    await addDoc(menuRef, {
      name,
      price,
      imageUrl,
      createdAt: new Date()
    });
    console.log("Menu item added!");
  } catch (err) {
    console.error("Add menu error:", err);
  }
}

export async function deleteMenuItem(id) {
  try {
    await deleteDoc(doc(db, "menu", id));
    console.log("Menu item deleted");
  } catch (err) {
    console.error("Delete menu error:", err);
  }
}


// ================== ORDERS ==================
export async function placeOrder(customerName, items) {
  try {
    await addDoc(collection(db, "orders"), {
      customerName,
      items, // array of menu item IDs
      status: "pending",
      createdAt: new Date()
    });
    console.log("Order placed!");
  } catch (err) {
    console.error("Order error:", err);
  }
}
