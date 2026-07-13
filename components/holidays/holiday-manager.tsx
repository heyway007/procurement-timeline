"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import Swal from "sweetalert2";
import type { HolidayInput, HolidayRecord, HolidayMutation } from "@/lib/holidays/repository";
import { formatThaiDate } from "@/lib/ui/date-format";

type Preview = { token: string; affectedProjects: Array<{ id: string; name: string; version: number }> };
type SyncState = { status: "FRESH" | "CACHED" | "FAILED"; cached: boolean; message: string | null; sourceUrl: string | null; lastSuccessfulSyncAt: string | null };
type HolidayManagerProps = { initialYear?: number; initialHolidays?: HolidayRecord[]; previewMutation?: (mutation: HolidayMutation) => Promise<Preview> };

async function apiPreview(mutation: HolidayMutation): Promise<Preview> {
  const response = await fetch("/api/holidays/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mutation) });
  if (!response.ok) throw new Error("ไม่สามารถตรวจสอบผลกระทบได้");
  return response.json() as Promise<Preview>;
}

export function HolidayManager({ initialYear = new Date().getFullYear(), initialHolidays, previewMutation = apiPreview }: HolidayManagerProps) {
  const [year, setYear] = useState(initialYear);
  const [holidays, setHolidays] = useState(initialHolidays ?? []);
  const [sync, setSync] = useState<SyncState>();
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<Preview>();
  const [pendingInput, setPendingInput] = useState<HolidayInput>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialHolidays !== undefined) return;
    fetch(`/api/holidays?year=${year}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ holidays: HolidayRecord[]; sync: SyncState }>;
      })
      .then((data) => { setHolidays(data.holidays); setSync(data.sync); })
      .catch(() => setError("ไม่สามารถโหลดวันหยุดได้"));
  }, [initialHolidays, year]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const holiday: HolidayInput = { date: String(form.get("date")), name: String(form.get("name")), sourceNote: String(form.get("sourceNote")) };
    try {
      setPendingInput(holiday);
      setPreview(await previewMutation({ operation: "create", holiday }));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถตรวจสอบได้");
    }
  }

  async function confirm() {
    if (!preview || !pendingInput) return;
    const confirmation = await Swal.fire({
      title: "ยืนยันการบันทึกวันหยุด?",
      text: `ต้องการบันทึก ${pendingInput.name} และคำนวณ Timeline ที่ได้รับผลกระทบใหม่ใช่หรือไม่`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ตกลง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#4338ca",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    const response = await fetch("/api/holidays/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: preview.token }) });
    if (!response.ok) { setError("ไม่สามารถบันทึกวันหยุดได้"); return; }
    const now = new Date().toISOString();
    const created: HolidayRecord = { id: `new-${pendingInput.date}`, ...pendingInput, scope: "NATIONWIDE", origin: "MANUAL", officialSourceUrl: null, officialSourceLabel: null, lastConfirmedAt: null, createdAt: now, updatedAt: now };
    setHolidays((current) => [...current, created].sort((a, b) => a.date.localeCompare(b.date)));
    await Swal.fire({
      title: "บันทึกวันหยุดสำเร็จ",
      text: "บันทึกวันหยุดและคำนวณ Timeline ที่ได้รับผลกระทบแล้ว",
      icon: "success",
      confirmButtonText: "ตกลง",
      confirmButtonColor: "#4338ca",
    });
    setPreview(undefined); setPendingInput(undefined); setAdding(false);
  }

  return <main className="mx-auto min-h-screen max-w-5xl overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
    <nav className="mb-6"><Link href="/" className="font-semibold text-indigo-700">← กลับหน้าโครงการ</Link></nav>
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="min-w-0"><p className="text-sm font-semibold text-indigo-700">ปฏิทินหน่วยงาน</p><h1 className="mt-1 text-2xl font-semibold sm:text-3xl">จัดการวันหยุดราชการ</h1><p className="mt-2 text-sm text-slate-600">วันหยุดในรายการจะไม่นำมานับใน Timeline ทุกโครงการ</p></div><button type="button" onClick={() => setAdding(true)} className="min-h-12 rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white sm:shrink-0">เพิ่มวันหยุด</button></header>
    <label className="mt-7 block text-sm font-medium sm:max-w-48">ปี ค.ศ.<input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
    {sync ? <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${sync.status === "FRESH" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}><p className="font-semibold">{sync.status === "FRESH" ? "ข้อมูลวันหยุดราชการเป็นปัจจุบัน" : sync.status === "CACHED" ? "กำลังใช้ข้อมูลราชการที่บันทึกไว้" : "ยังดึงข้อมูลราชการไม่ได้"}</p>{sync.lastSuccessfulSyncAt ? <p className="mt-1">อัปเดตสำเร็จล่าสุด {new Date(sync.lastSuccessfulSyncAt).toLocaleString("th-TH")}</p> : null}{sync.sourceUrl ? <a className="mt-1 inline-block underline" href={sync.sourceUrl} target="_blank" rel="noreferrer">เปิดแหล่งข้อมูลราชการ</a> : null}</div> : null}
    {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p> : null}
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{holidays.length === 0 ? <p className="p-8 text-center text-slate-600">ยังไม่มีข้อมูลวันหยุดในปีนี้</p> : holidays.map((holiday) => <div key={holiday.id} className="grid gap-2 border-b border-slate-100 px-4 py-4 sm:grid-cols-[10rem_1fr] sm:px-5"><p className="font-semibold text-indigo-700">{formatThaiDate(holiday.date)}</p><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-words font-semibold">{holiday.name}</p><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-800">{holiday.scope === "BANGKOK" ? "กรุงเทพมหานคร" : "ทั่วประเทศ"}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{holiday.origin === "OFFICIAL_SYNC" ? "ราชการ" : "เพิ่มเอง"}</span></div><p className="mt-1 break-words text-sm text-slate-500">{holiday.sourceNote}</p>{holiday.officialSourceUrl ? <a href={holiday.officialSourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-xs text-indigo-700 underline">แหล่งข้อมูล</a> : null}</div></div>)}</div>
    {adding ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-3 sm:p-4"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><h2 className="text-xl font-semibold">เพิ่มวันหยุด</h2><div className="mt-5 grid gap-4"><label>วันที่หยุด<input aria-label="วันที่หยุด" name="date" type="date" required className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label><label>ชื่อวันหยุด<input aria-label="ชื่อวันหยุด" name="name" required className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label><label>แหล่งอ้างอิง<textarea aria-label="แหล่งอ้างอิง" name="sourceNote" required className="mt-2 min-h-20 w-full rounded-xl border p-3" /></label></div><div className="mt-5 grid gap-3 sm:flex sm:justify-end"><button type="button" onClick={() => setAdding(false)} className="min-h-11 rounded-xl border px-4 py-2">ยกเลิก</button><button type="submit" className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white">ตรวจสอบผลกระทบ</button></div></form></div> : null}
    {preview ? <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/50 p-3 sm:p-4"><section role="dialog" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><h2 className="text-xl font-semibold">ผลกระทบต่อ Timeline</h2><p className="mt-3 text-sm text-slate-600">โครงการที่อาจถูกคำนวณใหม่ {preview.affectedProjects.length} รายการ</p><ul className="mt-4 list-disc space-y-1 pl-5">{preview.affectedProjects.map((project) => <li className="break-words" key={project.id}>{project.name}</li>)}</ul><div className="mt-6 grid gap-3 sm:flex sm:justify-end"><button type="button" onClick={() => setPreview(undefined)} className="min-h-11 rounded-xl border px-4 py-2">ย้อนกลับ</button><button type="button" onClick={() => void confirm()} className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white">ยืนยันและคำนวณใหม่</button></div></section></div> : null}
  </main>;
}
