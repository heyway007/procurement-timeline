"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { budgetCategoryOptionsForProjectStatus, type BudgetCategory } from "@/lib/projects/budget-category";
import { DEPARTMENT_OPTIONS } from "@/lib/projects/department-options";
import type { ProjectRecord, UpdateProjectInput } from "@/lib/projects/types";
import { defaultTimelineWorkingDays, timelineWorkingDays } from "@/lib/schedule/approved-template";
import { ApiError, updateProjectDetails } from "@/lib/ui/api-client";
import { formatThaiDateWithWeekday } from "@/lib/ui/date-format";

type ProjectDetailsEditorProps = {
  project: ProjectRecord;
  onCancel: () => void;
  onSaved: (updated: ProjectRecord) => void;
};

const fieldClass = "mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 focus-visible:outline-2 focus-visible:outline-indigo-600";
const secondaryButtonClass = "min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60";
const primaryButtonClass = "min-h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60";

export function ProjectDetailsEditor({ project, onCancel, onSaved }: ProjectDetailsEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const [budgetCategory, setBudgetCategory] = useState(project.budgetCategory);
  const [confirmation, setConfirmation] = useState<UpdateProjectInput | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const departmentName = project.departmentName ?? "";
  const methodChanged = budgetCategory !== project.budgetCategory;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    if (confirmation) backButtonRef.current?.focus();
    else projectNameRef.current?.focus();
  }, [confirmation]);

  function closeEditor() {
    dialogRef.current?.close();
    onCancel();
  }

  function returnToForm() {
    setError("");
    setConfirmation(null);
  }

  async function save(input: UpdateProjectInput) {
    setError("");
    setPending(true);
    try {
      const updated = await updateProjectDetails(project.id, input);
      dialogRef.current?.close();
      onSaved(updated);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "ไม่สามารถบันทึกข้อมูลโครงการได้ กรุณาลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") ?? "");
    const department = String(values.get("departmentName") ?? "");
    const input: UpdateProjectInput = {
      ...(name !== project.name ? { name } : {}),
      ...(department !== departmentName ? { departmentName: department } : {}),
      budgetCategory,
      startDate: project.startDate,
      version: project.version,
      confirmReset: methodChanged,
    };
    if (methodChanged) {
      setError("");
      setConfirmation(input);
    } else {
      void save(input);
    }
  }

  const durationPreview = methodChanged ? (
    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-indigo-50 p-4 text-sm text-slate-700">
      <div><dt>SLA เดิม</dt><dd className="mt-1 font-semibold">{timelineWorkingDays(project)} วันทำการ</dd></div>
      <div><dt>SLA ใหม่</dt><dd className="mt-1 font-semibold">{defaultTimelineWorkingDays(budgetCategory, project.projectStatusType)} วันทำการ</dd></div>
    </dl>
  ) : null;
  const errorMessage = error ? (
    <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
  ) : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="project-details-editor-title"
      aria-modal="true"
      className="print-hidden m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-slate-950 shadow-2xl backdrop:bg-slate-950/40 sm:p-6"
      onCancel={(event) => {
        event.preventDefault();
        if (pending) return;
        if (confirmation) returnToForm();
        else closeEditor();
      }}
    >
      <h2 id="project-details-editor-title" className="text-xl font-semibold">แก้ไขข้อมูลโครงการ</h2>
      <form hidden={Boolean(confirmation)} className="mt-5" onSubmit={handleSubmit} aria-busy={pending}>
        <fieldset disabled={pending} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            ชื่อโครงการ
            <input ref={projectNameRef} className={fieldClass} name="name" defaultValue={project.name} maxLength={200} />
          </label>
          <div>
            <label htmlFor="project-details-budget-category" className="block text-sm font-medium text-slate-700">วิธี / วงเงิน</label>
            <select id="project-details-budget-category" className={fieldClass} value={budgetCategory} onChange={(event) => setBudgetCategory(event.target.value as BudgetCategory)}>
              {budgetCategoryOptionsForProjectStatus(project.projectStatusType).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="project-details-department" className="block text-sm font-medium text-slate-700">ฝ่าย</label>
            <select id="project-details-department" className={fieldClass} name="departmentName" defaultValue={departmentName}>
              <option value="">ไม่ระบุฝ่าย</option>
              {departmentName && !DEPARTMENT_OPTIONS.some((option) => option === departmentName) ? (
                <option value={departmentName}>{departmentName}</option>
              ) : null}
              {DEPARTMENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          {!confirmation ? <div aria-live="polite">{durationPreview}</div> : null}
          {!confirmation ? errorMessage : null}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className={secondaryButtonClass} onClick={closeEditor}>ยกเลิก</button>
            <button type="submit" className={primaryButtonClass}>{pending ? "กำลังบันทึก…" : "บันทึก"}</button>
          </div>
        </fieldset>
      </form>
      {confirmation ? (
        <div className="mt-5 space-y-4" aria-busy={pending}>
          <h3 className="font-semibold">ยืนยันการเปลี่ยนวิธี / วงเงิน</h3>
          {durationPreview}
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            ระบบจะคำนวณตารางใหม่จากวันเริ่มต้นเดิม ({formatThaiDateWithWeekday(project.startDate)}) และแทนที่วันที่เคยปรับเอง
          </p>
          {errorMessage}
          <div className="flex flex-wrap justify-end gap-3">
            <button ref={backButtonRef} type="button" className={secondaryButtonClass} onClick={returnToForm} disabled={pending}>กลับไปแก้ไข</button>
            <button type="button" className={primaryButtonClass} onClick={() => void save(confirmation)} disabled={pending}>{pending ? "กำลังบันทึก…" : "ยืนยันและบันทึก"}</button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
