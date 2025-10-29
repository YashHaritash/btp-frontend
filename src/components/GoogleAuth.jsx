import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";

function GoogleAuth() {
  const navigate = useNavigate();
  const handleSuccess = async (response) => {
    console.log(response);
    const token = response.credential;

    let user = await fetch("http://localhost:3000/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await user.json();

    if (data) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("name", data.name);
      localStorage.setItem("userId", data.id);
      navigate("/");
    }
  };

  return (
    <div className="mx-auto my-3">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => {
          console.log("Login Failed");
        }}
      />
    </div>
  );
}

export default GoogleAuth;
