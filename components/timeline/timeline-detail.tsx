"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import type { ProjectRecord } from "@/lib/projects/types";
import {
  adjustProjectStep,
  ApiError,
  deleteProject,
  getProject,
  resetProjectSchedule,
  updateBidSubmissionTime,
} from "@/lib/ui/api-client";
import { approvedTemplateStepsForBudgetCategory } from "@/lib/schedule/approved-template";
import { addWorkingDays } from "@/lib/schedule/date";
import {
  BID_SUBMISSION_TIME_LABELS,
  bidSubmissionTimeLabel,
  effectiveBidSubmissionTimeSlot,
  isBidSubmissionMilestone,
  isPresentMilestone,
  type BidSubmissionTimeSlot,
} from "@/lib/schedule/milestone-kind";
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

type EditContext = {
  order: number;
  date: string;
  version: number;
};

type TimelineDetailProps = {
  projectId: string;
  initialProject?: ProjectRecord;
  onAdjustStep?: AdjustStep;
  onResetSchedule?: (version: number) => Promise<ProjectRecord>;
  onDeleteProject?: (version: number) => Promise<void>;
  onUpdateBidSubmissionTime?: (
    slot: BidSubmissionTimeSlot,
    version: number,
  ) => Promise<ProjectRecord>;
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
  if (project.budgetCategory === "SELECTIVE_METHOD") {
    return order === 5 || order === 7 || order === 8 || order === 9;
  }
  return order === 3 || order === 6;
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

type StepPresentation = {
  title: string;
  subtitle?: string;
};

const SELECTIVE_METHOD_STEP_PRESENTATIONS: Record<number, StepPresentation> = {
  1: { title: "จัดทำเอกสาร", subtitle: "รายงานขอซื้อขอจ้าง • แต่งตั้งคณะกรรมการ" },
  2: { title: "จัดทำเอกสาร", subtitle: "รายงานการประชุมคัดเลือกรายชื่อผู้ยื่นเสนอราคา" },
  3: { title: "จัดทำเอกสาร", subtitle: "หนังสือเชิญยื่นเสนอราคาจำนวนอย่างน้อย 3 ราย" },
  4: { title: "จัดส่งหนังสือเชิญยื่นเสนอราคา", subtitle: "ทาง E-Mail" },
  5: { title: "เว้นระยะเวลาในการยื่นเสนอราคา" },
  6: { title: "กำหนดวันยื่นเสนอราคา", subtitle: "เวลา 8.30-16.30 น." },
  7: { title: "ตรวจสอบเอกสารเสนอราคา", subtitle: "เลือกวันใดวันหนึ่ง" },
  8: { title: "กำหนดวันเวลาในการนำเสนอข้อเทคนิค (Present)", subtitle: "เลือกวันใดวันหนึ่ง" },
  9: { title: "คณะกรรมการฯ พิจารณาคัดเลือกผู้ชนะ • ต่อรองราคา" },
  10: { title: "จัดทำเอกสาร", subtitle: "รายงานการประชุมและรายงานผลการพิจารณา • แบบแจ้งเหตุผลเพิ่มเติม" },
  11: { title: "จัดทำเอกสาร", subtitle: "รายงานผลพิจารณา • ประกาศผู้ชนะ" },
  12: { title: "ประกาศผู้ชนะการเสนอราคา", subtitle: "บนเว็บไซต์กรมบัญชีกลาง (e-GP)" },
  13: { title: "ระยะเวลาอุทธรณ์", subtitle: "ติดต่อให้ผู้รับจ้างนำส่งเอกสารเพื่อทำสัญญาและวางหลักประกันสัญญา" },
};

function stepPresentation(
  step: ProjectRecord["steps"][number],
  budgetCategory: ProjectRecord["budgetCategory"],
): StepPresentation {
  if (budgetCategory === "SELECTIVE_METHOD") {
    return SELECTIVE_METHOD_STEP_PRESENTATIONS[step.order] ?? { title: step.label };
  }
  const label = step.label.replaceAll("ส่วนงานพัสดุฯ ", "");
  if (label.includes("จัดทำรายงานขอซื้อขอจ้าง")) {
    return {
      title: "จัดทำเอกสาร",
      subtitle: "รายงานขอซื้อขอจ้าง • แต่งตั้งคณะกรรมการ • ประกวดราคา",
    };
  }
  if (label.startsWith("ประกาศร่าง")) {
    return {
      title: "ประกาศร่างประกวดราคาเพื่อรับฟังคำวิจารณ์",
      subtitle: "บนเว็บไซต์กรมบัญชีกลาง (e-GP)",
    };
  }
  if (label.startsWith("เผยแพร่ร่าง")) {
    return { title: "เผยแพร่ร่างประกวดราคาเพื่อรับฟังคำวิจารณ์" };
  }
  if (label.includes("จัดทำเอกสารประกาศ")) {
    return {
      title: "จัดทำเอกสาร",
      subtitle: "ผลการวิจารณ์ • ประกวดราคา",
    };
  }
  if (label.startsWith("ประกาศประกวดราคา")) {
    return {
      title: "ประกาศประกวดราคา",
      subtitle: "บนเว็บไซต์กรมบัญชีกลาง (e-GP)",
    };
  }
  if (label.startsWith("กำหนดขอรับ/ซื้อเอกสาร")) {
    return {
      title: "กำหนดขอรับ/ซื้อเอกสาร",
      subtitle: "ผู้สนใจสามารถดาวน์โหลดเอกสารจากเว็บไซต์กรมบัญชีกลาง (e-GP)",
    };
  }
  if (isBidSubmissionMilestone(label)) {
    return {
      title: `กำหนดวันเสนอราคา (เวลา ${bidSubmissionTimeLabel(step.bidSubmissionTimeSlot)})`,
      subtitle: "ยื่นเสนอราคาผ่านเว็บไซต์กรมบัญชีกลาง (e-GP)",
    };
  }
  if (label.includes("ตรวจสอบเอกสารเสนอราคา")) {
    return { title: "ตรวจสอบเอกสารเสนอราคา" };
  }
  if (isPresentMilestone(label)) {
    return {
      title: "กำหนดวันเวลาในการนำเสนอข้อเทคนิค (Present)",
      subtitle: step.isDateManuallyAdjusted ? undefined : "เลือกวันใดวันหนึ่ง",
    };
  }
  if (label.startsWith("คณะกรรมการฯ")) {
    return { title: "คณะกรรมการฯ พิจารณาคัดเลือกผู้ชนะ • ต่อรองราคา" };
  }
  if (label.startsWith("จัดทำเอกสารรายงานผล")) {
    return {
      title: "จัดทำเอกสาร",
      subtitle: "รายงานผลพิจารณา • ประกาศผู้ชนะ",
    };
  }
  if (label.startsWith("ประกาศผู้ชนะ")) {
    return {
      title: "ประกาศผู้ชนะการเสนอราคา",
      subtitle: "บนเว็บไซต์กรมบัญชีกลาง (e-GP)",
    };
  }
  if (label.startsWith("ระยะเวลาอุทธรณ์")) {
    return {
      title: "ระยะเวลาอุทธรณ์",
      subtitle: "ติดต่อให้ผู้รับจ้างนำส่งเอกสารเพื่อทำสัญญาและวางหลักประกันสัญญา",
    };
  }
  return { title: label };
}

export function TimelineDetail({
  projectId,
  initialProject,
  onAdjustStep,
  onResetSchedule,
  onDeleteProject,
  onUpdateBidSubmissionTime,
  onNavigateHome = () => window.location.assign("/"),
}: TimelineDetailProps) {
  const [project, setProject] = useState(initialProject);
  const [loading, setLoading] = useState(!initialProject);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [editingOrder, setEditingOrder] = useState<number | null>(null);
  const [newDate, setNewDate] = useState("");
  const [holidayDates, setHolidayDates] = useState<ReadonlySet<string>>(new Set());
  const [savingBidTime, setSavingBidTime] = useState(false);

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
        step.scheduledDate,
        addWorkingDays(step.scheduledDate, 2, holidayDates),
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
      addWorkingDays(
        step.scheduledDate,
        step.workingDaysToNext - 1,
        holidayDates,
      ),
    );
  }

  async function saveEdit(
    confirmShortening = false,
    confirmOverwrite = false,
    context?: EditContext,
  ) {
    if (!project) return;
    const editContext =
      context ??
      (editingOrder === null
        ? null
        : { order: editingOrder, date: newDate, version: project.version });
    if (!editContext) return;

    setEditError("");
    if (isWeekendIso(editContext.date)) {
      setEditError("เลือกไม่ได้ เพราะวันที่ใหม่ต้องไม่เป็นวันเสาร์หรือวันอาทิตย์");
      return;
    }
    const editingIndex = project.steps.findIndex(
      (step) => step.order === editContext.order,
    );
    const previousStep = project.steps[editingIndex - 1];
    if (previousStep && editContext.date <= previousStep.scheduledDate) {
      setEditError(
        `เลือกไม่ได้ เพราะวันที่ใหม่ต้องอยู่หลังขั้นตอนที่ ${previousStep.order} (${formatThaiDateWithWeekday(previousStep.scheduledDate)})`,
      );
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
      const updatedProject = await adjust(
        editContext.order,
        editContext.date,
        editContext.version,
        confirmShortening,
        confirmOverwrite,
      );
      setProject(updatedProject);
      setEditingOrder(null);
      setEditError("");
      await Swal.fire({
        title: "แก้วันที่สำเร็จ",
        text: `ปรับขั้นตอนที่ ${editContext.order} เป็น ${formatThaiDateWithWeekday(editContext.date)} แล้ว`,
        icon: "success",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#4338ca",
      });
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
          setEditingOrder(null);
          setEditError("");
          await saveEdit(true, confirmOverwrite, editContext);
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
          setEditingOrder(null);
          setEditError("");
          await saveEdit(confirmShortening, true, editContext);
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

  async function saveBidSubmissionTime(timeSlot: BidSubmissionTimeSlot) {
    if (!project) return;
    setSavingBidTime(true);
    setError("");
    try {
      const update = onUpdateBidSubmissionTime ??
        ((slot, version) => updateBidSubmissionTime(project.id, slot, version));
      setProject(await update(timeSlot, project.version));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกเวลาเสนอราคาได้");
    } finally {
      setSavingBidTime(false);
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
      return "3 วันทำการจากขั้นตอนก่อนหน้า";
    }
    return `${step.workingDaysToNext} วันทำการถึงขั้นตอนถัดไป`;
  }

  return (
    <main className="print-page mx-auto min-h-screen max-w-6xl overflow-x-hidden px-4 py-6 text-base sm:px-6 sm:py-8">
      <nav className="print-hidden mb-6 flex justify-end">
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
          <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
          <span>กลับหน้าโครงการ</span>
        </Link>
      </nav>
      <header data-testid="print-header" className="print-header rounded-3xl bg-slate-950 p-5 text-white shadow-xl sm:p-8">
        <p className="text-sm font-semibold text-indigo-300">Timeline โครงการ</p>
        <h1 className="mt-2 break-words text-2xl font-semibold sm:text-3xl">{project.name}</h1>
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
        <div data-testid="timeline-header-row" className="print-grid hidden grid-cols-[4rem_1fr_20rem_7rem] gap-3 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 lg:grid">
          <span>ลำดับ</span><span>ขั้นตอน</span><span>วันที่กำหนด</span><span className="print-hidden">จัดการ</span>
        </div>
        {project.steps.map((step, index) => {
          const presentation = stepPresentation(step, project.budgetCategory);
          return (
          <div data-testid="timeline-step" key={step.order} className="print-grid grid gap-3 border-t border-slate-100 px-4 py-4 text-base lg:grid-cols-[4rem_1fr_20rem_7rem]">
            <span className="font-semibold text-indigo-700"><span className="print-hidden lg:hidden">ขั้นตอนที่ </span>{step.order}</span>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">{presentation.title}</p>
              {presentation.subtitle ? (
                <p className="mt-1 text-sm text-slate-500">{presentation.subtitle}</p>
              ) : null}
              <p className="print-step-hint mt-1 text-sm text-slate-500">{formatWorkingDaysText(step)} {step.isDateManuallyAdjusted ? "· ปรับกำหนดการ" : ""}</p>
            </div>
            <div className="print-date font-medium text-slate-700">
              <span className="print-hidden mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">วันที่กำหนด</span>
              <span>{formatStepScheduledDate(index)}</span>
              {isBidSubmissionMilestone(step.label) ? (
                <>
                  <select
                    aria-label="เวลาเสนอราคา"
                    className="print-hidden mt-2 block min-h-10 w-full max-w-[10rem] rounded-lg border border-slate-300 bg-white px-3"
                    value={effectiveBidSubmissionTimeSlot(step.bidSubmissionTimeSlot)}
                    disabled={savingBidTime}
                    onChange={(event) => void saveBidSubmissionTime(event.target.value as BidSubmissionTimeSlot)}
                  >
                    {Object.entries(BID_SUBMISSION_TIME_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <span className="print-only"> · {bidSubmissionTimeLabel(step.bidSubmissionTimeSlot)}</span>
                </>
              ) : null}
            </div>
            <button className="print-hidden min-h-10 rounded-lg border border-indigo-200 bg-indigo-50 px-4 font-semibold text-indigo-700 hover:bg-indigo-100 lg:h-9" type="button" aria-label={`แก้วันที่ ขั้นตอนที่ ${step.order}`} onClick={() => { setEditingOrder(step.order); setNewDate(step.scheduledDate); setEditError(""); }}>แก้วันที่</button>
          </div>
          );
        })}
        <div className="print-grid grid gap-3 border-t-2 border-indigo-100 bg-indigo-50 px-4 py-4 text-base lg:grid-cols-[4rem_1fr_20rem_7rem]">
          <span className="font-semibold text-indigo-700">จบ</span><span className="text-lg font-semibold text-slate-900">วันที่เริ่มลงนามในสัญญาได้</span><span className="font-semibold text-indigo-800">{formatThaiDateWithWeekday(project.processEndDate)}</span><span className="print-hidden" />
        </div>
      </section>

      <div className="print-hidden mt-6 grid gap-3 sm:flex sm:flex-wrap sm:justify-end">
        <button type="button" onClick={() => window.print()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold">พิมพ์ Timeline</button>
        <button type="button" onClick={resetSchedule} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold">คืนค่าเริ่มต้น</button>
        <button type="button" onClick={removeProject} className="min-h-11 rounded-xl bg-rose-700 px-4 py-2 font-semibold text-white">ลบโครงการ</button>
      </div>

      {editingOrder !== null ? (
        <div className="print-hidden fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6" onSubmit={(event) => { event.preventDefault(); void saveEdit(); }}>
            <h2 className="text-xl font-semibold">แก้วันที่ขั้นตอนที่ {editingOrder}</h2>
            <label className="mt-5 block text-sm font-medium">วันที่ใหม่<input aria-label="วันที่ใหม่" className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" type="date" value={newDate} onChange={(event) => { setNewDate(event.target.value); setEditError(""); }} required /></label>
            {editError ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{editError}</p> : null}
            <div className="mt-6 grid gap-3 sm:flex sm:justify-end"><button type="button" onClick={() => { setEditingOrder(null); setEditError(""); }} className="min-h-11 rounded-xl border px-4 py-2">ยกเลิก</button><button type="submit" className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white">ตกลง</button></div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
