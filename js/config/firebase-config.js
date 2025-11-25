// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js"
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js"
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js"

// Your Firebase config
export const firebaseConfig = {
  apiKey: "AIzaSyBCRCzW8s5iMbSnk5RIV8wbDCIN9V_vT2Y",
  authDomain: "restaurantmenu-7d861.firebaseapp.com",
  projectId: "restaurantmenu-7d861",
  storageBucket: "restaurantmenu-7d861.appspot.com",  
  messagingSenderId: "364365075232",
  appId: "1:364365075232:web:5145727a7cd42aef567d45",
  measurementId: "G-N5XR8KQPJR",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
