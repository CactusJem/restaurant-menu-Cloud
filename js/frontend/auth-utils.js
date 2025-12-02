import { sessionManager } from "./login.js"
import { auth } from "../config/firebase-config.js"
import { signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js"

export function requireAuth(role = null) {
  const session = sessionManager.getSession()

  if (!session) {
    window.location.href = "index.html"
    return null
  }

  if (role && session.role !== role) {
    window.location.href = "index.html"
    return null
  }

  return session
}

export function requireRole(role) {
  const session = sessionManager.getSession()

  if (!session) {
    window.location.href = "index.html"
    return false
  }

  if (session.role !== role) {
    window.location.href = "index.html"
    return false
  }

  return true
}

export async function handleLogout() {
  try {
    await signOut(auth)
    sessionManager.clearSession()
    window.location.href = "index.html"
  } catch (error) {
    console.error("Logout error:", error)
  }
}

export function getUserInfo() {
  const session = sessionManager.getSession()
  return session
}

export function displayUserInfo() {
  const session = sessionManager.getSession()
  if (!session) return null

  const userInfoHTML = `
    <div class="user-info">
      <span class="user-role">${session.role.toUpperCase()}</span>
      <span class="user-email">${session.email}</span>
      <button onclick="handleLogout()" class="btn-logout">Logout</button>
    </div>
  `
  return userInfoHTML
}
