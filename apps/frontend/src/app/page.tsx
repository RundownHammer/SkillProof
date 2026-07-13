"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TEST_ROUTES = [
  "any-authenticated",
  "super-admin",
  "ncvet-admin",
  "institute-admin",
  "student",
  "employer",
  "verifier",
];

export default function Home() {
  const { getToken } = useAuth();
  const [result, setResult] = useState("");

  async function callRoute(path: string) {
    const token = await getToken();
    const res = await fetch(`${API_URL}/test/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    setResult(`${res.status} — ${JSON.stringify(body)}`);
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
        <h2>Test protected routes</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {TEST_ROUTES.map((path) => (
            <button key={path} onClick={() => callRoute(path)}>
              {path}
            </button>
          ))}
        </div>
        <pre>{result}</pre>
      </SignedIn>
    </main>
  );
}