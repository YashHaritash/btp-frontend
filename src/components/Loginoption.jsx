import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";

function Loginoption() {
  // Capitalize the first letter of each word in a string
  function capitalize(str) {
    if (!str) return ""; // Return empty string if input is falsy
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  const navigate = useNavigate();

  // Handle logout action
  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    localStorage.removeItem("userId");
    toast.success("Logged out successfully!");
    navigate("/login");
  };

  const token = localStorage.getItem("token");
  const name = localStorage.getItem("name");

  return token ? (
    <>
      <div className="mx-2">
        <span className="text-white">Hello </span>
        <span className="text-limegreen">{capitalize(name)}</span>
      </div>
      <button
        type="button"
        className="btn btn-outline-danger mx-2 border-2"
        onClick={handleSignOut}
      >
        LogOut
      </button>
    </>
  ) : (
    <>
      <Link
        type="button"
        className="btn btn-outline-warning mx-1 border-2"
        to="/signup"
      >
        SignUp
      </Link>
      <Link
        type="button"
        className="btn btn-outline-info mx-1 border-2"
        to="/login"
      >
        Login
      </Link>
    </>
  );
}

export default Loginoption;
