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
              ? (role === "admin" ? <Navigate to="/admin/dashboard" /> : <Navigate to="/agent/dashboard" />)
              : <Login onAuthSuccess={() => setIsAuthenticated(true)} />
          } 
        />
        <Route 
          path="/register"
          element={
            isAuthenticated 
              ? (role === "admin" ? <Navigate to="/admin/dashboard" /> : <Navigate to="/agent/dashboard" />)
              : <Register onAuthSuccess={() => setIsAuthenticated(true)} />
          } 
        />

        {/* Dashboard Routes - Protected */}
        <Route 
          path="/admin/dashboard" 
          element={isAuthenticated && role === "admin" ? <AdminDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/agent/dashboard" 
          element={isAuthenticated && role !== "admin" ? <Dashboard key={sessionKey} /> : <Navigate to="/login" />} 
        />
      </Routes>
    </Router>
  );
};

export default App;
