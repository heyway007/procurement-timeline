"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowLeft,
  faBuilding,
  faBullhorn,
  faCalendarCheck,
  faCalendarDays,
  faCartShopping,
  faClock,
  faCircleInfo,
  faFileLines,
  faGlobe,
  faHandshake,
  faHourglassHalf,
  faPersonChalkboard,
  faPrint,
  faRotateLeft,
  faSackDollar,
  faShieldHalved,
  faTimeline,
  faTrashCan,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState, type CSSProperties } from "react";
import Swal from "sweetalert2";
import type { ProjectRecord } from "@/lib/projects/types";
import { budgetCategoryLabel } from "@/lib/projects/budget-category";
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

type StepTooltipPosition = {
  left: number;
  top: number;
  width: number;
  arrowLeft: number;
  placement: "above" | "below";
};

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

function stepIcon(presentation: StepPresentation): IconDefinition {
  const title = presentation.title;
  if (title.includes("อุทธรณ์")) return faHourglassHalf;
  if (title.includes("คณะกรรมการ")) return faUsers;
  if (title.includes("นำเสนอ")) return faPersonChalkboard;
  if (title.includes("เสนอราคา")) return faClock;
  if (title.includes("ขอรับ/ซื้อ")) return faCartShopping;
  if (title.includes("เผยแพร่")) return faGlobe;
  if (title.includes("ประกาศ")) return faBullhorn;
  if (title.includes("ตรวจสอบ")) return faCalendarCheck;
  return faFileLines;
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
  const [openStepDetails, setOpenStepDetails] = useState<number | null>(null);
  const [stepTooltipPosition, setStepTooltipPosition] = useState<StepTooltipPosition | null>(null);

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

  function toggleStepDetails(order: number, trigger: HTMLButtonElement) {
    if (openStepDetails === order) {
      setOpenStepDetails(null);
      setStepTooltipPosition(null);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(288, Math.max(0, window.innerWidth - 24));
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12));
    const placement = rect.top > 180 ? "above" : "below";
    const top = placement === "above" ? rect.top - 8 : rect.bottom + 8;
    const arrowLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - left, width - 12));

    setStepTooltipPosition({ left, top, width, arrowLeft, placement });
    setOpenStepDetails(order);
  }

  return (
    <main data-testid="timeline-detail-page" className="timeline-detail-page print-page mx-auto min-h-screen max-w-7xl overflow-x-clip px-4 py-5 pb-32 text-base sm:px-6 sm:py-8 sm:pb-8">
      <nav data-testid="timeline-detail-actions" className="timeline-detail-actions print-hidden mb-6 flex w-full items-center justify-between">
        <span className="inline-flex min-w-0 items-center gap-2 break-words text-lg font-bold tracking-tight text-indigo-900 sm:text-xl">
          <FontAwesomeIcon icon={faTimeline} className="shrink-0 text-indigo-600" aria-hidden="true" />
          <span className="text-lg font-bold">Timeline โครงการ</span>
        </span>
        <Link href="/" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-indigo-200 hover:text-indigo-700">
          <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
          <span>กลับหน้าโครงการ</span>
        </Link>
      </nav>

      <header data-testid="print-header" className="timeline-summary-header print-header rounded-2xl border border-slate-200 p-4 text-slate-950 shadow-sm sm:rounded-3xl sm:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <h1 className="mt-1 min-w-0 break-words text-center text-xl font-semibold max-[639px]:text-lg sm:text-left sm:text-2xl">{project.name}</h1>
          </div>
        </div>
        <div data-testid="timeline-summary" className="timeline-summary print-hidden mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_auto_auto] lg:items-stretch lg:justify-between">
          <div className="timeline-summary-stat timeline-summary-stat--budget">
            <span className="timeline-summary-stat-icon"><FontAwesomeIcon icon={faSackDollar} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p>ประเภทวงเงิน / วิธี</p><strong className="break-words whitespace-normal">{budgetCategoryLabel(project.budgetCategory)}</strong></div>
          </div>
          <div className="timeline-summary-stat timeline-summary-stat--department">
            <span className="timeline-summary-stat-icon"><FontAwesomeIcon icon={faBuilding} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p>ฝ่าย</p><strong className="break-words whitespace-normal">{project.departmentName || "-"}</strong></div>
          </div>
          <div className="timeline-summary-stat timeline-summary-stat--duration">
            <span className="timeline-summary-stat-icon"><FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p>ระยะเวลาดำเนินการทั้งหมด</p><strong className="break-words whitespace-normal">{totalWorkingDays(project)} วันทำการ</strong></div>
          </div>
          <div className="timeline-summary-stat timeline-summary-stat--status">
            <span className="timeline-summary-stat-icon"><FontAwesomeIcon icon={faShieldHalved} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p>สถานะโครงการ</p><strong className="break-words whitespace-normal">{slaStatusText(project)}</strong></div>
          </div>
        </div>
        <dl className="print-summary sr-only text-sm">
          <div data-testid="print-owner" className="min-w-0"><dt className="break-words whitespace-normal">ผู้จัดทำ Timeline</dt><dd className="min-w-0 break-words whitespace-normal">{project.ownerName}</dd></div>
          <div data-testid="print-department" className="min-w-0"><dt className="break-words whitespace-normal">ฝ่าย</dt><dd className="min-w-0 break-words whitespace-normal">{project.departmentName || "-"}</dd></div>
          <div data-testid="print-budget" className="min-w-0"><dt className="break-words whitespace-normal">ประเภทวงเงิน / วิธี</dt><dd className="min-w-0 break-words whitespace-normal">{budgetCategoryLabel(project.budgetCategory)}</dd></div>
          <div data-testid="print-total-days" className="min-w-0"><dt className="break-words whitespace-normal">จำนวนวันทำการทั้งหมด</dt><dd className="min-w-0 break-words whitespace-normal">{totalWorkingDays(project)} วันทำการ · {slaStatusText(project)}</dd></div>
        </dl>
        {project.note ? (
          <section data-testid="timeline-project-note" className="timeline-project-note timeline-summary-stat timeline-summary-stat--note mt-5">
            <span className="timeline-project-note-icon timeline-summary-stat-icon print-hidden"><FontAwesomeIcon icon={faCircleInfo} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="block">หมายเหตุ</p>
              <strong className="break-words whitespace-pre-wrap">{project.note}</strong>
            </div>
          </section>
        ) : null}
      </header>

      {project.scheduleStatus === "NEEDS_REVIEW" ? (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">กำหนดการนี้ได้รับผลกระทบจากวันหยุด กรุณาตรวจสอบวันที่ซึ่งปรับเอง</p>
      ) : null}
      {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-rose-800">{error}</p> : null}

      <section data-testid="timeline-table" className="timeline-table print-table mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div data-testid="timeline-header-row" className="timeline-header-row print-grid grid grid-cols-[1.75rem_3rem_minmax(0,1fr)_minmax(0,1.15fr)_3.5rem] items-center gap-2 border-b border-slate-100 bg-white px-2 py-3 text-[11px] font-semibold text-slate-500 sm:grid-cols-[2.5rem_3.25rem_minmax(0,1.4fr)_minmax(0,1.2fr)_6rem] sm:gap-3 sm:px-4 sm:text-sm lg:grid-cols-[4rem_4rem_1fr_20rem_7rem]">
          <span>ลำดับ</span><span className="timeline-header-icon-slot print-hidden" /><span>ขั้นตอน<span className="mobile-step-date-label"> / วันที่กำหนด</span></span><span className="mobile-date-header">วันที่กำหนด</span><span className="print-hidden text-center">จัดการ</span>
        </div>
        {project.steps.map((step, index) => {
          const presentation = stepPresentation(step, project.budgetCategory);
          return (
          <div data-testid="timeline-step" data-order={step.order} key={step.order} className="timeline-step print-grid grid grid-cols-[1.75rem_3rem_minmax(0,1fr)_minmax(0,1.15fr)_3.5rem] items-center gap-2 border-t border-slate-100 px-2 py-3 text-xs sm:grid-cols-[2.5rem_3.25rem_minmax(0,1.4fr)_minmax(0,1.2fr)_6rem] sm:gap-3 sm:px-4 sm:py-4 sm:text-base lg:grid-cols-[4rem_4rem_1fr_20rem_7rem]">
            <span data-testid="timeline-step-order" className="self-center text-center font-semibold text-indigo-700"><span className="print-hidden hidden">ขั้นตอนที่ </span>{step.order}</span>
            <div className="timeline-step-main">
              <span data-testid="timeline-step-icon" className="timeline-step-icon print-hidden h-12 w-12 max-[639px]:h-9 max-[639px]:w-9 self-center" aria-hidden="true"><FontAwesomeIcon icon={stepIcon(presentation)} /></span>
              <div className="timeline-step-content min-w-0">
                <div className="timeline-step-title-row flex min-w-0 items-center gap-2">
                      <p className="min-w-0 flex-1 break-words text-lg font-semibold text-slate-900 max-[639px]:text-sm sm:text-lg">{presentation.title}</p>
                  <div data-testid="timeline-step-details" className="timeline-step-details timeline-step-details--inline-mobile print-hidden">
                    <button type="button" className="timeline-step-details-trigger timeline-step-details-trigger--inline-mobile timeline-step-details-trigger--aligned-mobile" aria-label={`ดูรายละเอียด ${presentation.title} ขั้นตอนที่ ${step.order}`} aria-expanded={openStepDetails === step.order} aria-controls={`timeline-step-tooltip-${step.order}`} onClick={(event) => toggleStepDetails(step.order, event.currentTarget)}>
                      <FontAwesomeIcon icon={faCircleInfo} aria-hidden="true" />
                    </button>
                    <div id={`timeline-step-tooltip-${step.order}`} data-testid="timeline-step-tooltip" role="dialog" aria-label={`รายละเอียด ${presentation.title}`} hidden={openStepDetails !== step.order} className={`timeline-step-tooltip ${stepTooltipPosition?.placement === "below" ? "timeline-step-tooltip--below" : "timeline-step-tooltip--above"}`} style={stepTooltipPosition && openStepDetails === step.order ? { left: `${stepTooltipPosition.left}px`, top: `${stepTooltipPosition.top}px`, width: `${stepTooltipPosition.width}px`, "--timeline-tooltip-arrow-left": `${stepTooltipPosition.arrowLeft}px` } as CSSProperties : undefined}>
                      <div className="timeline-step-tooltip-header">
                        <strong>รายละเอียดขั้นตอน</strong>
                        <button type="button" className="timeline-step-tooltip-close" aria-label="ปิดรายละเอียด" onClick={() => { setOpenStepDetails(null); setStepTooltipPosition(null); }}>
                          <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                        </button>
                      </div>
                      {presentation.subtitle ? (
                        <p className="break-words text-sm text-slate-500">{presentation.subtitle}</p>
                      ) : null}
                      <p className="mt-1 break-words text-sm text-slate-500">{formatWorkingDaysText(step)} {step.isDateManuallyAdjusted ? "· ปรับกำหนดการ" : ""}</p>
                    </div>
                  </div>
                </div>
                <div className="timeline-step-inline-details">
                  {presentation.subtitle ? (
                    <p className="mt-1 break-words text-sm text-slate-500 max-[639px]:text-[11px] sm:text-sm">{presentation.subtitle}</p>
                  ) : null}
                  <p className="print-step-hint mt-1 text-[11px] text-slate-500 sm:text-sm">{formatWorkingDaysText(step)} {step.isDateManuallyAdjusted ? "· ปรับกำหนดการ" : ""}</p>
                </div>
              </div>
              <div className="timeline-step-date print-date min-w-0 break-words font-medium text-slate-700">
              <span className="print-hidden hidden">วันที่กำหนด</span>
              <span>{formatStepScheduledDate(index)}</span>
              {isBidSubmissionMilestone(step.label) ? (
                <>
                  <select
                    aria-label="เวลาเสนอราคา"
                    className="print-hidden mt-2 block min-h-9 w-full max-w-[10rem] rounded-lg border border-slate-300 bg-white px-1 text-[11px] sm:min-h-10 sm:px-3 sm:text-base"
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
            </div>
            <button className="timeline-step-edit-button print-hidden h-20 min-h-0 max-[639px]:h-14 max-[639px]:min-h-14 max-[639px]:w-max max-[639px]:justify-self-end sm:h-12 self-center rounded-lg border border-indigo-200 bg-white px-1 text-[11px] font-semibold leading-tight text-indigo-700 hover:bg-indigo-50 max-[639px]:px-2 max-[639px]:text-[10px] sm:px-3 sm:text-sm lg:h-9 lg:px-4 lg:text-base" type="button" aria-label={`แก้วันที่ ขั้นตอนที่ ${step.order}`} onClick={() => { setEditingOrder(step.order); setNewDate(step.scheduledDate); setEditError(""); }}>แก้วันที่</button>
          </div>
          );
        })}
        <div className="timeline-step-end print-grid grid grid-cols-[1.75rem_3rem_minmax(0,1fr)_minmax(0,1.15fr)_3.5rem] items-center gap-2 border-t-2 border-indigo-100 bg-indigo-50/40 px-2 py-3 text-xs sm:grid-cols-[2.5rem_3.25rem_minmax(0,1.4fr)_minmax(0,1.2fr)_6rem] sm:gap-3 sm:px-4 sm:py-4 sm:text-base lg:grid-cols-[4rem_4rem_1fr_20rem_7rem]">
          <span className="self-center text-center font-semibold text-indigo-700">จบ</span><div className="timeline-step-main"><span className="timeline-step-icon print-hidden h-12 w-12 self-center" aria-hidden="true"><FontAwesomeIcon icon={faHandshake} /></span><span className="timeline-step-content break-words text-sm font-semibold text-slate-900 sm:text-lg">วันที่เริ่มลงนามในสัญญาได้</span><span className="timeline-step-date break-words font-semibold text-indigo-800">{formatThaiDateWithWeekday(project.processEndDate)}</span></div><span className="timeline-step-end-action print-hidden" />
        </div>
      </section>

      <div data-testid="timeline-bottom-actions" className="timeline-bottom-actions print-hidden mt-6 grid gap-3 sm:flex sm:flex-wrap sm:justify-end">
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-semibold"><FontAwesomeIcon icon={faPrint} aria-hidden="true" />พิมพ์ Timeline</button>
        <button type="button" onClick={resetSchedule} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-semibold"><FontAwesomeIcon icon={faRotateLeft} aria-hidden="true" />คืนค่าเริ่มต้น</button>
        <button type="button" onClick={removeProject} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-800"><FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />ลบโครงการ</button>
      </div>

      {editingOrder !== null ? (
        <div className="print-hidden fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6" onSubmit={(event) => { event.preventDefault(); void saveEdit(); }}>
            <h2 className="text-xl font-semibold">แก้วันที่ขั้นตอนที่ {editingOrder}</h2>
            <label className="mt-5 block min-w-0 text-sm font-medium">วันที่ใหม่<input aria-label="วันที่ใหม่" className="mt-2 min-h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-300 px-3 text-base appearance-none" type="date" value={newDate} onChange={(event) => { setNewDate(event.target.value); setEditError(""); }} required /></label>
            {editError ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{editError}</p> : null}
            <div className="mt-6 grid gap-3 sm:flex sm:justify-end"><button type="button" onClick={() => { setEditingOrder(null); setEditError(""); }} className="min-h-11 rounded-xl border px-4 py-2">ยกเลิก</button><button type="submit" className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white">ตกลง</button></div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
