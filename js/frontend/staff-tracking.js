// Manages staff name/role assignment without authentication

const staffStorage = {
    key: "resto-staff",
    get: () => JSON.parse(sessionStorage.getItem(staffStorage.key)) || null,
    set: (data) => sessionStorage.setItem(staffStorage.key, JSON.stringify(data)),
    clear: () => sessionStorage.removeItem(staffStorage.key),
  }
  
  function showStaffModal() {
    const modal = document.getElementById("staff-modal")
    const form = document.getElementById("staff-form")
    const nameInput = document.getElementById("staff-name")
    const roleSelect = document.getElementById("staff-role")
  
    if (!form || !nameInput || !roleSelect) {
      console.log("[v0] Staff form elements not found, retrying...")
      setTimeout(showStaffModal, 100)
      return
    }
  
    form.addEventListener("submit", (e) => {
      e.preventDefault()
      const name = nameInput.value.trim()
      const role = roleSelect.value
  
      if (name && role) {
        staffStorage.set({ name, role })
        updateStaffDisplay()
        modal.style.display = "none"
      }
    })
  }
  
  function updateStaffDisplay() {
    const staff = staffStorage.get()
    const staffInfo = document.getElementById("staff-info")
    const modal = document.getElementById("staff-modal")
    const staffNameEl = document.getElementById("current-staff-name")
    const staffRoleEl = document.getElementById("current-staff-role")
  
    if (staff) {
      if (staffNameEl) staffNameEl.textContent = staff.name
      if (staffRoleEl) staffRoleEl.textContent = staff.role
      if (staffInfo) staffInfo.style.display = "flex"
      if (modal) modal.style.display = "none"
    } else {
      if (staffInfo) staffInfo.style.display = "none"
      if (modal) modal.style.display = "flex"
    }
  }
  
  function initStaffTracking() {
    updateStaffDisplay()
  
    const changeStaffBtn = document.getElementById("change-staff-btn")
    if (changeStaffBtn) {
      changeStaffBtn.addEventListener("click", () => {
        staffStorage.clear()
        updateStaffDisplay()
        showStaffModal()
      })
    }
  
    showStaffModal()
  }
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStaffTracking)
  } else {
    // If DOM is already loaded, use setTimeout to ensure all elements are rendered
    setTimeout(initStaffTracking, 50)
  }
  
  // Export for use in payment.js
  export { staffStorage }
  