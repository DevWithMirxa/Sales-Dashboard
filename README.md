# Full-Stack Sales Dashboard - Feed Mill/Farm Analytics

A professional, responsive Next.js and Express.js full-stack application. This dashboard provides comprehensive sales analytics, reporting, Role-Based Access Control (RBAC), and dynamic data management for feed mill and farm businesses.

## 🌟 New Full-Stack Functionalities

The dashboard has been upgraded from a static frontend mock to a **production-ready full-stack application**. 

### 1. Robust Backend Architecture
- **Express.js API**: Fully functional RESTful CRUD APIs for all primary resources (Auth, Dashboard metrics, Customers, Salesmen, Products, Regions).
- **MongoDB Integration**: True data persistence using MongoDB via Mongoose. All models and entity relationships strictly sync with the system's needs.
- **Dynamic Metrics**: The main dashboard now accurately aggregates and displays real live data (Total Sales, Percent Achievements, Volumes, etc.) dynamically fetched directly from the database to replace mock data.

### 2. Security & Authentication
- **JWT-based Authentication**: Secure user login and protected API routes leveraging JSON Web Tokens.
- **Role-Based Access Control (RBAC)**: Distinguishes privileges. Only authenticated users with adequate roles can view certain metrics and perform specific modify operations.
- **Bcrypt Security**: Passwords and sensitive data are safely hashed before storage. 

### 3. Frontend-Backend Data Synchronization
- Comprehensive data fetching integrated with React hooks and `fetch`/`axios` queries.
- Modifying regions, users, forms, and product definitions actively persists and updates the analytics charts simultaneously.
- Cross-Origin Resource Sharing (CORS) perfectly calibrated to support frontend connection directly from `localhost:3000` with full cookie transmission.

---

## 🎯 Dashboard Features

### Dashboard Metrics
- **Total Sale (Rs)** - Revenue tracking in Pakistani Rupees
- **Total Sale (MT)** - Volume tracking in Metric Tons
- **Total Target (Rs)** - Target revenue management
- **% Target Achievement** - Database-driven performance monitoring
- **Top 3 Salesmen & Products** - Live ranked performer analytics
- **Region-wise Analytics** - Full sales & distribution breakdown by region

### Forms & Data Management
1. **Customer Form** - Manage detailed business, contact, and address structures.
2. **Sales Person Form** - Team management & Recovery tracking.
3. **Region Form** - Manage regional data logic across predefined major zones.
4. **Product Form** - Define standard and pricing metrics.

### Interactive UI Highlights
- **Global Filters** - React-driven interactive data range controls.
- **Responsive Charts** - Stunning dynamic charting with Recharts.
- **Shadcn/Tailwind Aesthetics** - Clean, vibrant, and professional views across Mobile and Desktop.

---

## 🛠️ Tech Stack

**Frontend:**
- Framework: Next.js 16
- UI / Styling: Tailwind CSS v4, shadcn/ui
- Visuals: Recharts, Lucide React
- Logic: React Hook Form

**Backend:**
- Server: Node.js, Express.js
- Database: MongoDB (Mongoose)
- Security: JWT (JSON Web Tokens), Bcrypt, Cookie-parser

---

## 🚀 Getting Started

Follow these steps to run the complete environment locally. You will need to spin up the **backend server** and **frontend client** on two separate terminals.

### Prerequisites
- Node.js 18+
- MongoDB instance (Locally installed or MongoDB Atlas URL)

### 1. Backend Setup

Open a terminal and navigate to the backend directory:
```bash
cd server
npm install
```

**Environment Variables:**
Create a `.env` file in the `server` folder with the following keys:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/sales_dashboard  # Example local DB or use Mongo Atlas
JWT_SECRET=your_super_secret_jwt_string
```

**Start the Server:**
```bash
npm run dev
# The backend will start at http://localhost:5000
```

### 2. Frontend Setup

Open a *new* terminal at the root of the project:
```bash
npm install
```

**Start the Client:**
```bash
npm run dev
```

Visit the dashboard in your browser: `http://localhost:3000`

---

## 📁 Project Structure

```
├── app/                  # Next.js Frontend Application Router
├── components/           # Reusable UI & Chart components
├── server/               # Express.js Backend Core
│   ├── config/           # DB Configuration
│   ├── controllers/      # API logic controllers
│   ├── middleware/       # Auth/RBAC interceptors
│   ├── models/           # Mongoose Data Schemas
│   ├── routes/           # REST endpoints
│   ├── .env              # Backend secrets
│   └── server.js         # Backend Entry Point
├── package.json          # Frontend Dependencies
└── README.md             # Project documentation (You are here!)
```

## 🔄 How to Use
1. **Login/Authenticate**: Register an admin or login to receive your encrypted session token.
2. **Add Roots**: Create sample data through the forms directly (Products, Regions, Customers). Real responses will sync up.
3. **View Visuals**: Navigate to the home dashboard to see charts organically populate based on database insights.
4. **Filter & Sort**: Alter timeline views globally to trigger backend data-query recalibrations.

---

**Last Updated**: April 2026
**Version**: 2.0.0 (Full-Stack Integrations)
