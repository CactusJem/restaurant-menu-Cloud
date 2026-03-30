// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js"
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js"
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js"

// Your Firebase config
export const firebaseConfig = {

}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
