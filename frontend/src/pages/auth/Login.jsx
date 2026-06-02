import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../../components/common/ThemeToggle";
import { loginUser, persistSession } from "../../services/authService";
import { useTheme } from "../../theme/useTheme";

const shellStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background:
    "radial-gradient(circle at top left, rgba(132, 63, 255, 0.28), transparent 28%), radial-gradient(circle at bottom right, rgba(32, 203, 255, 0.22), transparent 24%), linear-gradient(180deg, #070711 0%, #0c0b18 100%)",
  color: "#f6f3ff",
  fontFamily: "Segoe UI, sans-serif",
};

const inputStyle = {
  width: "100%",
  padding: "15px 16px",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#f6f3ff",
  outline: "none",
  boxSizing: "border-box",
  fontSize: "15px",
};

const passwordInputStyle = {
  ...inputStyle,
  paddingRight: "52px",
};

const passwordToggleStyle = {
  position: "absolute",
  top: "50%",
  right: "14px",
  transform: "translateY(-50%)",
  width: "34px",
  height: "34px",
  border: 0,
  borderRadius: "10px",
  background: "transparent",
  color: "#c5a8ff",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  padding: 0,
};

const visibilityIconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const EyeIcon = () => (
  <svg {...visibilityIconProps} aria-hidden="true">
    <path d="M2.5 12S5.8 5.5 12 5.5S21.5 12 21.5 12 18.2 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg {...visibilityIconProps} aria-hidden="true">
    <path d="M3 3L21 21" />
    <path d="M10.6 5.7C11.1 5.6 11.5 5.5 12 5.5C18.2 5.5 21.5 12 21.5 12C20.6 13.7 19.4 15.2 18 16.3" />
    <path d="M14.1 14.1C13.6 14.7 12.8 15 12 15C10.3 15 9 13.7 9 12C9 11.2 9.3 10.4 9.9 9.9" />
    <path d="M6.4 6.9C4 8.6 2.5 12 2.5 12S5.8 18.5 12 18.5C13.3 18.5 14.5 18.2 15.6 17.8" />
  </svg>
);

const Login = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState({
    role: "agent",
    employeeId: "",
    password: "",
  });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Login | Dialflow.ai";

    const authFeedback = sessionStorage.getItem("authFeedback");
    if (authFeedback) {
      setFeedback(authFeedback);
      sessionStorage.removeItem("authFeedback");
    }
  }, []);

  const handleChange = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.employeeId || !form.password) {
      setFeedback("Employee ID aur password required hain.");
      return;
    }

    setLoading(true);
    setFeedback("");

    try {
      const data = await loginUser({
        employeeId: form.employeeId,
        password: form.password,
        role: form.role,
      });
      persistSession(data);
      onAuthSuccess();

      if (data.user.role === "super_admin") {
        navigate("/super-admin");
      } else if (data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/agent");
      }
    } catch (error) {
      setFeedback(error.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="crm-theme-root" data-theme={theme} style={shellStyle}>
      <ThemeToggle
        theme={theme}
        onToggle={toggleTheme}
        style={{ position: "fixed", top: "20px", right: "20px", zIndex: 3 }}
      />
      <div
        style={{
          position: "fixed",
          width: "520px",
          height: "520px",
          borderRadius: "999px",
          background: "rgba(146, 84, 255, 0.18)",
          filter: "blur(110px)",
          top: "-120px",
          left: "-120px",
        }}
      />
      <div
        style={{
          position: "fixed",
          width: "460px",
          height: "460px",
          borderRadius: "999px",
          background: "rgba(53, 149, 255, 0.16)",
          filter: "blur(110px)",
          right: "-100px",
          bottom: "-100px",
        }}
      />

      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "430px",
          padding: "34px",
          borderRadius: "28px",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 28px 80px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "22px" }}>
          <div style={{ fontSize: "30px", fontWeight: 700 }}>Dialflow.ai</div>
          <div style={{ marginTop: "6px", color: "#c5a8ff", fontSize: "14px" }}>Powered by Dhritii.ai</div>
        </div>
        <h2 style={{ margin: 0, textAlign: "center", fontSize: "32px" }}>Welcome Back</h2>
        <p style={{ textAlign: "center", color: "#aaa3c2", marginTop: "10px", marginBottom: "28px" }}>
          Secure workspace access
        </p>

        <div style={{ display: "grid", gap: "16px" }}>
          <select
            style={{ ...inputStyle, color: "#aaa3c2", cursor: "pointer" }}
            value={form.role}
            onChange={(event) => handleChange("role", event.target.value)}
          >
            <option value="agent" style={{ background: "#18162a" }}>Agent</option>
            <option value="admin" style={{ background: "#18162a" }}>Admin</option>
            <option value="super_admin" style={{ background: "#18162a" }}>Super Admin</option>
          </select>
          <input
            style={inputStyle}
            type="text"
            placeholder="Employee ID"
            value={form.employeeId}
            onChange={(event) => handleChange("employeeId", event.target.value)}
          />
          <div style={{ position: "relative" }}>
            <input
              style={passwordInputStyle}
              type={isPasswordVisible ? "text" : "password"}
              placeholder="Password"
              value={form.password}
              onChange={(event) => handleChange("password", event.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((current) => !current)}
              style={passwordToggleStyle}
              aria-label={isPasswordVisible ? "Hide password" : "Show password"}
              aria-pressed={isPasswordVisible}
              title={isPasswordVisible ? "Hide password" : "Show password"}
            >
              {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {feedback ? (
          <div style={{ marginTop: "16px", color: "#d8bbff", fontSize: "14px" }}>{feedback}</div>
        ) : null}

        <button
          type="submit"
          style={{
            width: "100%",
            marginTop: "22px",
            padding: "14px 18px",
            borderRadius: "14px",
            border: 0,
            color: "#fff",
            cursor: "pointer",
            fontSize: "16px",
            background: "linear-gradient(90deg, #7d3cff 0%, #328cff 100%)",
          }}
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <p style={{ textAlign: "center", color: "#a9a2c2", marginTop: "18px", marginBottom: 0 }}>
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/register")}
            style={{
              background: "transparent",
              border: 0,
              color: "#65a8ff",
              cursor: "pointer",
              padding: 0,
              fontSize: "14px",
            }}
          >
            Register
          </button>
        </p>
      </form>
    </div>
  );
};

export default Login;
