import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const ForgetPassword = () => {
  const [email, setEmail] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);

  const navigate = useNavigate();

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Email:", email);
    try {
      const payload = { email };
      const response = await fetch(
        `http://localhost:3000/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      console.log(data);
      toast.success("Password reset link sent to your email!");
      navigate("/login");
    } catch (error) {
      toast.error("Error sending reset link");
      console.log(error);
    }
  };

  const lightTheme = {
    backgroundColor: "#f8f9fa",
    color: "#000",
  };

  const darkTheme = {
    backgroundColor: "#121212",
    color: "#e0e0e0",
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{
        height: "calc(100vh - 56px)", // Assuming navbar height is 60px
        ...theme,
      }}
    >
      <div
        className="card p-4"
        style={{
          width: "300px",
          backgroundColor: isDarkMode ? "#1e1e1e" : "#fff",
          color: theme.color,
        }}
      >
        <h2 className="text-center mb-4">Forgot Password</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <input
              type="email"
              className="form-control"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                backgroundColor: isDarkMode ? "gray" : "#fff",
                color: theme.color,
              }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100"
            style={{
              backgroundColor: isDarkMode ? "#bb86fc" : "#007bff",
              borderColor: isDarkMode ? "#bb86fc" : "#007bff",
            }}
          >
            Submit
          </button>
        </form>
        <div className="mt-3 text-center">
          <p>
            Remembered your password?{" "}
            <Link
              to="/login"
              style={{ color: isDarkMode ? "#bb86fc" : "#007bff" }}
            >
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;
