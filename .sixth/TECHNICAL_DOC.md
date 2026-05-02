# 📘 DialFlow AI — Complete Technical Documentation

---

# 1. 📌 Project Overview

DialFlow AI is a modern, scalable Call Center CRM system designed to replace traditional tools like Google Forms and Sheets with a centralized, automated, and intelligent workflow platform.

The system enables:

* Agents to log call responses quickly and efficiently
* Admins to monitor performance in real-time
* Organizations to manage and analyze call data effectively

---

# 2. 🎯 Objectives

* Eliminate manual data entry via Google Sheets
* Improve agent productivity and reduce repetition
* Enable real-time monitoring of agents
* Provide structured and centralized data storage
* Deliver actionable analytics for decision-making

---

# 3. 🏗️ System Architecture

## High-Level Architecture

```text
Frontend (React)
   ↓
Backend API (Node.js + Express)
   ↓
Database (PostgreSQL)
```

## Components

* **Frontend:** UI, routing, dashboards
* **Backend:** API handling, authentication, business logic
* **Database:** Persistent structured storage

---

# 4. ⚙️ Technology Stack

## Frontend

* React.js (Vite)
* React Router v6
* Custom CSS (Glassmorphism UI)
* Axios (API calls)

## Backend

* Node.js
* Express.js

## Database

* PostgreSQL

## Authentication

* JWT (JSON Web Tokens)
* Bcrypt.js (password hashing)

## State Management

* Custom store + LocalStorage

---

# 5. 👥 User Roles & Access Control

## 👤 Agent

* Login with Employee ID & Password
* Submit call response forms
* View personal dashboard
* Track working time
* Use break functionality

## 🧑‍💼 Admin

* Secure registration (Admin Code protected)
* Monitor all agents
* View analytics dashboard
* Export reports
* Track real-time agent status

---

# 6. 🔐 Authentication & Authorization

* JWT-based authentication
* Role-based access control (RBAC)
* Session persistence using LocalStorage
* Admin access protected by Admin Code:

```text
D_AI_AVY_2026
```

---

# 7. 🧩 Core Features

## 7.1 Smart Call Logging Form

Fields include:

* Employee ID (auto-filled)
* Employee Name (auto-filled)
* Zoho ID
* Dialer ID
* Reference ID
* Call Status
* Disposition
* Sub-Disposition
* Language
* Remark

---

## 7.2 Intelligent Auto-Fill System

* First entry: manual input
* Next entries: auto-filled
* Applied on:

  * Zoho ID
  * Dialer ID

👉 Reduces repetitive work

---

## 7.3 Agent Dashboard

* Total Calls
* Connected / Not Connected
* Positive Responses
* Recent Call History
* Live Working Timer

---

## 7.4 Break Management System

* Agent status types:

  * 🟢 Online
  * 🟡 Break
  * 🔴 Offline

* Break button implemented

* Resume functionality

---

## 7.5 Real-Time Tracking System

* Tracks:

  * Login time
  * Active time
  * Last activity

* Auto offline detection:

  * If inactive → status becomes "offline"

---

## 7.6 Admin Dashboard

* View all agents
* Live status monitoring
* Performance metrics
* Data filtering & sorting
* Export functionality

---

## 7.7 Data Export System

* Export formats:

  * CSV
  * Excel (.xls)

* Custom column selection

* Downloadable reports

---

## 7.8 Analytics & Visualization

* Call volume trends
* Disposition distribution
* Connect rate
* Agent performance

---

# 8. 🔄 Application Flow

```text
Landing Page
   ↓
Login / Register
   ↓
Authentication (JWT)
   ↓
Role Check
   ↓
Admin → Admin Dashboard
Agent → Agent Dashboard
```

---

# 9. 🌐 Routing System

* `/` → Landing Page
* `/login` → Login Page
* `/register` → Register Page
* `/agent/dashboard` → Agent Panel
* `/admin/dashboard` → Admin Panel

---

# 10. 🗄️ Database Design

## users table

```sql
id
emp_id
name
password_hash
role
status
last_login
last_active
```

## call_logs table

```sql
id
emp_id
zoho_id
dialer_id
reference_id
call_status
disposition
sub_disposition
language
remark
created_at
```

---

# 11. 🔌 API Design

## Auth APIs

* POST /api/auth/register
* POST /api/auth/login

## Agent APIs

* POST /api/call
* GET /api/call/history
* POST /api/agent/break
* POST /api/agent/resume

## Admin APIs

* GET /api/admin/agents
* GET /api/admin/analytics
* GET /api/admin/export

---

# 12. 🛡️ Security Features

* Password hashing (bcrypt)
* Token-based authentication
* Role-based route protection
* Admin code restriction

---

# 13. ⚡ Performance Optimization

* useMemo for filtering
* Optimized SQL queries
* Efficient state updates
* Minimal re-renders

---

# 14. 🎨 UI/UX Design

* Dark AI theme
* Glassmorphism design
* Smooth animations
* Responsive layout (in progress)

---

# 15. 🧱 Project Structure

```text
frontend/
  src/
    pages/
      auth/
      agent/
      admin/
    services/
    App.jsx

backend/
  src/
    controllers/
    routes/
    middleware/
    server.js
```

---

# 16. 🧩 Problems Solved

| Problem           | Solution              |
| ----------------- | --------------------- |
| Manual data entry | Automated form system |
| No tracking       | Real-time monitoring  |
| No structure      | PostgreSQL schema     |
| Repetitive input  | Auto-fill logic       |
| No analytics      | Dashboard + charts    |

---

# 17. 🚀 Deployment Strategy

* Frontend: Vercel / Netlify
* Backend: Render / Railway
* Database: Neon / Supabase

---

# 18. ⚠️ Limitations

* LocalStorage-based session (basic security)
* No WebSocket yet
* Mobile UI not fully optimized

---

# 19. 🔮 Future Enhancements

* WebSocket real-time tracking
* AI-based call analysis
* Dialer API integration
* Mobile app
* Advanced dashboards

---

# 20. 🏁 Conclusion

DialFlow AI successfully transforms a manual and inefficient call center workflow into a structured, scalable, and intelligent CRM system.

It improves:

* Productivity
* Accuracy
* Monitoring
* Decision-making

---

# 👨‍💻 Developed By

Om Patel
Associate Software Developer

Powered by Dhritii.ai
