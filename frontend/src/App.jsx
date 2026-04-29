import React from "react";
import { useEffect, useState } from "react";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
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
  const [authMode, setAuthMode] = useState("login");
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

  if (isAuthenticated) {
    const storedUser = getStoredUser();
    return storedUser.role === "admin" ? <AdminDashboard /> : <Dashboard />;
  }

  if (authMode === "register") {
    return (
      <Register
        onSwitchToLogin={() => setAuthMode("login")}
        onAuthSuccess={() => setIsAuthenticated(true)}
      />
    );
  }

  return (
    <Login
      onSwitchToRegister={() => setAuthMode("register")}
      onAuthSuccess={() => setIsAuthenticated(true)}
    />
  );
};

export default App;
