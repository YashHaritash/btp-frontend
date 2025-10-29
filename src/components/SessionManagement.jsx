import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";

const SessionManagement = () => {
  const [sessionId, setSessionId] = useState("");
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const navigate = useNavigate();

  const userId = localStorage.getItem("userId");

  useEffect(() => {
    if (!userId) {
      navigate("/login");
    } else {
      const fetchSessions = async () => {
        try {
          const token = localStorage.getItem("token");
          const response = await axios.get(
            `http://localhost:3000/session/getSessions/${userId}`,
            {
              headers: { Authorization: token },
              withCredentials: true,
            }
          );
          setSessions(response.data);
        } catch (error) {
          console.error("Error fetching sessions:", error);
        }
      };
      fetchSessions();
    }
  }, [userId]);

  const onCreateSession = async () => {
    console.log("Creating new session...");

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://localhost:3000/session/create",
        { creator: userId },
        {
          headers: { Authorization: token },
          withCredentials: true,
        }
      );

      const newSessionId = response.data.sessionId; // Correctly access the sessionId
      setSessionId(newSessionId); // Update the state with the new sessionId
      toast.success("Session created successfully!");
      navigate(`/editor/${newSessionId}`); // Navigate using the new sessionId
    } catch (error) {
      toast.error("Error creating session");
      console.log("Error creating session:", error);
    }
  };

  const handleJoinSession = async () => {
    try {
      const token = localStorage.getItem("token");
      const sessionResponse = await axios.get(
        `http://localhost:3000/session/details/${sessionId}`,
        {
          headers: { Authorization: token },
          withCredentials: true,
        }
      );

      const sessionDetails = sessionResponse.data;
      const uniqueParticipants = new Set(sessionDetails.participants);

      if (uniqueParticipants.size >= 10) {
        toast.error("Session is full. Maximum 10 users allowed.");
        return;
      }

      if (uniqueParticipants.has(userId)) {
        toast.error("You are already in this session.");
        return;
      }

      const response = await axios.post(
        "http://localhost:3000/session/join",
        { sessionId },
        {
          headers: { Authorization: token },
          withCredentials: true,
        }
      );
      console.log("Joined session:", response.data);
      toast.success("Joined session successfully!");
      navigate(`/editor/${sessionId}`);
    } catch (error) {
      toast.error("Error joining session");
      console.error("Error joining session:", error);
    }
  };

  const handleJoinExistingSession = async (sessionId) => {
    try {
      const token = localStorage.getItem("token");
      const sessionResponse = await axios.get(
        `http://localhost:3000/session/details/${sessionId}`,
        {
          headers: { Authorization: token },
          withCredentials: true,
        }
      );

      const sessionDetails = sessionResponse.data;
      const uniqueParticipants = new Set(sessionDetails.participants);

      if (uniqueParticipants.size >= 10) {
        toast.error("Session is full. Maximum 10 users allowed.");
        return;
      }

      if (uniqueParticipants.has(userId)) {
        toast.error("You are already in this session.");
        return;
      }

      const response = await axios.post(
        "http://localhost:3000/session/join",
        { sessionId },
        {
          headers: { Authorization: token },
          withCredentials: true,
        }
      );
      console.log("Joined session:", response.data);
      toast.success("Joined session successfully!");
      navigate(`/editor/${sessionId}`);
    } catch (error) {
      toast.error("Error joining session");
      console.error("Error joining session:", error);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center py-5"
      style={{
        background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
        minHeight: "100vh",
      }}
    >
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            <div
              className="card shadow-lg border-0"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                backdropFilter: "blur(10px)",
                borderRadius: "16px",
              }}
            >
              <div className="card-body p-4 p-md-5">
                <h2 className="text-center mb-4 text-white fw-bold">
                  Collaborative Session Hub
                </h2>

                {/* Create New Session Button */}
                <div className="mb-4">
                  <button
                    className="btn btn-primary w-100 py-3 position-relative overflow-hidden"
                    onClick={onCreateSession}
                    style={{
                      background: "linear-gradient(45deg, #6f42c1, #8250df)",
                      border: "none",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <i className="bi bi-plus-lg me-2"></i>
                    Create New Session
                  </button>
                </div>

                {/* Join Session Input Group */}
                <div className="mb-4">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control py-3"
                      placeholder="Enter Session ID"
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "white",
                      }}
                    />
                    <button
                      className="btn btn-primary px-4"
                      onClick={handleJoinSession}
                      style={{
                        background: "linear-gradient(45deg, #6f42c1, #8250df)",
                        border: "none",
                      }}
                    >
                      <i className="bi bi-arrow-right text-white"></i>
                    </button>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="mt-5">
                  <h3 className="text-white mb-4">
                    <i className="bi bi-layers me-2"></i>
                    Active Sessions
                  </h3>

                  <div className="session-list">
                    {sessions.length > 0 ? (
                      sessions.map((session) => (
                        <div
                          key={session._id}
                          className={`card mb-3 cursor-pointer ${
                            activeSession === session._id
                              ? "border-primary"
                              : ""
                          }`}
                          onClick={() => setActiveSession(session._id)}
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.08)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            transition: "all 0.3s ease",
                          }}
                        >
                          <div className="card-body d-flex justify-content-between align-items-center p-3">
                            <div>
                              <h6 className="mb-1 text-white">
                                Session {session.sessionId}
                              </h6>
                              <small className="text-muted">
                                3 participants
                              </small>
                            </div>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJoinExistingSession(session.sessionId);
                              }}
                              style={{
                                background:
                                  "linear-gradient(45deg, #6f42c1, #8250df)",
                                border: "none",
                              }}
                            >
                              Join
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        className="text-center p-4 rounded"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <p className="text-muted mb-0">
                          No active sessions available
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionManagement;
