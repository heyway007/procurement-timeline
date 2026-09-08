"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/auth/types";
import { SESSION_EXPIRED_EVENT } from "@/lib/ui/api-client";
import { safeReturnTo } from "./login-form";

const AuthUserContext = createContext<AuthUser | null>(null);

export function useAuthUser() {
  return useContext(AuthUserContext);
}

export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    function expired() {
      if (!active) return;
      // Invalidate in-flight /me work so it cannot restore expired content.
      active = false;
      controller.abort();
      setUser(null);
      setError("");
      const returnTo = safeReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    async function loadSession() {
      setError("");
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!active) return;
        if (response.status === 401) { expired(); return; }
        if (!response.ok) throw new Error("Session lookup failed");
        const data = await response.json() as { user?: AuthUser };
        if (!data.user?.id || !data.user.displayName || !["USER", "ADMIN"].includes(data.user.role)) throw new Error("Invalid session");
        if (active) setUser(data.user);
      } catch {
        if (active) setError("ไม่สามารถตรวจสอบการเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
      }
    }
    void loadSession();
    return () => { active = false; controller.abort(); window.removeEventListener(SESSION_EXPIRED_EVENT, expired); };
  }, [router, attempt]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok && response.status !== 401) throw new Error("Logout failed");
      setUser(null);
      router.replace("/login");
    } catch {
      setError("ไม่สามารถออกจากระบบได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoggingOut(false);
    }
  }

  if (!user) {
    return <main className="grid min-h-dvh place-items-center px-4 py-8"><div className="max-w-md text-center">{error ? <><p role="alert" className="text-rose-800">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-4 min-h-11 rounded-xl bg-indigo-700 px-5 font-semibold text-white">ลองใหม่</button></> : <p role="status" className="text-slate-600">กำลังตรวจสอบการเข้าสู่ระบบ...</p>}</div></main>;
  }

  return (
    <AuthUserContext.Provider value={user}>
      <div className="border-b border-indigo-100 bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <p className="min-w-0 break-words text-sm text-slate-600">ผู้ใช้งาน <span className="font-semibold text-slate-900">{user.displayName}</span></p>
          <button type="button" onClick={() => void logout()} disabled={loggingOut} className="min-h-10 shrink-0 rounded-xl border border-indigo-200 px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60">{loggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}</button>
          {error ? <p role="alert" className="w-full text-right text-sm text-rose-800">{error}</p> : null}
        </div>
      </div>
      {children}
    </AuthUserContext.Provider>
  );
}
