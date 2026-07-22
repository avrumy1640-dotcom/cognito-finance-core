// RLS integration tests — exercise policies through PostgREST as anon and as real
// authenticated users. Verifies the recently hardened tables: trusted_devices,
// webhook_events, profiles, user_roles.
//
// Runs inside the edge-function Deno runtime so SUPABASE_SERVICE_ROLE_KEY is
// available. Creates two ephemeral users, runs assertions, deletes them.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });

async function makeUser(): Promise<{ id: string; client: SupabaseClient }> {
  const email = `rlstest+${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !data.user) throw new Error("createUser: " + error?.message);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error("signIn: " + signInErr.message);
  return { id: data.user.id, client };
}

async function cleanup(ids: string[]) {
  for (const id of ids) {
    await admin.from("trusted_devices").delete().eq("user_id", id);
    await admin.from("profiles").delete().eq("user_id", id);
    await admin.from("user_roles").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

Deno.test("RLS: anon cannot read or write hardened tables", async () => {
  const td = await anonClient.from("trusted_devices").select("*");
  assert(td.error || (td.data ?? []).length === 0, "anon must not read trusted_devices");

  const we = await anonClient.from("webhook_events").select("*");
  assert(we.error || (we.data ?? []).length === 0, "anon must not read webhook_events");

  const p = await anonClient.from("profiles").select("*");
  assert(p.error || (p.data ?? []).length === 0, "anon must not read profiles");

  const insTd = await anonClient.from("trusted_devices").insert({
    user_id: "11111111-1111-1111-1111-111111111111", device_id: "d", label: "x",
  });
  assert(insTd.error, "anon must be blocked from inserting trusted_devices");

  const insWe = await anonClient.from("webhook_events").insert({
    provider: "x", event_type: "y", payload: {},
  });
  assert(insWe.error, "anon must be blocked from inserting webhook_events");

  const insRole = await anonClient.from("user_roles").insert({
    user_id: "11111111-1111-1111-1111-111111111111", role: "admin",
  });
  assert(insRole.error, "anon must be blocked from inserting user_roles");
});

Deno.test("RLS: trusted_devices — owner can CRUD own, cannot touch others", async () => {
  const alice = await makeUser();
  const bob = await makeUser();
  try {
    // Alice inserts her own device — allowed
    const ok = await alice.client.from("trusted_devices").insert({
      user_id: alice.id, device_id: "alice-phone", label: "Alice iPhone",
    }).select().single();
    assertEquals(ok.error, null);
    assert(ok.data?.id);

    // Alice attempts to insert a row owned by Bob — blocked
    const spoof = await alice.client.from("trusted_devices").insert({
      user_id: bob.id, device_id: "spoof", label: "Spoof",
    });
    assert(spoof.error, "must not allow inserting rows owned by another user");

    // Bob cannot see Alice's device
    const bobSees = await bob.client.from("trusted_devices").select("*").eq("device_id", "alice-phone");
    assertEquals(bobSees.data ?? [], []);

    // Bob's update against Alice's row silently affects 0 rows
    const bobUpd = await bob.client.from("trusted_devices")
      .update({ label: "hijack" }).eq("device_id", "alice-phone").select();
    assertEquals(bobUpd.data ?? [], []);

    // Bob's delete against Alice's row silently affects 0 rows
    const bobDel = await bob.client.from("trusted_devices")
      .delete().eq("device_id", "alice-phone").select();
    assertEquals(bobDel.data ?? [], []);

    // Alice's row is intact
    const check = await admin.from("trusted_devices").select("label").eq("device_id", "alice-phone").single();
    assertEquals(check.data?.label, "Alice iPhone");

    // Alice can delete her own row
    const aliceDel = await alice.client.from("trusted_devices").delete().eq("device_id", "alice-phone").select();
    assertEquals(aliceDel.data?.length, 1);
  } finally {
    await cleanup([alice.id, bob.id]);
  }
});

Deno.test("RLS: profiles — owner writes, others cannot", async () => {
  const alice = await makeUser();
  const bob = await makeUser();
  try {
    const insAlice = await alice.client.from("profiles").insert({
      user_id: alice.id, preferred_name: "Alice",
    }).select().single();
    assertEquals(insAlice.error, null);

    const spoof = await alice.client.from("profiles").insert({
      user_id: bob.id, preferred_name: "Fake",
    });
    assert(spoof.error, "must not insert profile for another user");

    const bobUpd = await bob.client.from("profiles")
      .update({ preferred_name: "hijack" }).eq("user_id", alice.id).select();
    assertEquals(bobUpd.data ?? [], []);

    const bobSees = await bob.client.from("profiles").select("*").eq("user_id", alice.id);
    assertEquals(bobSees.data ?? [], []);
  } finally {
    await cleanup([alice.id, bob.id]);
  }
});

Deno.test("RLS: user_roles — authenticated users cannot self-grant admin", async () => {
  const alice = await makeUser();
  try {
    const selfGrant = await alice.client.from("user_roles").insert({
      user_id: alice.id, role: "admin",
    });
    assert(selfGrant.error, "authenticated user must not be able to grant themselves admin");

    const grantOther = await alice.client.from("user_roles").insert({
      user_id: "22222222-2222-2222-2222-222222222222", role: "admin",
    });
    assert(grantOther.error, "authenticated user must not grant admin to others");
  } finally {
    await cleanup([alice.id]);
  }
});

Deno.test("RLS: webhook_events — non-admin authenticated user cannot read/write", async () => {
  const alice = await makeUser();
  try {
    const read = await alice.client.from("webhook_events").select("*");
    assertEquals(read.data ?? [], []);

    const ins = await alice.client.from("webhook_events").insert({
      provider: "iberbanco", event_type: "x", payload: {},
    });
    assert(ins.error, "non-admin must not insert webhook_events");

    const upd = await alice.client.from("webhook_events")
      .update({ status: "processed" }).eq("provider", "iberbanco").select();
    assertEquals(upd.data ?? [], []);
  } finally {
    await cleanup([alice.id]);
  }
});
