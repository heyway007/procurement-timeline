"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/** Only return to a local page; reject encoded external paths and login loops. */
export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020]/.test(decoded)) return "/";
    const url = new URL(value, "https://timeline.invalid");
    if (url.origin !== "https://timeline.invalid" || url.pathname.startsWith("//") || /^\/login(?:\/|$)/.test(decodeURIComponent(url.pathname))) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email") ?? "").trim(), password }),
      });
      if (!response.ok) {
        setError(response.status === 401
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : response.status === 429
            ? "เข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่"
            : "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      router.replace(safeReturnTo(new URLSearchParams(window.location.search).get("returnTo")));
    } catch {
      setError("ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPassword("");
      setPending(false);
    }
  }

  return (
    <main className="tceb-page-shell flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6">
      <section aria-labelledby="login-title" className="w-full max-w-md rounded-3xl border border-indigo-100 bg-white p-6 shadow-xl sm:p-9">
        <Image src="/logo-tceb.webp" alt="TCEB" width={88} height={88} priority className="h-20 w-20 object-contain" />
        <p className="mt-5 text-sm font-semibold tracking-wide text-indigo-700">Procurement Timeline</p>
        <h1 id="login-title" className="mt-2 text-2xl font-semibold text-slate-950">เข้าสู่ระบบ</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">เข้าสู่ระบบด้วยบัญชีของคุณเพื่อจัดการประมาณการกรอบระยะเวลาในการจัดซื้อจัดจ้าง</p>
        <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={pending}>
          <label className="block text-sm font-medium text-slate-700">
            อีเมล
            <input name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={pending} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            รหัสผ่าน
            <input name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50" />
          </label>
          {error ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
          <button type="submit" disabled={pending} className="min-h-12 w-full rounded-xl bg-indigo-700 px-5 font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60">{pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
        </form>
      </section>
    </main>
  );
}
