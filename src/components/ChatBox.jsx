import React, { useState, useEffect } from "react";
import { BsChatDots, BsMicFill } from "react-icons/bs";
import io from "socket.io-client";

const socket = io("http://localhost:3000", {
  transports: ["websocket"],
  withCredentials: true,
});

const ChatBox = ({ sessionId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const name = localStorage.getItem("name") || "Anonymous";

  useEffect(() => {
    if (!sessionId) return;

    socket.emit("joinSession", sessionId);

    socket.on("chat", (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    return () => {
      socket.off("chat");
    };
  }, [sessionId]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const sendMessage = () => {
    if (message.trim() === "" || !sessionId) return;

    const chatMessage = { name, message, type: "text", sessionId };
    socket.emit("chat", chatMessage);

    setMessage("");
  };

  // 🎤 Start Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      let chunks = [];

      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64Audio = reader.result; // Converts to Base64
          const audioMessage = {
            name,
            message: base64Audio,
            type: "audio",
            sessionId,
          };
          socket.emit("chat", audioMessage);
        };
      };

      setMediaRecorder(recorder);
      recorder.start();
      setRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  // 🛑 Stop Recording
  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-primary position-fixed d-flex align-items-center justify-content-center rounded-circle"
        style={{
          bottom: "10px",
          right: "20px",
          zIndex: 1050,
          width: "50px",
          height: "50px",
          padding: 0,
        }}
        onClick={toggleChat}
      >
        <BsChatDots size={24} />
      </button>

      <div
        className="position-fixed bg-dark text-white p-3 shadow-lg"
        style={{
          width: "300px",
          height: "400px",
          bottom: "80px",
          right: isOpen ? "20px" : "-320px",
          transition: "right 0.3s ease-in-out",
          zIndex: 1049,
          borderRadius: "10px",
        }}
      >
        <h5>Chat</h5>
        <div
          className="border p-2 bg-light text-dark"
          style={{ height: "300px", overflowY: "auto" }}
        >
          {messages.map((msg, index) => (
            <div key={index} className="mb-2">
              <strong>{msg.name}:</strong>{" "}
              {msg.type === "audio" &&
              msg.message.startsWith("data:audio/webm") ? (
                <audio controls>
                  <source src={msg.message} type="audio/webm" />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                msg.message
              )}
            </div>
          ))}
        </div>

        <div className="d-flex mt-2">
          <input
            type="text"
            className="form-control"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button className="btn btn-success ms-2" onClick={sendMessage}>
            Send
          </button>
        </div>

        <div className="d-flex mt-2">
          <button
            className={`btn ${
              recording ? "btn-danger" : "btn-secondary"
            } w-100`}
            onClick={recording ? stopRecording : startRecording}
          >
            <BsMicFill size={20} />{" "}
            {recording ? "Stop Recording" : "Record Audio"}
          </button>
        </div>
      </div>
    </>
  );
};

export default ChatBox;
