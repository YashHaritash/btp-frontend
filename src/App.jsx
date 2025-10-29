import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import About from "./components/About";
import SessionManagement from "./components/SessionManagement";
import CodeEditor from "./components/CodeEditor";
import Login from "./components/Login";
import Signup from "./components/Signup";
import { ToastContainer } from "react-toastify";
import ForgetPassword from "./components/ForgetPassword";

function App() {
  // Define onCreateSession function in App.js
  const onCreateSession = () => {
    // Logic for creating a new session
    console.log("Creating new session...");
  };

  return (
    <Router>
      <NavBar />
      <Routes>
        <Route
          path="/"
          element={<SessionManagement onCreateSession={onCreateSession} />}
        />
        <Route path="/login" element={<Login />} />
        <Route path="/reset" element={<ForgetPassword />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/about" element={<About />} />
        <Route path="/editor/:sessionId" element={<CodeEditor />} />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;
