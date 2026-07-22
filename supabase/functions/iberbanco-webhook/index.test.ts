// Signature verification unit tests for iberbanco-webhook.
// Covers: valid, missing, malformed, wrong-secret, and replayed (stale timestamp) signatures.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifySignature } from "./index.ts";

const SECRET = "test-secret-do-not-use-in-prod";

async function sign(secret: string, body: string, ts: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const body = JSON.stringify({ event_id: "evt_1", event_type: "transfer.completed" });

Deno.test("accepts a valid, fresh signature", async () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await sign(SECRET, body, ts);
  const r = await verifySignature(body, sig, ts, SECRET);
  assertEquals(r.ok, true);
});

Deno.test("rejects missing signature header", async () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const r = await verifySignature(body, null, ts, SECRET);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 401);
});

Deno.test("rejects missing timestamp header", async () => {
  const sig = await sign(SECRET, body, "1");
  const r = await verifySignature(body, sig, null, SECRET);
  assertEquals(r.ok, false);
});

Deno.test("rejects malformed hex signature", async () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const r = await verifySignature(body, "not-hex-!!!", ts, SECRET);
  assertEquals(r.ok, false);
});

Deno.test("rejects signature computed with wrong secret", async () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await sign("wrong-secret", body, ts);
  const r = await verifySignature(body, sig, ts, SECRET);
  assertEquals(r.ok, false);
});

Deno.test("rejects tampered body (signature no longer matches)", async () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await sign(SECRET, body, ts);
  const r = await verifySignature(body + "tampered", sig, ts, SECRET);
  assertEquals(r.ok, false);
});

Deno.test("rejects stale timestamp (replay guard, >5m old)", async () => {
  const ts = (Math.floor(Date.now() / 1000) - 600).toString();
  const sig = await sign(SECRET, body, ts);
  const r = await verifySignature(body, sig, ts, SECRET);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.message.includes("stale"), true);
});

Deno.test("rejects far-future timestamp (clock skew abuse)", async () => {
  const ts = (Math.floor(Date.now() / 1000) + 600).toString();
  const sig = await sign(SECRET, body, ts);
  const r = await verifySignature(body, sig, ts, SECRET);
  assertEquals(r.ok, false);
});

Deno.test("rejects non-numeric timestamp", async () => {
  const sig = await sign(SECRET, body, "abc");
  const r = await verifySignature(body, sig, "abc", SECRET);
  assertEquals(r.ok, false);
});
