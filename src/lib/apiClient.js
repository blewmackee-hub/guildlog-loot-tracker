"use client";

// Every POST/PUT/DELETE call in the app sends JSON and unwraps the
// same { error } shape the API routes return on failure (see
// src/lib/apiHelpers.js's errorResponse) - this is that one-liner
// instead of repeating fetch+json()+ok-check at every call site.
export async function postJSON(url, body, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
