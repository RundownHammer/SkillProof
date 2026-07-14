"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Home() {
  const { getToken } = useAuth();
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/institutes?page=1&limit=10");
  const [body, setBody] = useState("");
  const [result, setResult] = useState("");

  async function callApi() {
    const token = await getToken();
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : body,
    });
    const text = await res.text();
    setResult(`${res.status}\n${text}`);
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Skill Credentialing System</h1>

      <SignedOut>
        <SignInButton mode="modal" />
        <SignUpButton mode="modal" />
      </SignedOut>

      <SignedIn>
        <UserButton />
        <h2>API tester</h2>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>GET</option>
            <option>POST</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
          <input style={{ flex: 1 }} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/institutes" />
        </div>
        <textarea
          style={{ width: "100%", height: "80px" }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder='{"name": "Test Institute", "code": "INST-TEST-001"}'
        />
        <div><button onClick={callApi}>Send</button></div>
        <pre>{result}</pre>
      </SignedIn>
    </main>
  );
}
