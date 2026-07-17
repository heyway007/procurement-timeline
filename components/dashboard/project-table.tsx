"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import type { ProjectRecord } from "@/lib/projects/types";
import { formatBaht, formatThaiDate } from "@/lib/ui/date-format";
import { budgetCategoryLabel } from "@/lib/projects/budget-category";

type ProjectTableProps = {
  projects: ProjectRecord[];
  onDelete: (project: ProjectRecord) => void;
};

export function ProjectTable({ projects, onDelete }: ProjectTableProps) {
  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">ยังไม่พบ Timeline</h2>
        <p className="mt-2 text-sm text-slate-600">ลองเปลี่ยนคำค้นหา หรือสร้าง Timeline โครงการใหม่</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div data-testid="project-cards" className="divide-y divide-slate-100 xl:hidden">
        {projects.map((project) => (
          <article key={project.id} className="p-4">
            <div className="min-w-0">
              <p className="break-words font-semibold text-slate-950">{project.name}</p>
              <p className="mt-1 text-sm text-slate-500">{project.ownerName}</p>
              {project.departmentName ? <p className="mt-1 break-words text-xs text-slate-500">{project.departmentName}</p> : null}
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">วงเงิน</dt>
                <dd className="mt-1 text-slate-800">{formatBaht(project.budget)}</dd>
                <dd className="mt-1 text-xs text-slate-500">{budgetCategoryLabel(project.budgetCategory)}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">วันเริ่ม</dt>
                  <dd className="mt-1 text-slate-800">{formatThaiDate(project.startDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">เริ่มทำสัญญา</dt>
                  <dd className="mt-1 text-slate-800">{formatThaiDate(project.processEndDate)}</dd>
                </div>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              <Link className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800" href={`/projects/${project.id}`}>
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                เปิด Timeline
              </Link>
              <button type="button" onClick={() => onDelete(project)} aria-label={`ลบ Timeline ${project.name}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50">
                <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>
      <div data-testid="desktop-project-table" className="hidden overflow-x-auto xl:block">
        <table className="min-w-[1100px] table-fixed divide-y divide-slate-200">
          <colgroup>
            <col className="w-[41%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[41%] px-5 py-4">โครงการ</th>
              <th className="px-5 py-4">วงเงิน</th>
              <th className="px-5 py-4">วันเริ่ม</th>
              <th className="px-5 py-4">วันที่เริ่มทำสัญญา</th>
              <th className="w-[19%] px-5 py-4"><span className="sr-only">เปิด</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-indigo-50/40">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-950">{project.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{project.ownerName}</p>
                  {project.departmentName ? <p className="mt-1 text-xs text-slate-500">{project.departmentName}</p> : null}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700"><p>{formatBaht(project.budget)}</p><p className="mt-1 text-xs text-slate-500">{budgetCategoryLabel(project.budgetCategory)}</p></td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">{formatThaiDate(project.startDate)}</td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">{formatThaiDate(project.processEndDate)}</td>
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex items-center gap-3">
                    <Link className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800" href={`/projects/${project.id}`}>
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                      เปิด Timeline
                    </Link>
                    <button type="button" onClick={() => onDelete(project)} aria-label={`ลบ Timeline ${project.name}`} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50">
                      <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
