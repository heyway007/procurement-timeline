"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import type { CreateProjectInput } from "@/lib/projects/types";
import { ApiError } from "@/lib/ui/api-client";
import { formatThaiDate, isWeekendIso } from "@/lib/ui/date-format";
import { BUDGET_CATEGORY_OPTIONS, validateBudgetCategory, type BudgetCategory } from "@/lib/projects/budget-category";

type ProjectFormProps = {
  onCancel: () => void;
  onCreate: (input: CreateProjectInput) => Promise<{ id: string }>;
};

const fieldClass =
  "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100";

const DEPARTMENT_OPTIONS = [
  "ฝ่ายส่งเสริมการจัดประชุมนานาชาติ",
  "ฝ่ายการตลาดไมซ์ในประเทศ",
  "สำนักส่งเสริมการจัดประชุมและนิทรรศการ ภาคเหนือ",
  "ฝ่ายส่งเสริมการจัดประชุมและการเดินทางเพื่อเป็นรางวัล",
  "ฝ่ายบริหาร",
  "ฝ่ายภาพลักษณ์และสื่อสารองค์กร",
  "ทีมบริหารดิจิทัล",
  "สำนักผู้อำนวยการ",
  "ฝ่ายพัฒนาการจัดงานเมกะอีเว้นท์และเทศกาลนานาชาติ",
  "สำนักส่งเสริมการจัดประชุมและนิทรรศการ ภาคตะวันออกเฉียงเหนือ",
  "ฝ่ายไมซ์อินเทลลิเจนท์และนวัตกรรม",
  "ฝ่ายอุตสาหกรรมการแสดงสินค้านานาชาติ",
  "ฝ่ายพัฒนาศักยภาพอุตสาหกรรมไมซ์",
  "สำนักส่งเสริมการจัดประชุมและนิทรรศการ ภาคกลาง",
  "สำนักส่งเสริมการจัดประชุมและนิทรรศการ ภาคใต้",
  "ส่วนงานตลาดดิจิทัล",
  "ผู้ชำนาญการ",
  "ฝ่ายตรวจสอบภายใน",
  "ฝ่ายพัฒนากลยุทธ์องค์กร",
  "ฝ่ายบัญชีและการเงิน",
];

export function ProjectForm({ onCancel, onCreate }: ProjectFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isWeekendIso(startDate)) {
      setError("วันที่เริ่มต้นต้องไม่เป็นวันเสาร์หรือวันอาทิตย์");
      return;
    }
    const form = new FormData(event.currentTarget);
    const budget = Number(form.get("budget"));
    const budgetCategory = String(form.get("budgetCategory")) as BudgetCategory;
    try {
      validateBudgetCategory(budgetCategory, budget);
    } catch {
      setError("ประเภทวงเงินไม่ตรงกับวงเงินจริง");
      return;
    }
    const input: CreateProjectInput = {
      name: String(form.get("name") ?? ""),
      ownerName: String(form.get("ownerName") ?? ""),
      departmentName: String(form.get("departmentName") ?? ""),
      budget,
      budgetCategory,
      startDate,
      note: String(form.get("note") ?? ""),
    };
    setPending(true);
    try {
      const created = await onCreate(input);
      await Swal.fire({
        title: "สร้าง Timeline สำเร็จ",
        text: "สร้าง Timeline โครงการเรียบร้อยแล้ว",
        icon: "success",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#4338ca",
      });
      onCancel();
      router.push(`/projects/${created.id}`);
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "ไม่สามารถบันทึก Timeline ได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/40 p-2 sm:items-center sm:p-6">
      <section
        aria-labelledby="create-project-title"
        className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="min-w-0 overflow-y-auto px-4 py-5 [scrollbar-gutter:stable] sm:px-8 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-indigo-700">Timeline ใหม่</p>
              <h2 id="create-project-title" className="mt-1 text-xl font-semibold text-slate-950 sm:text-2xl">
                ข้อมูลโครงการ
              </h2>
            </div>
            <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
              ปิด
            </button>
          </div>

          <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2">
              ชื่อโครงการ
              <input className={fieldClass} name="name" required maxLength={200} />
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              ฝ่าย
              <select aria-label="ฝ่าย" className={fieldClass} name="departmentName" required defaultValue="">
                <option value="" disabled>เลือกฝ่าย</option>
                {DEPARTMENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              ประเภทวงเงิน
              <select aria-label="ประเภทวงเงิน" className={fieldClass} name="budgetCategory" required defaultValue="">
                <option value="" disabled>เลือกประเภทวงเงิน</option>
                {BUDGET_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              วงเงินจัดจ้าง (บาท)
              <input aria-label="วงเงินจัดจ้าง (บาท)" className={fieldClass} name="budget" type="number" min="500001" step="0.01" required />
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              ผู้จัดทำ Timeline
              <input className={fieldClass} name="ownerName" required maxLength={120} />
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2">
              วันที่เริ่มต้น
              <input
                className={fieldClass}
                name="startDate"
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
              {startDate ? (
                <span className="mt-2 block text-xs font-normal text-slate-500">
                  วันที่ภาษาไทย: {formatThaiDate(startDate)}
                </span>
              ) : null}
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2">
              หมายเหตุ
              <textarea className={`${fieldClass} min-h-24`} name="note" maxLength={2000} />
            </label>

            {error ? (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:col-span-2" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-slate-300 px-5 font-semibold text-slate-700">
                ยกเลิก
              </button>
              <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-indigo-700 px-5 font-semibold text-white disabled:opacity-60">
                {pending ? "กำลังสร้าง..." : "สร้าง Timeline"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
