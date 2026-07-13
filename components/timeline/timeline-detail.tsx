"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import type { ProjectRecord } from "@/lib/projects/types";
import {
  adjustProjectStep,
  ApiError,
  deleteProject,
  getProject,
  resetProjectSchedule,
} from "@/lib/ui/api-client";
import { approvedTemplateStepsForBudgetCategory } from "@/lib/schedule/approved-template";
import {
  formatBaht,
  formatThaiDateRangeWithWeekday,
  formatThaiDateWithWeekday,
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
  onResetSchedule?: (version: number) => Promise<ProjectRecord>;
  onDeleteProject?: (version: number) => Promise<void>;
  onNavigateHome?: () => void;
};

function collectTimelineYears(project: ProjectRecord): number[] {
  const dates = [
    project.processEndDate,
    ...project.steps.map((step) => step.scheduledDate),
  ];
  return [...new Set(dates.map((date) => Number(date.slice(0, 4))))].sort();
}

function isDateRangeMilestone(project: ProjectRecord, order: number): boolean {
  if (project.budgetCategory === "ONE_TO_FIVE_MILLION") {
    return order === 3 || order === 7;
  }
  return order === 3 || order === 6;
}

function isPresentMilestone(label: string): boolean {
  return label.includes("Present");
}

function totalWorkingDays(project: ProjectRecord): number {
  return project.steps.reduce((sum, step) => sum + step.workingDaysToNext, 0);
}

function templateWorkingDays(project: ProjectRecord): number {
  return approvedTemplateStepsForBudgetCategory(project.budgetCategory).reduce(
    (sum, step) => sum + step.workingDaysToNext,
    0,
  );
}

function hasManualScheduleAdjustment(project: ProjectRecord): boolean {
  return (
    project.isProcessEndManuallyAdjusted ||
    project.steps.some((step) => step.isDateManuallyAdjusted)
  );
}

function slaStatusText(project: ProjectRecord): string {
  return hasManualScheduleAdjustment(project) &&
    totalWorkingDays(project) < templateWorkingDays(project)
    ? "ไม่เป็นไปตาม SLA"
    : "เป็นไปตาม SLA";
}

function displayStepLabel(step: ProjectRecord["steps"][number]): string {
  const label = step.label.replaceAll("ส่วนงานพัสดุฯ ", "");
  if (isPresentMilestone(step.label) && step.isDateManuallyAdjusted) {
    return label.replaceAll(" (เลือกวันใดวันหนึ่ง)", "");
  }
  return label;
}

function previousWorkingDateBy(
  iso: string,
  amount: number,
  holidays: ReadonlySet<string>,
): string {
  let cursor = iso;
  for (let index = 0; index < amount; index += 1) {
    cursor = previousWorkingDate(cursor, holidays);
  }
  return cursor;
}

export function TimelineDetail({
  projectId,
  initialProject,
  onAdjustStep,
  onResetSchedule,
  onDeleteProject,
  onNavigateHome = () => window.location.assign("/"),
}: TimelineDetailProps) {
  const [project, setProject] = useState(initialProject);
  const [loading, setLoading] = useState(!initialProject);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
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
    if (isPresentMilestone(step.label) && !step.isDateManuallyAdjusted) {
      return formatThaiDateRangeWithWeekday(
        previousWorkingDateBy(step.scheduledDate, 3, holidayDates),
        previousWorkingDate(step.scheduledDate, holidayDates),
      );
    }
    if (!nextStep) {
      return formatThaiDateRangeWithWeekday(
        step.scheduledDate,
        previousWorkingDate(project.processEndDate, holidayDates),
      );
    }
    if (!isDateRangeMilestone(project, step.order)) {
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
    setEditError("");
    if (isWeekendIso(newDate)) {
      setEditError("เลือกไม่ได้ เพราะวันที่ใหม่ต้องไม่เป็นวันเสาร์หรือวันอาทิตย์");
      return;
    }
    const editingIndex = project.steps.findIndex(
      (step) => step.order === editingOrder,
    );
    const previousStep = project.steps[editingIndex - 1];
    if (previousStep && newDate <= previousStep.scheduledDate) {
      setEditError(
        `เลือกไม่ได้ เพราะวันที่ใหม่ต้องอยู่หลังขั้นตอนที่ ${previousStep.order} (${formatThaiDateWithWeekday(previousStep.scheduledDate)})`,
      );
      return;
    }
    if (!confirmShortening && !confirmOverwrite) {
      const confirmation = await Swal.fire({
        title: "ยืนยันการแก้วันที่?",
        text: `ต้องการเปลี่ยนขั้นตอนที่ ${editingOrder} เป็น ${formatThaiDateWithWeekday(newDate)} ใช่หรือไม่`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "ยืนยัน",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#4338ca",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
      });
      if (!confirmation.isConfirmed) return;
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
      const updatedProject = await adjust(
        editingOrder,
        newDate,
        project.version,
        confirmShortening,
        confirmOverwrite,
      );
      setProject(updatedProject);
      await Swal.fire({
        title: "แก้วันที่สำเร็จ",
        text: `ปรับขั้นตอนที่ ${editingOrder} เป็น ${formatThaiDateWithWeekday(newDate)} แล้ว`,
        icon: "success",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#4338ca",
      });
      setEditingOrder(null);
      setEditError("");
    } catch (caught: unknown) {
      if (
        caught instanceof ApiError &&
        caught.code === "DURATION_SHORTER_THAN_TEMPLATE"
      ) {
        const confirmation = await Swal.fire({
          title: "ยืนยันการปรับระยะเวลา?",
          text: caught.message,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "ยืนยัน",
          cancelButtonText: "ยกเลิก",
          confirmButtonColor: "#4338ca",
          cancelButtonColor: "#64748b",
          reverseButtons: true,
        });
        if (confirmation.isConfirmed) {
          await saveEdit(true, confirmOverwrite);
        }
        return;
      }
      if (
        caught instanceof ApiError &&
        caught.code === "DOWNSTREAM_ADJUSTMENTS_WILL_BE_REPLACED"
      ) {
        const confirmation = await Swal.fire({
          title: "ยืนยันการเขียนทับวันที่ถัดไป?",
          text: caught.message,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "ยืนยัน",
          cancelButtonText: "ยกเลิก",
          confirmButtonColor: "#4338ca",
          cancelButtonColor: "#64748b",
          reverseButtons: true,
        });
        if (confirmation.isConfirmed) {
          await saveEdit(confirmShortening, true);
        }
        return;
      }
      setError(
        caught instanceof Error ? caught.message : "ไม่สามารถแก้วันที่ได้",
      );
    }
  }

  async function resetSchedule() {
    if (!project) return;
    const confirmation = await Swal.fire({
      title: "คืนค่าตามแม่แบบ?",
      text: "ต้องการคืนวันที่ทุกขั้นตอนตามแม่แบบใช่หรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ตกลง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#4338ca",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    try {
      const reset =
        onResetSchedule ??
        ((version: number) => resetProjectSchedule(project.id, version));
      setProject(await reset(project.version));
      await Swal.fire({
        title: "คืนค่าสำเร็จ",
        text: "คืนวันที่ทุกขั้นตอนตามแม่แบบแล้ว",
        icon: "success",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#4338ca",
      });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถคืนค่าได้");
    }
  }

  async function removeProject() {
    if (!project) return;
    const confirmation = await Swal.fire({
      title: "ลบโครงการ?",
      text: "ต้องการลบ Timeline โครงการนี้ใช่หรือไม่",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบโครงการ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#be123c",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    try {
      const remove =
        onDeleteProject ??
        ((version: number) => deleteProject(project.id, version));
      await remove(project.version);
      await Swal.fire({
        title: "ลบโครงการสำเร็จ",
        text: "ลบ Timeline โครงการนี้แล้ว",
        icon: "success",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#4338ca",
      });
      onNavigateHome();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถลบได้");
    }
  }

  if (loading) return <p className="p-10 text-center text-slate-600">กำลังโหลด Timeline...</p>;
  if (!project) return <p className="p-10 text-center text-rose-700">{error || "ไม่พบโครงการ"}</p>;

  function formatWorkingDaysText(step: ProjectRecord["steps"][number]): string {
    if (isPresentMilestone(step.label) && !step.isDateManuallyAdjusted) {
      return "3 วันทำการก่อน";
    }
    return `${step.workingDaysToNext} วันทำการถึงขั้นตอนถัดไป`;
  }

  return (
    <main className="print-page mx-auto min-h-screen max-w-6xl px-4 py-8 text-base sm:px-6">
      <nav className="print-hidden mb-6">
        <Link href="/" className="font-semibold text-indigo-700">← กลับหน้าโครงการ</Link>
      </nav>
      <header data-testid="print-header" className="print-header rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
        <p className="text-sm font-semibold text-indigo-300">Timeline โครงการ</p>
        <h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
        <dl className="mt-6 grid gap-4 text-base sm:grid-cols-2 lg:grid-cols-4">
          <div data-testid="print-owner"><dt className="text-slate-400">ผู้จัดทำ Timeline</dt><dd className="mt-1 font-semibold">{project.ownerName}</dd></div>
          <div data-testid="print-department"><dt className="text-slate-400">ฝ่าย</dt><dd className="mt-1 font-semibold">{project.departmentName || "-"}</dd></div>
          <div><dt className="text-slate-400">วงเงิน</dt><dd className="mt-1 font-semibold">{formatBaht(project.budget)}</dd></div>
          <div data-testid="print-total-days"><dt className="text-slate-400">จำนวนวันทำการทั้งหมด</dt><dd className="mt-1 font-semibold">{totalWorkingDays(project)} วันทำการ · {slaStatusText(project)}</dd></div>
        </dl>
      </header>

      {project.scheduleStatus === "NEEDS_REVIEW" ? (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">กำหนดการนี้ได้รับผลกระทบจากวันหยุด กรุณาตรวจสอบวันที่ซึ่งปรับเอง</p>
      ) : null}
      {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-rose-800">{error}</p> : null}

      <section data-testid="timeline-table" className="print-table mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div data-testid="timeline-header-row" className="print-grid hidden grid-cols-[4rem_1fr_20rem_7rem] gap-3 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 md:grid">
          <span>ลำดับ</span><span>ขั้นตอน</span><span>วันที่กำหนด</span><span className="print-hidden">จัดการ</span>
        </div>
        {project.steps.map((step, index) => (
          <div data-testid="timeline-step" key={step.order} className="print-grid grid gap-3 border-t border-slate-100 px-4 py-4 text-base md:grid-cols-[4rem_1fr_20rem_7rem]">
            <span className="font-semibold text-indigo-700">{step.order}</span>
            <div>
              <p className="font-medium text-slate-900">{displayStepLabel(step)}</p>
              <p className="print-step-hint mt-1 text-sm text-slate-500">{formatWorkingDaysText(step)} {step.isDateManuallyAdjusted ? "· ปรับกำหนดการ" : ""}</p>
            </div>
            <span className="font-medium text-slate-700">{formatStepScheduledDate(index)}</span>
            <button className="print-hidden h-9 rounded-lg border border-slate-300 font-semibold text-slate-700" type="button" aria-label={`แก้วันที่ ขั้นตอนที่ ${step.order}`} onClick={() => { setEditingOrder(step.order); setNewDate(step.scheduledDate); setEditError(""); }}>แก้วันที่</button>
          </div>
        ))}
        <div className="print-grid grid gap-3 border-t-2 border-indigo-100 bg-indigo-50 px-4 py-4 text-base md:grid-cols-[4rem_1fr_20rem_7rem]">
          <span className="font-semibold text-indigo-700">จบ</span><span className="font-semibold text-slate-900">วันที่เริ่มทำสัญญา</span><span className="font-semibold text-indigo-800">{formatThaiDateWithWeekday(project.processEndDate)}</span><span />
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
            <label className="mt-5 block text-sm font-medium">วันที่ใหม่<input aria-label="วันที่ใหม่" className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" type="date" value={newDate} onChange={(event) => { setNewDate(event.target.value); setEditError(""); }} required /></label>
            {editError ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{editError}</p> : null}
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { setEditingOrder(null); setEditError(""); }} className="rounded-xl border px-4 py-2">ยกเลิก</button><button type="submit" className="rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white">ตกลง</button></div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
