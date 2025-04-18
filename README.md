# Objection Handling App - Project Overview

## 🧾 Summary
A secure Node.js + MySQL web application that allows farmers to:
- Register and log in
- Submit objections using a transaction number
- Track objection status (with Arabic UI support)
- Recover their password using verification codes

Admins can:
- Review, resolve, and archive objections
- Monitor status with pagination and filtering
- View detailed info per submission

---

## 🧱 Tech Stack
- **Backend**: Node.js (Express)
- **Database**: MySQL
- **Templating Engine**: Handlebars (`express-handlebars`)
- **Session Store**: In-memory (optionally extendable)
- **ORM**: Raw SQL via `mysql2/promise`
- **Middleware**: `helmet`, `express-validator`, `body-parser`, `flash`
- **Security**: Content Security Policy, password hashing, session protection

---

## 🌍 Localization
- Arabic interface with status translations
- Date formatting using `moment` in Arabic locale

---

## 📄 Database Tables (Auto-Created)

### `farmer`
Stores user info.
- `id`, `first_name`, `last_name`, `phone`, `national_id`, `password_hash`, `created_at`

### `objection`
Active objections.
- `id`, `farmer_id`, `code`, `transaction_number`, `details`, `status`, `created_at`, `reviewed_at`

### `archive`
Archived objections.
- Mirrors `objection` structure, stores finalized entries

### `password_reset`
Temporary table for password recovery flow.
- `farmer_id`, `national_id`, `reset_token`, `verification_code`, `expires_at`

---

## 👨‍🌾 Farmer Features
- Register/login/logout
- Submit only 1 active objection at a time
- Track all previous objections
- Password recovery with verification code split input (6 digits)

---

## 🛠️ Admin Features
- Admin login with credentials in `.env`
- Dashboard to view objections (paginated)
- Mark as `reviewed`, `resolved`, or `archived`
- Archived objections are copied to archive table and removed from active

---

## 🛡️ Security
- `helmet` with strict Content Security Policy
- `bcrypt` hashed passwords
- Flash messages to protect error feedback
- Middleware-based route protection
- Secure password reset using 6-digit code + token

---

## 🚀 Future Enhancements
- Admin filters by status and search
- Email/SMS gateway for verification codes
- Integrate into shared frontend microservice
- Add Prometheus/Grafana monitoring hooks
- Dockerize and deploy to K8s

---

## ✅ Status
> ✅ App is stable and functional. Ready for integration or deployment. View logic follows a single-file structure with consistent behavior matching user's previous apps.

