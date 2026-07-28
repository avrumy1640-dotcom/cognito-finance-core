import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, AlertTriangle } from "lucide-react";

// Local typed wrapper around the beta supabase.auth.oauth namespace.
type OAuthResult = { data: any; error: { message: string } | null };
const oauth = () => (supabase.auth as any).oauth as {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in the request URL.");
        setLoading(false);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect URL was returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <div className="text-muted-foreground text-sm">Loading authorization…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Could not load this request</h1>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an external app";
  const redirectUri: string | undefined = details?.client?.redirect_uri ?? details?.client?.redirect_uris?.[0];
  const scopes: string[] = Array.isArray(details?.scopes)
    ? details.scopes
    : typeof details?.scope === "string"
    ? details.scope.split(" ").filter(Boolean)
    : [];

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-lg space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Connect {clientName} to Glass Bank</h1>
            <p className="text-xs text-muted-foreground">
              This lets {clientName} use Glass Bank as you.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm space-y-2">
          <div className="font-medium">{clientName} will be able to:</div>
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" /> Call Glass Bank's enabled tools while you are signed in.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" /> Read your profile, KYC status, beneficiaries, payment requests, scheduled transfers, and support tickets.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" /> Create payment requests and support tickets on your behalf.</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-1">
            This does not bypass Glass Bank's permissions or backend policies. All actions still run under your account.
          </p>
        </div>

        {redirectUri && (
          <div className="text-xs text-muted-foreground">
            Redirects to: <code className="text-foreground/80">{redirectUri}</code>
          </div>
        )}
        {scopes.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Requested scopes: <code>{scopes.join(" ")}</code>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy ? "Working…" : "Approve"}
          </Button>
        </div>
      </div>
    </main>
  );
};

export default OAuthConsent;
