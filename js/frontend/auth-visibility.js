const headerButtons = document.getElementById("header-buttons");

// Ultra Hidden Admin/Cashier Access
let clickCount = 0;

const logo = document.querySelector(".menu-title");


logo.addEventListener("click", () => {
  clickCount++;

  if (clickCount >= 3) {
    headerButtons.style.display = "flex";
    clickCount = 0;
  }

  // reset hitungan jika terlalu lama (1 detik)
  setTimeout(() => {
    clickCount = 0;
  }, 1000);
});
