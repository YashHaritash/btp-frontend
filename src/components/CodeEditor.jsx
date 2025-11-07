import React, { useState, useEffect, useRef } from "react";
import AceEditor from "react-ace";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";
import { toast } from "react-toastify";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/theme-monokai";
import axios from "axios";
import m from "ace-builds/src-noconflict/mode-javascript";
import ChatBox from "./ChatBox";
import styles from "./CodeEditorStyle";

const API_URL = "http://localhost:3000";
const SOCKET_URL = "http://localhost:3000";
const AI_SUGGESTION_URL = "http://127.0.0.1:8001";

const CodeEditor = () => {
  const [mySet, setMySet] = useState(new Set());
  const { sessionId } = useParams();
  const [code, setCode] = useState("");
  const [session, setSession] = useState(null);
  const [socket, setSocket] = useState(null);
  const [output, setOutput] = useState("");
  const [language, setLanguage] = useState("javascript"); // State for selected language
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [suggestionSocket, setSuggestionSocket] = useState(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const editorRef = useRef(null);

  // File system state
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [fileContents, setFileContents] = useState({});
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [newFileName, setNewFileName] = useState("");

  // Typing indicators state
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [typingTimeouts, setTypingTimeouts] = useState(new Map());
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  // File management functions
  const fetchFiles = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/session/${sessionId}/files`,
        {
          headers: { Authorization: token },
        }
      );
      setFiles(response.data.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "js":
      case "jsx":
      case "mjs":
        return "📜"; // JavaScript
      case "py":
        return "🐍"; // Python
      case "cpp":
      case "cc":
      case "cxx":
      case "c++":
        return "⚡"; // C++
      case "c":
      case "h":
        return "🔧"; // C
      case "java":
        return "☕"; // Java
      case "html":
      case "htm":
        return "🌐"; // HTML
      case "css":
        return "🎨"; // CSS
      case "json":
        return "📋"; // JSON
      case "md":
        return "📝"; // Markdown
      case "txt":
        return "📄"; // Text
      default:
        return "📄"; // Default file
    }
  };

  const getFileTemplate = (fileName) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "js":
      case "jsx":
        return 'console.log("Hello from ' + fileName + '");';
      case "py":
        return 'print("Hello from ' + fileName + '")';
      case "cpp":
      case "cc":
      case "cxx":
        return (
          '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from ' +
          fileName +
          '" << endl;\n    return 0;\n}'
        );
      case "c":
        return (
          '#include <stdio.h>\n\nint main() {\n    printf("Hello from ' +
          fileName +
          '\\n");\n    return 0;\n}'
        );
      case "java":
        const className = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
        return (
          "public class " +
          className +
          ' {\n    public static void main(String[] args) {\n        System.out.println("Hello from ' +
          fileName +
          '");\n    }\n}'
        );
      case "html":
        return (
          "<!DOCTYPE html>\n<html>\n<head>\n    <title>" +
          fileName +
          "</title>\n</head>\n<body>\n    <h1>Hello from " +
          fileName +
          "</h1>\n</body>\n</html>"
        );
      case "css":
        return (
          "/* Styles for " +
          fileName +
          " */\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}"
        );
      default:
        return "// Welcome to " + fileName;
    }
  };

  const createFile = async (fileName) => {
    try {
      const template = getFileTemplate(fileName);

      await axios.post(
        `${API_URL}/session/${sessionId}/files`,
        {
          fileName,
          content: template,
        },
        {
          headers: { Authorization: token },
        }
      );

      if (socket) {
        socket.emit("fileCreated", { sessionId, fileName });
      }

      await fetchFiles();
      setNewFileName("");

      // Auto-open the newly created file
      const newFile = { name: fileName };
      await openFile(newFile);
    } catch (error) {
      console.error("Error creating file:", error);
      toast.error("Error creating file");
    }
  };

  const deleteFile = async (fileName) => {
    try {
      await axios.delete(`${API_URL}/session/${sessionId}/files/${fileName}`, {
        headers: { Authorization: token },
      });

      if (socket) {
        socket.emit("fileDeleted", { sessionId, fileName });
      }

      // Remove from open tabs and file contents
      setOpenTabs((prev) => prev.filter((tab) => tab.name !== fileName));
      setFileContents((prev) => {
        const newContents = { ...prev };
        delete newContents[fileName];
        return newContents;
      });

      // Switch to another tab if this was active
      if (activeFile?.name === fileName) {
        const remainingTabs = openTabs.filter((tab) => tab.name !== fileName);
        if (remainingTabs.length > 0) {
          openFile(remainingTabs[0]);
        } else {
          setActiveFile(null);
          setCode("");
        }
      }

      fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Error deleting file");
    }
  };

  const openFile = async (file) => {
    try {
      // Automatically set language based on file extension
      const detectedLanguage = getLanguageFromFileName(file.name);
      setLanguage(detectedLanguage);

      // If file content is already cached, use it
      if (fileContents[file.name]) {
        setActiveFile(file);
        setCode(fileContents[file.name]);
      } else {
        // Fetch file content from backend
        const response = await axios.get(
          `${API_URL}/session/${sessionId}/files/${file.name}`,
          {
            headers: { Authorization: token },
          }
        );

        const content = response.data.content || "";
        setFileContents((prev) => ({ ...prev, [file.name]: content }));
        setActiveFile(file);
        setCode(content);
      }

      // Add to open tabs if not already open
      if (!openTabs.find((tab) => tab.name === file.name)) {
        setOpenTabs((prev) => [...prev, file]);
      }
    } catch (error) {
      console.error("Error opening file:", error);
      toast.error("Error opening file");
    }
  };

  const saveFile = async (fileName = activeFile?.name) => {
    if (!fileName) return;

    try {
      await axios.put(
        `${API_URL}/session/${sessionId}/files/${fileName}/content`,
        {
          content: code,
        },
        {
          headers: { Authorization: token },
        }
      );

      // Update cached content
      setFileContents((prev) => ({ ...prev, [fileName]: code }));

      if (socket) {
        socket.emit("fileContentChanged", {
          sessionId,
          fileName,
          content: code,
        });
      }

      toast.success(`${fileName} saved successfully!`);
    } catch (error) {
      console.error("Error saving file:", error);
      toast.error("Error saving file");
    }
  };

  const getLanguageFromFileName = (fileName) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "js":
      case "jsx":
      case "mjs":
        return "javascript";
      case "cpp":
      case "cc":
      case "cxx":
      case "c++":
        return "c_cpp";
      case "py":
      case "pyw":
        return "python";
      case "c":
      case "h":
        return "c";
      case "java":
        return "java";
      case "ts":
      case "tsx":
        return "typescript";
      case "php":
        return "php";
      case "rb":
        return "ruby";
      case "go":
        return "golang";
      case "rs":
        return "rust";
      case "html":
      case "htm":
        return "html";
      case "css":
        return "css";
      case "json":
        return "json";
      case "xml":
        return "xml";
      case "sql":
        return "sql";
      case "sh":
      case "bash":
        return "sh";
      default:
        return "javascript"; // Default to JavaScript for unknown extensions
    }
  };

  const closeTab = (fileName) => {
    setOpenTabs((prev) => prev.filter((tab) => tab.name !== fileName));

    if (activeFile?.name === fileName) {
      const remainingTabs = openTabs.filter((tab) => tab.name !== fileName);
      if (remainingTabs.length > 0) {
        openFile(remainingTabs[0]);
      } else {
        setActiveFile(null);
        setCode("");
        setLanguage("javascript"); // Reset to default language
      }
    }
  };

  const handleLeaveSession = async () => {
    try {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");
      console.log(userId);
      console.log(session._id);

      await fetch(`${API_URL}/session/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ sessionId: session._id, userId }),
      });
      toast.success("Left session successfully!");
      navigate("/");
    } catch (error) {
      toast.error("Error leaving session");
      console.error("Error leaving session:", error);
    }
  };

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);
        newSocket.emit("joinSession", sessionId);
        newSocket.on("code", (data) => {
          console.log("🔥 RAW SOCKET DATA RECEIVED:", data);

          // Handle both old format (string) and new format (object)
          let updatedCode, fileName, userName;

          if (typeof data === "string") {
            // Legacy format: just the code string
            updatedCode = data;
          } else if (typeof data === "object" && data.code) {
            // New format: object with code and fileName
            updatedCode = data.code;
            fileName = data.fileName;
            userName = data.userName;
          }

          console.log("🔄 PROCESSING UPDATE:", {
            updatedCode: updatedCode?.substring(0, 50) + "...",
            fileName,
            userName,
            currentActiveFile: activeFile?.name,
          });

          // Always update the code if it's for the current file or no specific file
          if (!fileName || !activeFile || fileName === activeFile.name) {
            console.log("✅ UPDATING EDITOR CODE");
            setCode(updatedCode);
          }

          // Update file content cache
          if (fileName) {
            setFileContents((prev) => ({
              ...prev,
              [fileName]: updatedCode,
            }));
          }

          // Show who made the change
          if (userName) {
            console.log(`👤 ${userName} made changes`);
          }
        });

        // File system socket events
        newSocket.on("fileCreated", ({ fileName }) => {
          fetchFiles();
          toast.info(`File ${fileName} was created`);
        });

        newSocket.on("fileDeleted", ({ fileName }) => {
          fetchFiles();
          toast.info(`File ${fileName} was deleted`);
        });

        newSocket.on(
          "fileContentChanged",
          ({ fileName, content, userName }) => {
            console.log("📁 FILE CONTENT CHANGED:", {
              fileName,
              contentLength: content?.length,
              userName,
            });

            // Update file content cache
            setFileContents((prev) => ({ ...prev, [fileName]: content }));

            // If this is the currently active file, update the editor
            if (activeFile?.name === fileName) {
              console.log("✅ UPDATING ACTIVE FILE:", fileName);
              setCode(content);
            }

            // Show notification about who made the change
            // if (userName) {
            //   toast.info(`${userName} updated ${fileName}`, {
            //     autoClose: 2000,
            //   });
            // }
          }
        );

        // Handle typing events for concurrent typing indicators
        newSocket.on("userTyping", ({ userName }) => {
          console.log("User typing:", userName);

          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            newSet.add(userName);
            return newSet;
          });

          // Clear existing timeout for this user
          setTypingTimeouts((prev) => {
            const newTimeouts = new Map(prev);
            if (newTimeouts.has(userName)) {
              clearTimeout(newTimeouts.get(userName));
            }

            // Set new timeout to remove user after 3 seconds of no typing
            const timeoutId = setTimeout(() => {
              setTypingUsers((currentUsers) => {
                const updatedSet = new Set(currentUsers);
                updatedSet.delete(userName);
                return updatedSet;
              });

              setTypingTimeouts((currentTimeouts) => {
                const updatedTimeouts = new Map(currentTimeouts);
                updatedTimeouts.delete(userName);
                return updatedTimeouts;
              });
            }, 3000);

            newTimeouts.set(userName, timeoutId);
            return newTimeouts;
          });
        });

        newSocket.on("userStoppedTyping", ({ userName }) => {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            newSet.delete(userName);
            return newSet;
          });

          setTypingTimeouts((prev) => {
            const newTimeouts = new Map(prev);
            if (newTimeouts.has(userName)) {
              clearTimeout(newTimeouts.get(userName));
              newTimeouts.delete(userName);
            }
            return newTimeouts;
          });
        });

        // Store the last typing timestamp for each user
        const typingTimestamps = new Map();

        newSocket.on("name", (name) => {
          console.log("Name:", name);

          // Add the name to the set if it's not already there
          setMySet((prevSet) => {
            const newSet = new Set(prevSet);
            newSet.add(name);
            return newSet;
          });

          // Update the typing timestamp whenever the user types
          typingTimestamps.set(name, Date.now());

          // Periodically check for users who haven't typed in the last 5 seconds
          const intervalId = setInterval(() => {
            const currentTime = Date.now();

            typingTimestamps.forEach((timestamp, userName) => {
              // If the user hasn't typed in the last 5 seconds, remove them from the set
              if (currentTime - timestamp > 5000) {
                setMySet((prevSet) => {
                  const newSet = new Set(prevSet);
                  newSet.delete(userName);
                  return newSet;
                });
                typingTimestamps.delete(userName); // Remove user from timestamp tracking
              }
            });
          }, 5000);

          // Clear the interval when the socket disconnects or stops using typing signals
          newSocket.on("disconnect", () => {
            clearInterval(intervalId);
          });
        });

        const response = await axios.get(
          `${API_URL}/session/details/${sessionId}`,
          {
            headers: { Authorization: token },
            withCredentials: true,
          }
        );
        const sessionDetails = response.data;
        setSession(sessionDetails);

        // Fetch files for this session
        await fetchFiles();

        // Check if this is a new session (no files), create default JavaScript file
        const filesResponse = await axios.get(
          `${API_URL}/session/${sessionId}/files`,
          {
            headers: { Authorization: token },
          }
        );

        if (
          !filesResponse.data.files ||
          filesResponse.data.files.length === 0
        ) {
          // Create default JavaScript file for new sessions
          try {
            await axios.post(
              `${API_URL}/session/${sessionId}/files`,
              {
                fileName: "main.js",
                content: 'console.log("Hello");',
              },
              {
                headers: { Authorization: token },
              }
            );

            // Refresh files list and open the default file
            await fetchFiles();

            // Auto-open the default file
            const defaultFile = { name: "main.js" };
            await openFile(defaultFile);
          } catch (error) {
            console.error("Error creating default file:", error);
          }
        }

        // Legacy: Load the main code file (for backward compatibility)
        try {
          const codeResponse = await axios.get(
            `${API_URL}/code/getCode/${sessionDetails._id}`,
            {
              headers: { Authorization: token },
              withCredentials: true,
            }
          );
          // Only set legacy code if no files are open
          if (!activeFile && openTabs.length === 0) {
            setCode(codeResponse.data.code);
          }
        } catch (error) {
          console.log("Legacy code not found, using file system");
        }
      } catch (error) {
        console.error("Error fetching session data:", error);
      }
    };

    fetchSessionData();

    return () => {
      // Cleanup all timeouts
      typingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      if (socket) {
        socket.disconnect();
      }
      if (suggestionSocket) {
        suggestionSocket.close();
      }
    };
  }, [sessionId, token, activeFile]); // Add activeFile to dependencies

  const handleCodeChange = (newCode) => {
    console.log("📝 CODE CHANGE FROM USER:", newCode.substring(0, 50) + "...");

    setCode(newCode);

    // Update file content cache
    if (activeFile) {
      setFileContents((prev) => ({ ...prev, [activeFile.name]: newCode }));
    }

    const name = localStorage.getItem("name");
    if (socket && name) {
      console.log("📤 EMITTING CODE CHANGE:", {
        fileName: activeFile?.name,
        codeLength: newCode.length,
        userName: name,
      });

      // Emit code change
      socket.emit("code", {
        sessionId,
        code: newCode,
        name,
        fileName: activeFile?.name,
      });

      // Emit typing indicator
      socket.emit("userTyping", {
        sessionId,
        userName: name,
      });
    }

    // Get AI suggestion with debouncing
    if (newCode.trim().length >= 3) {
      debounceGetSuggestion(newCode);
    } else {
      setAiSuggestion("");
      setShowSuggestion(false);
    }
  };

  // Debounce function for AI suggestions
  const debounceGetSuggestion = (() => {
    let timeoutId;
    return (code) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        getAISuggestion(code);
      }, 500); // Further reduced to 0.5 seconds for even faster suggestions
    };
  })();

  // AI Suggestion function
  const getAISuggestion = async (code) => {
    try {
      // Use the AI suggestion WebSocket URL directly
      const ws = new WebSocket(`ws://127.0.0.1:8001/ws/ai/suggest`);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            code: code,
            language: language === "c_cpp" ? "cpp" : language,
          })
        );
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.suggestion) {
          // Try to parse the suggestion if it's JSON, otherwise use as is
          let actualSuggestion = data.suggestion;
          try {
            // If the suggestion itself is a JSON string, parse it
            const parsed = JSON.parse(data.suggestion);
            if (parsed.suggested_code) {
              actualSuggestion = parsed.suggested_code;
            } else if (typeof parsed === "string") {
              actualSuggestion = parsed;
            }
          } catch (e) {
            // If it's not valid JSON, check if it contains JSON-like structure
            const match = data.suggestion.match(
              /"suggested_code"\s*:\s*"([^"]+)"/
            );
            if (match) {
              actualSuggestion = match[1]
                .replace(/\\n/g, "\n")
                .replace(/\\"/g, '"');
            } else {
              // Use the suggestion as is
              actualSuggestion = data.suggestion;
            }
          }

          // Only show suggestion if there's actual meaningful code
          const trimmedSuggestion = actualSuggestion
            ? actualSuggestion.trim()
            : "";
          const isEmpty =
            !trimmedSuggestion ||
            trimmedSuggestion === '""' ||
            trimmedSuggestion === "''" ||
            trimmedSuggestion === "{}" ||
            trimmedSuggestion === "[]" ||
            trimmedSuggestion === "null" ||
            trimmedSuggestion === "undefined" ||
            trimmedSuggestion.length < 1;

          if (!isEmpty && trimmedSuggestion.length > 0) {
            setAiSuggestion(trimmedSuggestion);
            setShowSuggestion(true);
            console.log("✅ Showing suggestion:", trimmedSuggestion);
          } else {
            console.log(
              "❌ No meaningful suggestion, hiding panel. Received:",
              trimmedSuggestion
            );
            setShowSuggestion(false);
            setAiSuggestion("");
          }
        } else if (data.error) {
          console.error("AI Suggestion error:", data.error);
        }
        ws.close();
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };
    } catch (error) {
      console.error("Error getting AI suggestion:", error);
    }
  };

  const handleRunCode = async () => {
    // Save current file before running
    if (activeFile) {
      await saveFile();
    }
    // Route execution to the backend for each language. Include all open files as `allFiles`.
    if (language === "c_cpp") {
      try {
        const response = await axios.post(`${API_URL}/run-cpp`, {
          code,
          fileName: activeFile?.name || "main.cpp",
          allFiles: fileContents,
        });
        setOutput(response.data.output || "No output");
      } catch (error) {
        setOutput(error.response?.data?.error || "Error running code");
      }
    } else if (language === "javascript") {
      // Send JS execution to backend instead of running in the browser
      try {
        const response = await axios.post(`${API_URL}/run-javascript`, {
          code,
          fileName: activeFile?.name || "main.js",
          sessionId,
          allFiles: fileContents,
        });
        setOutput(response.data.output || "No output");
      } catch (error) {
        setOutput(error.response?.data?.error || "Error running code");
      }
    } else if (language === "python") {
      try {
        const response = await axios.post(`${API_URL}/run-python`, {
          code,
          fileName: activeFile?.name || "main.py",
          allFiles: fileContents,
        });
        setOutput(response.data.output || "No output");
      } catch (error) {
        setOutput(error.response?.data?.error || "Error running code");
      }
    } else if (language === "c") {
      try {
        const response = await axios.post(`${API_URL}/run-c`, {
          code,
          fileName: activeFile?.name || "main.c",
          allFiles: fileContents,
        });
        setOutput(response.data.output || "No output");
      } catch (error) {
        setOutput(error.response?.data?.error || "Error running code");
      }
    } else if (language === "java") {
      try {
        const response = await axios.post(`${API_URL}/run-java`, {
          code,
          fileName: activeFile?.name || "Main.java",
          allFiles: fileContents,
        });
        setOutput(response.data.output || "No output");
      } catch (error) {
        setOutput(error.response?.data?.error || "Error running code");
      }
    } else {
      setOutput("Run functionality for this language is not implemented yet.");
    }
  };

  const handleSave = async () => {
    if (activeFile) {
      await saveFile();
    } else {
      // Legacy save for backward compatibility
      try {
        await axios.put(
          `${API_URL}/code/update/${session._id}`,
          { code },
          {
            headers: { Authorization: token },
            withCredentials: true,
          }
        );
        toast.success("Code saved successfully!");
      } catch (error) {
        console.error("Error saving code:", error);
        toast.error("Error saving code. Please try again.");
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        toast.success("Code copied to clipboard!");
      })
      .catch((err) => {
        console.error("Error copying code:", err);
        toast.error("Failed to copy code. Please try again.");
      });
  };

  const numberOfTypingUsers = typingUsers.size;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#1a202c",
      }}
    >
      {/* Top Navigation Bar - Always visible */}
      <div
        style={{
          backgroundColor: "#2d3748",
          padding: "10px 20px",
          borderBottom: "1px solid #4a5568",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 1000,
          minHeight: "60px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <ChatBox sessionId={sessionId} />

          {/* Typing Indicators - Moved to top bar for prominence */}
          {numberOfTypingUsers > 0 && (
            <div
              style={{
                marginLeft: "20px",
                display: "flex",
                alignItems: "center",
                backgroundColor: "#4a5568",
                padding: "4px 12px",
                borderRadius: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                {Array.from(typingUsers).map((name, index) => (
                  <span
                    key={name}
                    className="badge me-1"
                    style={{
                      backgroundColor: "#48bb78",
                      color: "white",
                      fontSize: "10px",
                      animation: "pulse 1.5s infinite",
                    }}
                  >
                    {name}
                  </span>
                ))}
                <span
                  style={{
                    color: "#e2e8f0",
                    fontSize: "11px",
                    marginLeft: "8px",
                    fontStyle: "italic",
                  }}
                >
                  {numberOfTypingUsers === 1 ? "is typing..." : "are typing..."}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="d-flex justify-content-center align-items-center">
          <button
            type="button"
            className="btn btn-primary my-1 px-4 me-2"
            onClick={() => {
              navigator.clipboard
                .writeText(sessionId)
                .then(() => {
                  toast.success("Session Id copied to clipboard!");
                })
                .catch((err) => {
                  console.error("Error copying session id:", err);
                  toast.error("Failed to copy session id. Please try again.");
                });
            }}
            style={{
              backgroundColor: "#4299e1",
              borderColor: "#4299e1",
            }}
          >
            Session Id - {sessionId}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleLeaveSession}
          >
            ✕ Leave
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: "flex", flex: 1, backgroundColor: "#1a202c" }}>
        {/* File Explorer Sidebar */}
        {showFileExplorer && (
          <div
            style={{
              width: "250px",
              backgroundColor: "#1a202c",
              borderRight: "1px solid #4a5568",
              padding: "10px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <h6 style={{ color: "#e2e8f0", margin: 0 }}>Files</h6>
              <button
                onClick={() => setShowFileExplorer(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#a0aec0",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                ←
              </button>
            </div>

            {/* New File Input */}
            <div style={{ marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="New file name (e.g., script.js, main.py, app.cpp)..."
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && newFileName.trim()) {
                    createFile(newFileName.trim());
                  }
                }}
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  backgroundColor: "#2d3748",
                  border: "1px solid #4a5568",
                  borderRadius: "4px",
                  color: "#e2e8f0",
                  fontSize: "12px",
                }}
              />
              {newFileName.trim() && (
                <div style={{ marginTop: "4px", display: "flex", gap: "4px" }}>
                  <button
                    onClick={() => createFile(newFileName.trim())}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      backgroundColor: "#48bb78",
                      border: "none",
                      borderRadius: "4px",
                      color: "white",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {getFileIcon(newFileName.trim())} Create
                  </button>
                </div>
              )}
              {/* Quick file type buttons */}
              <div
                style={{
                  marginTop: "6px",
                  display: "flex",
                  gap: "4px",
                  flexWrap: "wrap",
                }}
              >
                {[
                  { ext: ".js", icon: "📜", label: "JS" },
                  { ext: ".py", icon: "🐍", label: "Python" },
                  { ext: ".cpp", icon: "⚡", label: "C++" },
                  { ext: ".java", icon: "☕", label: "Java" },
                ].map(({ ext, icon, label }) => (
                  <button
                    key={ext}
                    onClick={() => {
                      const baseName = newFileName.trim() || "untitled";
                      const nameWithoutExt = baseName.includes(".")
                        ? baseName.substring(0, baseName.lastIndexOf("."))
                        : baseName;
                      setNewFileName(nameWithoutExt + ext);
                    }}
                    style={{
                      padding: "2px 6px",
                      backgroundColor: "#4a5568",
                      border: "none",
                      borderRadius: "3px",
                      color: "#e2e8f0",
                      fontSize: "10px",
                      cursor: "pointer",
                    }}
                    title={`Create ${label} file`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* File List */}
            <div>
              {files.map((file) => (
                <div
                  key={file.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "4px 8px",
                    margin: "2px 0",
                    backgroundColor:
                      activeFile?.name === file.name
                        ? "#4a5568"
                        : "transparent",
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: "#e2e8f0",
                    fontSize: "12px",
                  }}
                  onClick={() => openFile(file)}
                >
                  <span>
                    {getFileIcon(file.name)} {file.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete ${file.name}?`)) {
                        deleteFile(file.name);
                      }
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#f56565",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Editor Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#1a202c",
          }}
        >
          {/* File Explorer Toggle (when hidden) */}
          {!showFileExplorer && (
            <div style={{ padding: "10px" }}>
              <button
                onClick={() => setShowFileExplorer(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#a0aec0",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                → Show Files
              </button>
            </div>
          )}

          {/* File Tabs */}
          {openTabs.length > 0 && (
            <div
              style={{
                backgroundColor: "#1a202c",
                padding: "0 10px",
                display: "flex",
                overflowX: "auto",
                borderBottom: "1px solid #4a5568",
              }}
            >
              {openTabs.map((tab) => (
                <div
                  key={tab.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    margin: "0 2px",
                    backgroundColor:
                      activeFile?.name === tab.name ? "#4a5568" : "#2d3748",
                    borderTopLeftRadius: "4px",
                    borderTopRightRadius: "4px",
                    cursor: "pointer",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => openFile(tab)}
                >
                  <span>
                    {getFileIcon(tab.name)} {tab.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.name);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#a0aec0",
                      cursor: "pointer",
                      fontSize: "12px",
                      marginLeft: "8px",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Editor Container */}
          <div style={{ flex: 1, padding: "10px", backgroundColor: "#1a202c" }}>
            {/* Current file info */}
            {activeFile && (
              <div className="mb-3">
                <span
                  className="badge me-2"
                  style={{
                    backgroundColor: "#4299e1",
                    color: "white",
                    fontSize: "12px",
                  }}
                >
                  {getFileIcon(activeFile.name)} {activeFile.name}
                </span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: "#48bb78",
                    color: "white",
                    fontSize: "12px",
                  }}
                >
                  {language.charAt(0).toUpperCase() + language.slice(1)}
                </span>
              </div>
            )}

            <AceEditor
              ref={editorRef}
              mode={language == "c" ? "c_cpp" : language}
              theme="monokai"
              value={code}
              onChange={handleCodeChange}
              name="code-editor"
              editorProps={{ $blockScrolling: true }}
              setOptions={{ useWorker: false }}
              width="100%"
              height="500px"
              style={styles.editor}
            />

            {/* AI Suggestion Panel */}
            {showSuggestion && aiSuggestion && (
              <div
                style={{
                  position: "relative",
                  backgroundColor: "#2d3748",
                  border: "1px solid #4a5568",
                  borderRadius: "8px",
                  padding: "12px",
                  margin: "10px 0",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <h5 style={{ color: "#48bb78", margin: 0, fontSize: "14px" }}>
                    🤖 AI Suggestion
                  </h5>
                  <button
                    onClick={() => setShowSuggestion(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#a0aec0",
                      cursor: "pointer",
                      fontSize: "16px",
                    }}
                  >
                    ✕
                  </button>
                </div>
                <pre
                  style={{
                    color: "#e2e8f0",
                    fontSize: "12px",
                    lineHeight: "1.4",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                  }}
                >
                  {aiSuggestion}
                </pre>
                <div style={{ marginTop: "8px" }}>
                  <button
                    onClick={() => {
                      if (editorRef.current) {
                        const editor = editorRef.current.editor;
                        const cursor = editor.getCursorPosition();

                        // Insert suggestion at current cursor position (same line)
                        editor.session.insert(cursor, aiSuggestion);

                        // Move cursor to the end of the inserted text
                        const newCursor = {
                          row: cursor.row,
                          column: cursor.column + aiSuggestion.length,
                        };
                        editor.moveCursorToPosition(newCursor);
                        editor.focus();
                      } else {
                        // Fallback to the old method if ref is not available
                        setCode(code + aiSuggestion);
                      }
                      setShowSuggestion(false);
                    }}
                    style={{
                      backgroundColor: "#48bb78",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "12px",
                      cursor: "pointer",
                      marginRight: "8px",
                    }}
                  >
                    Apply Suggestion
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(aiSuggestion);
                      toast.success("Suggestion copied to clipboard!");
                    }}
                    style={{
                      backgroundColor: "#4299e1",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <div style={styles.buttonContainer}>
              <button onClick={handleRunCode} style={styles.runButton}>
                Run Code
              </button>
              <button onClick={handleSave} style={styles.saveButton}>
                Save
              </button>
              <button
                onClick={handleCopy}
                style={styles.copyButton}
                className="mx-2"
              >
                Copy Code
              </button>
            </div>

            <div
              style={{ ...styles.outputContainer, backgroundColor: "#2d3748" }}
            >
              <h4 style={{ ...styles.outputHeader, color: "#e2e8f0" }}>
                Output:
              </h4>
              <pre
                style={{
                  ...styles.output,
                  color: "#e2e8f0",
                  backgroundColor: "#1a202c",
                }}
              >
                {output}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

// export default styles;

export default CodeEditor;
