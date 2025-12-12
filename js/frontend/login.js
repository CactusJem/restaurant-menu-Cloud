import { auth, db } from "../config/firebase-config.js"
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js"
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"

export const sessionManager = {
  setSession(user, role) {
    sessionStorage.setItem("user", JSON.stringify({ uid: user.uid, email: user.email, role }))
  },
  getSession() {
    const user = sessionStorage.getItem("user")
    return user ? JSON.parse(user) : null
  },
  clearSession() {
    sessionStorage.removeItem("user")
  },
}

let selectedRole = null

document.querySelectorAll(".role-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".role-btn").forEach((b) => b.classList.remove("active"))
    btn.classList.add("active")

    selectedRole = btn.getAttribute("data-role")
    const roleSelector = document.getElementById("roleSelector")
    const loginFormContainer = document.getElementById("loginFormContainer")
    const formTitle = document.getElementById("formTitle")

    // Show login form, hide role selector
    roleSelector.style.display = "none"
    loginFormContainer.style.display = "block"

    const titles = {
      admin: "Admin Login",
      staff: "Staff Login",
      cashier: "Cashier Login",
    }
    formTitle.textContent = titles[selectedRole] || "Login"
  })
})

document.getElementById("backBtn")?.addEventListener("click", () => {
  document.querySelectorAll(".role-btn").forEach((b) => b.classList.remove("active"))
  selectedRole = null
  // Restore grid layout when returning to role selection
  document.getElementById("roleSelector").style.display = "grid"
  document.getElementById("loginFormContainer").style.display = "none"
  document.getElementById("loginForm").reset()
  document.getElementById("errorMessage").textContent = ""
  document.getElementById("errorMessage").style.display = "none"
})

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault()
  handleLogin()
})

export async function handleLogin() {
  const email = document.getElementById("email").value
  const password = document.getElementById("password").value
  const errorMessage = document.getElementById("errorMessage")
  const loadingOverlay = document.getElementById("loadingOverlay")

  // Clear previous errors
  errorMessage.textContent = ""
  errorMessage.style.display = "none"
  loadingOverlay.style.display = "flex"

  try {
    // Sign in with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Fetch user role from Firestore users collection
    const userRef = doc(db, "users", user.uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      throw new Error("User profile not found in database")
    }

    const userData = userSnap.data()
    const userRole = userData.role

    // Validate user has a role
    if (!userRole) {
      throw new Error("User role not configured")
    }

    if (selectedRole && userRole !== selectedRole) {
      throw new Error(`This account is registered as "${userRole}", not "${selectedRole}"`)
    }

    // Save session
    sessionManager.setSession(user, userRole)

    loadingOverlay.style.display = "none"
    if (userRole === "admin") {
      window.location.href = "admin.html"
    } else if (userRole === "staff") {
      window.location.href = "menu.html"
    } else if (userRole === "cashier") {
      window.location.href = "cashier.html"
    } else {
      throw new Error("Unknown user role: " + userRole)
    }
  } catch (error) {
    console.error("[v0] Login error:", error)
    let userMessage = "Login failed. Please check your credentials."

    if (error.code === "auth/invalid-credential") {
      userMessage = "Invalid email or password."
    } else if (error.code === "auth/user-not-found") {
      userMessage = "No account found with this email."
    } else if (error.message.includes("User profile not found")) {
      userMessage = "User profile not configured. Contact administrator."
    } else if (error.message.includes("registered as")) {
      userMessage = error.message
    }

    errorMessage.textContent = userMessage
    errorMessage.style.display = "block"
    loadingOverlay.style.display = "none"
  }
}
