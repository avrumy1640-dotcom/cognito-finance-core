import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, MailX, CheckCircle2, AlertCircle } from "lucide-react";

type State = "loading" | "valid" | "invalid" | "already" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return setState("invalid");
        if (data?.reason === "already_unsubscribed") return setState("already");
        setState(data?.valid ? "valid" : "invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    setBusy(false);
    if (error) return setState("error");
    if (data?.reason === "already_unsubscribed") return setState("already");
    setState(data?.success ? "done" : "error");
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/60 backdrop-blur-xl p-8 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Checking your link…</p>
          </>
        )}

        {state === "valid" && (
          <>
            <MailX className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-xl font-semibold">Unsubscribe from emails?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You'll stop receiving non-essential emails from Glass Bank. Critical
              security and account notices will still be sent.
            </p>
            <Button className="mt-6 w-full" onClick={confirm} disabled={busy}>
              {busy ? "Unsubscribing…" : "Confirm unsubscribe"}
            </Button>
          </>
        )}

        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-xl font-semibold">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We won't send you any more marketing emails.
            </p>
          </>
        )}

        {state === "already" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Already unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This address has already been removed from our mailing list.
            </p>
          </>
        )}

        {(state === "invalid" || state === "error") && (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-xl font-semibold">
              {state === "invalid" ? "This link isn't valid" : "Something went wrong"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The unsubscribe link may have expired. You can manage email
              preferences from your notification settings.
            </p>
          </>
        )}

        <Link
          to="/"
          className="mt-6 inline-block text-xs text-muted-foreground underline underline-offset-4"
        >
          Back to Glass Bank
        </Link>
      </div>
    </main>
  );
}
