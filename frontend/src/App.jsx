import React from "react";
import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import LandingPage from "./pages/admin/LandingPage";
import Dashboard from "./pages/agent/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch (_error) {
    return {};
  }
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(localStorage.getItem("token")));

  useEffect(() => {
    const syncAuth = () => {
      setIsAuthenticated(Boolean(localStorage.getItem("token")));
    };

    window.addEventListener("storage", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  const user = getStoredUser();
  const role = user?.role;
  const sessionKey = `${user?.id || ""}-${user?.employeeId || ""}-${localStorage.getItem("token") || ""}`;
  const dashboardPath =
    role === "super_admin"
      ? "/super-admin"
      : role === "admin"
        ? "/admin"
        : "/agent";

  return (
    <Router 
      future={{ 
        v7_startTransition: true, 
        v7_relativeSplatPath: true 
      }}
    >
      <Routes>
        {/* Main Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth Routes */}
        <Route 
          path="/login"
          element={
            isAuthenticated 
              ? <Navigate to={dashboardPath} />
              : <Login onAuthSuccess={() => setIsAuthenticated(true)} />
          } 
        />
        <Route 
          path="/register"
          element={
            isAuthenticated 
              ? <Navigate to={dashboardPath} />
              : <Register onAuthSuccess={() => setIsAuthenticated(true)} />
          } 
        />

        {/* Dashboard Routes - Protected */}
        <Route 
          path="/super-admin" 
          element={isAuthenticated && role === "super_admin" ? <AdminDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/super-admin/manage-admins" 
          element={isAuthenticated && role === "super_admin" ? <AdminDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/super-admin/audit-logs" 
          element={isAuthenticated && role === "super_admin" ? <AdminDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/super-admin/downtime-history" 
          element={isAuthenticated && role === "super_admin" ? <AdminDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/admin" 
          element={isAuthenticated && (role === "admin" || role === "super_admin") ? <AdminDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/admin/downtime-history" 
          element={isAuthenticated && (role === "admin" || role === "super_admin") ? <AdminDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/admin/dashboard" 
          element={<Navigate to="/admin" />} 
        />
        <Route 
          path="/agent" 
          element={isAuthenticated && role === "agent" ? <Dashboard key={sessionKey} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/agent/dashboard" 
          element={<Navigate to="/agent" />} 
        />
      </Routes>
    </Router>
  );
};

export default App;
