import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { signInWithIdentifier } from "@/lib/auth-login.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Music2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";


const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Vijana Brand" },
      { name: "description", content: "Sign in or create your Vijana Brand account to upload, like, follow and share music." },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(80),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores"),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),

});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: search.redirect ?? "/", replace: true });
    }
  }, [loading, user, navigate, search.redirect]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero opacity-30" />
      <div className="absolute inset-0 bg-gradient-glow" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
        <div className="w-full rounded-3xl border border-border bg-card/80 backdrop-blur-xl p-6 sm:p-8 shadow-elevated">
          <Link to="/" className="mb-6 inline-flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <Music2 className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight text-gradient">Vijana Brand</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Discover · Listen · Share</div>
            </div>
          </Link>

          <div className="mb-6 grid grid-cols-2 rounded-full bg-secondary p-1">
            <button
              onClick={() => setMode("signin")}
              className={`rounded-full py-2 text-sm font-semibold transition ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`rounded-full py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>

          {mode === "signin" ? <SignInForm /> : <SignUpForm onDone={() => setMode("signin")} />}
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  id,
  autoComplete,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SignInForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const signIn = useServerFn(signInWithIdentifier);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const id = identifier.trim();
      if (!id) { toast.error("Enter your email or username."); return; }

      if (id.includes("@")) {
        const { error } = await supabase.auth.signInWithPassword({ email: id, password });
        if (error) { toast.error(error.message); return; }
      } else {
        const res = await signIn({ data: { identifier: id, password } });
        if (res.error || !res.session) { toast.error(res.error ?? "Invalid login credentials"); return; }
        const { error } = await supabase.auth.setSession(res.session);
        if (error) { toast.error(error.message); return; }
      }
      toast.success("Welcome back!");
    } catch {
      toast.error("Could not sign you in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    if (!identifier.trim() || !identifier.includes("@")) {
      toast.error("Enter your email address to reset your password.");
      return;
    }
    setResetBusy(true);
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), { redirectTo });
    setResetBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Check your email for the reset link.");
    setForgot(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="identifier">Email or username</Label>
        <Input id="identifier" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" placeholder="you@example.com or yourname" required />
      </div>

      {!forgot ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button type="button" onClick={() => setForgot(true)} className="text-xs text-primary hover:underline">Forgot?</button>
          </div>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="Your password" />
        </div>
      ) : null}
      {forgot ? (
        <div className="rounded-lg border border-border bg-accent/40 p-3 text-xs text-accent-foreground">
          We'll send a password reset link to your email.
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" onClick={sendReset} disabled={resetBusy} className="bg-gradient-primary text-primary-foreground border-0">
              {resetBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send reset link"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setForgot(false)}>Back to sign in</Button>
          </div>
        </div>
      ) : (
        <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground border-0 shadow-glow h-11 text-base font-semibold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </Button>
      )}
    </form>
  );
}

function SignUpForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ fullName: "", username: "", email: "", phone: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      // Check username availability (case-insensitive)
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", parsed.data.username)
        .maybeSingle();
      if (existing) {
        toast.error("Username already taken");
        return;
      }
      const emailRedirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
      const { data: signed, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo,
          data: {
            full_name: parsed.data.fullName,
            username: parsed.data.username,
            phone: parsed.data.phone || null,
          },
        },
      });
      if (error) {
        const msg = /already|registered|exists/i.test(error.message)
          ? "This email is already registered."
          : error.message;
        toast.error(msg);
        return;
      }
      // Supabase obfuscates existing accounts: no identities means the email is taken.
      if (signed.user && (signed.user.identities?.length ?? 0) === 0) {
        toast.error("This email is already registered.");
        return;
      }
      toast.success("Account created! You can sign in now.");
      onDone();

    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" value={form.username} onChange={(e) => set("username", e.target.value.toLowerCase())} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" value={form.password} onChange={(v) => set("password", v)} autoComplete="new-password" />
        <p className="text-xs text-muted-foreground">At least 6 characters.</p>

      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <PasswordInput id="confirm" value={form.confirm} onChange={(v) => set("confirm", v)} autoComplete="new-password" />
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground border-0 shadow-glow h-11 text-base font-semibold">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        By continuing you agree to our Terms and Privacy Policy.
      </p>
    </form>
  );
}
