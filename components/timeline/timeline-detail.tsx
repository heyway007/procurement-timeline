"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProjectRecord } from "@/lib/projects/types";
import {
  adjustProjectStep,
  ApiError,
  deleteProject,
  getProject,
  resetProjectSchedule,
} from "@/lib/ui/api-client";
import {
  buildMonthCalendar,
  formatBaht,
  formatThaiDate,
  formatThaiDateRangeWithWeekday,
  formatThaiDateWithWeekday,
  formatThaiFullDateWithWeekday,
  formatThaiMonthYear,
  isWeekendIso,
  previousWorkingDate,
} from "@/lib/ui/date-format";

type AdjustStep = (
  order: number,
  newDate: string,
  version: number,
  confirmShortening: boolean,
  confirmOverwrite: boolean,
) => Promise<ProjectRecord>;

type TimelineDetailProps = {
  projectId: string;
  initialProject?: ProjectRecord;
  onAdjustStep?: AdjustStep;
};

function CalendarPreview({
  iso,
  placement = "below",
}: {
  iso: string;
  placement?: "above" | "below";
}) {
  const [open, setOpen] = useState(false);
  const fullDate = formatThaiFullDateWithWeekday(iso);
  const monthYear = formatThaiMonthYear(iso);
  const days = buildMonthCalendar(iso);

  return (
    <div
      className="print-hidden relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`ดูปฏิทิน ${fullDate}`}
        onClick={() => setOpen(true)}
        className="grid h-9 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-sm hover:border-indigo-400 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {Number(iso.slice(8, 10))}
      </button>
      {open ? (
        <div
          data-testid="calendar-popover"
          className={[
            "absolute right-0 z-20 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl",
            placement === "above" ? "bottom-11" : "top-11",
          ].join(" ")}
        >
          <p className="text-sm font-semibold">{fullDate}</p>
          <p className="mt-4 text-base font-semibold">{monthYear}</p>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
            {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-sm">
            {days.map((day) => (
              <span
                key={day.iso}
                aria-label={day.selected ? `วันที่เลือก ${day.day}` : undefined}
                className={[
                  "grid h-8 w-8 place-items-center rounded-full",
                  day.inMonth ? "text-slate-800" : "text-slate-300",
                  day.selected ? "bg-indigo-600 font-semibold text-white" : "",
                ].join(" ")}
              >
                {day.day}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function collectTimelineYears(project: ProjectRecord): number[] {
  const dates = [
    project.processEndDate,
    ...project.steps.map((step) => step.scheduledDate),
  ];
  return [...new Set(dates.map((date) => Number(date.slice(0, 4))))].sort();
}

function isDateRangeMilestone(order: number): boolean {
  return order === 3 || order === 6;
}

export function TimelineDetail({
  projectId,
  initialProject,
  onAdjustStep,
}: TimelineDetailProps) {
  const [project, setProject] = useState(initialProject);
  const [loading, setLoading] = useState(!initialProject);
  const [error, setError] = useState("");
  const [editingOrder, setEditingOrder] = useState<number | null>(null);
  const [newDate, setNewDate] = useState("");
  const [holidayDates, setHolidayDates] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (initialProject) return;
    getProject(projectId)
      .then(setProject)
      .catch(() => setError("ไม่สามารถโหลด Timeline ได้"))
      .finally(() => setLoading(false));
  }, [initialProject, projectId]);

  useEffect(() => {
    if (!project || initialProject) return;
    let cancelled = false;
    Promise.all(
      collectTimelineYears(project).map((year) =>
        fetch(`/api/holidays?year=${year}`)
          .then((response) => response.json() as Promise<{ holidays?: { date: string }[] }>)
          .then((data) => data.holidays?.map((holiday) => holiday.date) ?? []),
      ),
    )
      .then((years) => {
        if (!cancelled) setHolidayDates(new Set(years.flat()));
      })
      .catch(() => {
        if (!cancelled) setHolidayDates(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [initialProject, project]);

  function formatStepScheduledDate(stepIndex: number): string {
    const step = project?.steps[stepIndex];
    const nextStep = project?.steps[stepIndex + 1];
    if (!step) return "";
    if (!nextStep || !isDateRangeMilestone(step.order)) {
      return formatThaiDateWithWeekday(step.scheduledDate);
    }

    return formatThaiDateRangeWithWeekday(
      step.scheduledDate,
      previousWorkingDate(nextStep.scheduledDate, holidayDates),
    );
  }

  async function saveEdit(
    confirmShortening = false,
    confirmOverwrite = false,
  ) {
    if (!project || editingOrder === null) return;
    if (isWeekendIso(newDate)) {
      setError("วันที่ใหม่ต้องไม่เป็นวันเสาร์หรือวันอาทิตย์");
      return;
    }
    setError("");
    try {
      const adjust =
        onAdjustStep ??
        ((order, date, version, shortening, overwrite) =>
          adjustProjectStep(
            projectId,
            order,
            date,
            version,
            shortening,
            overwrite,
          ));
      setProject(
        await adjust(
          editingOrder,
          newDate,
          project.version,
          confirmShortening,
          confirmOverwrite,
        ),
      );
      setEditingOrder(null);
    } catch (caught: unknown) {
      if (
        caught instanceof ApiError &&
        caught.code === "DURATION_SHORTER_THAN_TEMPLATE" &&
        window.confirm(caught.message)
      ) {
        await saveEdit(true, confirmOverwrite);
        return;
      }
      if (
        caught instanceof ApiError &&
        caught.code === "DOWNSTREAM_ADJUSTMENTS_WILL_BE_REPLACED" &&
        window.confirm(caught.message)
      ) {
        await saveEdit(confirmShortening, true);
        return;
      }
      setError(
        caught instanceof Error ? caught.message : "ไม่สามารถแก้วันที่ได้",
      );
    }
  }

  async function resetSchedule() {
    if (!project || !window.confirm("คืนวันที่ทุกขั้นตอนตามแม่แบบใช่หรือไม่")) return;
    try {
      setProject(await resetProjectSchedule(project.id, project.version));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถคืนค่าได้");
    }
  }

  async function removeProject() {
    if (!project || !window.confirm("ลบ Timeline โครงการนี้ใช่หรือไม่")) return;
    try {
      await deleteProject(project.id, project.version);
      window.location.assign("/");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถลบได้");
    }
  }

  if (loading) return <p className="p-10 text-center text-slate-600">กำลังโหลด Timeline...</p>;
  if (!project) return <p className="p-10 text-center text-rose-700">{error || "ไม่พบโครงการ"}</p>;

  return (
    <main className="print-page mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
      <nav className="print-hidden mb-6">
        <Link href="/" className="font-semibold text-indigo-700">← กลับหน้าโครงการ</Link>
      </nav>
      <header className="print-header rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
        <p className="text-sm font-semibold text-indigo-300">Timeline โครงการ</p>
        <h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-400">ผู้รับผิดชอบ</dt><dd className="mt-1 font-semibold">{project.ownerName}</dd></div>
          <div><dt className="text-slate-400">วงเงิน</dt><dd className="mt-1 font-semibold">{formatBaht(project.budget)}</dd></div>
          <div><dt className="text-slate-400">วันที่เริ่มทำสัญญา</dt><dd className="mt-1 font-semibold">{formatThaiDate(project.processEndDate)}</dd></div>
        </dl>
      </header>

      {project.scheduleStatus === "NEEDS_REVIEW" ? (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">กำหนดการนี้ได้รับผลกระทบจากวันหยุด กรุณาตรวจสอบวันที่ซึ่งปรับเอง</p>
      ) : null}
      {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-rose-800">{error}</p> : null}

      <section data-testid="timeline-table" className="print-table mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div data-testid="timeline-header-row" className="print-grid grid grid-cols-[4rem_1fr_20rem_5rem_7rem] gap-3 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
          <span>ลำดับ</span><span>ขั้นตอน</span><span>วันที่กำหนด</span><span className="print-hidden">ปฏิทิน</span><span className="print-hidden">จัดการ</span>
        </div>
        {project.steps.map((step, index) => (
          <div data-testid="timeline-step" key={step.order} className="print-grid grid grid-cols-[4rem_1fr_20rem_5rem_7rem] gap-3 border-t border-slate-100 px-4 py-4 text-sm">
            <span className="font-semibold text-indigo-700">{step.order}</span>
            <div>
              <p className="font-medium text-slate-900">{step.label}</p>
              <p className="mt-1 text-xs text-slate-500">{step.workingDaysToNext} วันทำการถึงขั้นตอนถัดไป {step.isDateManuallyAdjusted ? "· ปรับกำหนดการ" : ""}</p>
            </div>
            <span className="font-medium text-slate-700">{formatStepScheduledDate(index)}</span>
            <CalendarPreview iso={step.scheduledDate} placement={step.order >= 10 ? "above" : "below"} />
            <button className="print-hidden h-9 rounded-lg border border-slate-300 font-semibold text-slate-700" type="button" aria-label={`แก้วันที่ ขั้นตอนที่ ${step.order}`} onClick={() => { setEditingOrder(step.order); setNewDate(step.scheduledDate); }}>แก้วันที่</button>
          </div>
        ))}
        <div className="print-grid grid grid-cols-[4rem_1fr_20rem_5rem_7rem] gap-3 border-t-2 border-indigo-100 bg-indigo-50 px-4 py-4 text-sm">
          <span className="font-semibold text-indigo-700">จบ</span><span className="font-semibold text-slate-900">วันที่เริ่มทำสัญญา</span><span className="font-semibold text-indigo-800">{formatThaiDateWithWeekday(project.processEndDate)}</span><CalendarPreview iso={project.processEndDate} placement="above" /><span />
        </div>
      </section>

      <div className="print-hidden mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold">พิมพ์ Timeline</button>
        <button type="button" onClick={resetSchedule} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold">คืนค่าตามแม่แบบ</button>
        <button type="button" onClick={removeProject} className="rounded-xl bg-rose-700 px-4 py-2 font-semibold text-white">ลบโครงการ</button>
      </div>

      {editingOrder !== null ? (
        <div className="print-hidden fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); void saveEdit(); }}>
            <h2 className="text-xl font-semibold">แก้วันที่ขั้นตอนที่ {editingOrder}</h2>
            <label className="mt-5 block text-sm font-medium">วันที่ใหม่<input aria-label="วันที่ใหม่" className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required /></label>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditingOrder(null)} className="rounded-xl border px-4 py-2">ยกเลิก</button><button type="submit" className="rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white">ยืนยันการแก้วันที่</button></div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
