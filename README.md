# Restaurant Menu Cloud

A Firebase-powered restaurant management system built with vanilla HTML, CSS, and JavaScript.

This project supports three operational roles:

- **Staff**: browse the menu, add items to cart, attach notes, apply discounts, and submit customer orders
- **Admin**: manage menu categories and dishes
- **Cashier**: view pending orders, choose payment methods, mark orders as paid, or cancel them

The app is deployed as a static site and uses Firebase for authentication, database, storage configuration, and hosting.

---

## Features

### Role-based access
- Login screen for **staff**, **admin**, and **cashier**
- User role is validated against the `users` collection in Firestore
- Unauthorized users are redirected back to the login page

### Staff ordering flow
- Staff identifies themselves before taking orders
- Browse menu by category
- Add items to cart
- Adjust quantity
- Add special instructions / notes per item
- Apply order-level discounts
- Submit orders to cashier

### Admin dashboard
- Create menu categories
- Define a category prefix for automatic item IDs
- Add new dishes to a category
- Edit dish name, price, and stock status
- Delete dishes
- Delete categories

### Cashier panel
- Live view of **pending orders**
- See customer name, assigned staff, item list, notes, and totals
- Select payment method
- Mark order as **paid**
- Cancel/delete orders

### Firebase deployment
- Static frontend hosted with Firebase Hosting
- Firestore used for menu, users, orders, and staff order tracking
- Firebase Auth used for login
- Firebase config stored in `js/config/firebase-config.js`

---

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript (ES Modules)
- **Backend services:** Firebase
  - Firebase Authentication
  - Cloud Firestore
  - Firebase Hosting
  - Firebase Storage (configured in project)

---

## Project Structure

```text
restaurant-menu-Cloud/
├── admin.html
├── cashier.html
├── index.html
├── menu.html
├── payment.html
├── firebase.json
├── .firebaserc
├── cors.json
├── app.js
├── js/
│   ├── backend/
│   │   └── admin.js
│   ├── config/
│   │   └── firebase-config.js
│   └── frontend/
│       ├── auth-visibility.js
│       ├── cashier.js
│       ├── login.js
│       ├── payment.js
│       ├── public-menu.js
│       └── staff-tracking.js
└── styles/
    ├── admin.css
    ├── globals.css
    ├── login.css
    ├── menu.css
    └── staff.css
