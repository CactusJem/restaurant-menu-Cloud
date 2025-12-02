import { sessionManager } from "./login.js"
import { handleLogout } from "./auth-utils.js"

window.handleLogout = handleLogout

document.addEventListener("DOMContentLoaded", () => {
  const session = sessionManager.getSession()

  if (session) {
    // User is logged in, show user info and logout button
    document.getElementById("header-buttons").style.display = "flex"
    document.getElementById("userEmail").textContent = session.email
  } else {
    // User is not logged in, hide user controls
    document.getElementById("header-buttons").style.display = "none"
  }
})
