# Objection Handling App - Project Overview

## 🧾 Summary
This Node.js + MySQL application allows farmers to register, log in, and submit an objection based on a transaction number. Admins can log in to review, archive, and track status changes. The application is aligned structurally with a previously built aid registration app and supports future integration as a microservice.

---

## 🧱 Tech Stack
- **Backend**: Node.js (Express)
- **Database**: MySQL (XAMPP local for dev)
- **Templating Engine**: Handlebars (`express-handlebars`)
- **Session Store**: MySQL (using `express-mysql-session`)
- **ORM**: Raw SQL using `mysql2/promise`
- **Other Libs**: `bcrypt`, `connect-flash`, `helmet`, `method-override`

---

## 🧩 Features

### 👨‍🌾 Farmer Features
- Register and log in (session-based)
- Submit an objection using a valid transaction number
- View status of existing objection
- Prevent duplicate objections until one is archived
- Log out

### 🛠️ Admin Features
- Log in with hardcoded (hashed) credentials via `.env`
- View all objections with filter by status
- Pagination (planned)
- Mark objections as "reviewed"
- Archive objections (moves to `archive` table and deletes original)
- View status change history via modal popup (AJAX)

### 🛡️ Security / Quality
- Input sanitization and validation via `express-validator`
- Flash messaging for user feedback
- Session timeout with logout button
- Session stored securely in MySQL
- Headers protected using `helmet`
