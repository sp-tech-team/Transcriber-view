import React from "react";
import GoogleSignIn from "./component/GoogleSignIn";

export default function Login() {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <GoogleSignIn />
    </div>
  );
}
