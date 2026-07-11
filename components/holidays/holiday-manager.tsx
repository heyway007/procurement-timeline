"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { HolidayInput, HolidayRecord, HolidayMutation } from "@/lib/holidays/repository";
import { formatThaiDate } from "@/lib/ui/date-format";

type Preview = {
  token: string;
  affectedProjects: Array<{ id: string; name: string; version: number }>;
};

type HolidayManagerProps = {
  initialYear?: number;
  initialHolidays?: HolidayRecord[];
  previewMutation?: (mutation: HolidayMutation) => Promise<Preview>;
};

async function apiPreview(mutation: HolidayMutation): Promise<Preview> {
  const response = await fetch("/api/holidays/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mutation),
  });
  if (!response.ok) throw new Error("ไม่สามารถตรวจสอบผลกระทบได้");
  return response.json() as Promise<Preview>;
}

export function HolidayManager({
  initialYear = new Date().getFullYear(),
  initialHolidays,
  previewMutation = apiPreview,
}: HolidayManagerProps) {
  const [year, setYear] = useState(initialYear);
  const [holidays, setHolidays] = useState(initialHolidays ?? []);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<Preview>();
  const [pendingInput, setPendingInput] = useState<HolidayInput>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialHolidays !== undefined) return;
    fetch(`/api/holidays?year=${year}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ holidays: HolidayRecord[] }>;
      })
      .then((data) => setHolidays(data.holidays))
      .catch(() => setError("ไม่สามารถโหลดวันหยุดได้"));
  }, [initialHolidays, year]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const holiday: HolidayInput = {
      date: String(form.get("date")),
      name: String(form.get("name")),
      sourceNote: String(form.get("sourceNote")),
    };
    try {
      const result = await previewMutation({ operation: "create", holiday });
      setPendingInput(holiday);
      setPreview(result);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถตรวจสอบได้");
    }
  }

  async function confirm() {
    if (!preview || !pendingInput) return;
    const response = await fetch("/api/holidays/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: preview.token }),
    });
    if (!response.ok) {
      setError("ไม่สามารถบันทึกวันหยุดได้");
      return;
    }
    setHolidays((current) => [
      ...current,
      {
        id: `new-${pendingInput.date}`,
        ...pendingInput,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ].sort((a, b) => a.date.localeCompare(b.date)));
    setPreview(undefined);
    setPendingInput(undefined);
    setAdding(false);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <nav className="mb-6"><Link href="/" className="font-semibold text-indigo-700">← กลับหน้าโครงการ</Link></nav>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-semibold text-indigo-700">ปฏิทินหน่วยงาน</p><h1 className="mt-1 text-3xl font-semibold">จัดการวันหยุดราชการ</h1><p className="mt-2 text-sm text-slate-600">วันหยุดในรายการจะไม่นำมานับใน Timeline ทุกโครงการ</p></div>
        <button type="button" onClick={() => setAdding(true)} className="rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white">เพิ่มวันหยุด</button>
      </header>

      <label className="mt-7 block max-w-48 text-sm font-medium">ปี ค.ศ.<input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p> : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {holidays.length === 0 ? <p className="p-8 text-center text-slate-600">ยังไม่มีข้อมูลวันหยุดในปีนี้</p> : holidays.map((holiday) => <div key={holiday.id} className="grid gap-2 border-b border-slate-100 px-5 py-4 sm:grid-cols-[10rem_1fr]" ><p className="font-semibold text-indigo-700">{formatThaiDate(holiday.date)}</p><div><p className="font-semibold">{holiday.name}</p><p className="mt-1 text-sm text-slate-500">{holiday.sourceNote}</p></div></div>)}
      </div>

      {adding ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-semibold">เพิ่มวันหยุด</h2><div className="mt-5 grid gap-4"><label>วันที่หยุด<input aria-label="วันที่หยุด" name="date" type="date" required className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label><label>ชื่อวันหยุด<input aria-label="ชื่อวันหยุด" name="name" required className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label><label>แหล่งอ้างอิง<textarea aria-label="แหล่งอ้างอิง" name="sourceNote" required className="mt-2 min-h-20 w-full rounded-xl border p-3" /></label></div><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setAdding(false)} className="rounded-xl border px-4 py-2">ยกเลิก</button><button type="submit" className="rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white">ตรวจสอบผลกระทบ</button></div></form></div> : null}

      {preview ? <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"><section role="dialog" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-semibold">ผลกระทบต่อ Timeline</h2><p className="mt-3 text-sm text-slate-600">โครงการที่อาจถูกคำนวณใหม่ {preview.affectedProjects.length} รายการ</p><ul className="mt-4 list-disc pl-5">{preview.affectedProjects.map((project) => <li key={project.id}>{project.name}</li>)}</ul><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setPreview(undefined)} className="rounded-xl border px-4 py-2">ย้อนกลับ</button><button type="button" onClick={() => void confirm()} className="rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white">ยืนยันและคำนวณใหม่</button></div></section></div> : null}
    </main>
  );
}
