// Placeholder — this "function" exists only to host RLS integration tests
// under supabase/functions/rls-tests/. It is not intended to be invoked.
Deno.serve(() => new Response("rls-tests: test host", { status: 404 }));
