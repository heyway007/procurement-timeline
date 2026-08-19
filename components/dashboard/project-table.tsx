"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faCalendarCheck,
  faCalendarDays,
  faFileLines,
  faFlagCheckered,
  faFolderOpen,
  faGear,
  faSackDollar,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import type { ProjectRecord } from "@/lib/projects/types";
import { formatThaiDate } from "@/lib/ui/date-format";
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
    <div className="tceb-project-table overflow-hidden rounded-2xl border bg-white">
      <div data-testid="project-cards" className="divide-y divide-slate-100 xl:hidden">
        {projects.map((project) => (
          <article key={project.id} className="bg-white p-4 transition-colors first:bg-indigo-50/20">
            <div className="flex min-w-0 items-start gap-3">
              <span className="tceb-icon-badge" aria-hidden="true">
                <FontAwesomeIcon icon={faFileLines} />
              </span>
              <div className="min-w-0">
                <p className="break-words font-semibold text-slate-950">{project.name}</p>
                <p className="mt-1 text-sm text-slate-500">{project.ownerName}</p>
                {project.departmentName ? <p className="mt-1 break-words text-xs text-slate-500">{project.departmentName}</p> : null}
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  <FontAwesomeIcon icon={faSackDollar} aria-hidden="true" />
                  วิธี / วงเงิน
                </dt>
                <dd className="mt-1 font-medium text-slate-700">{budgetCategoryLabel(project.budgetCategory)}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                    <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" />
                    วันเริ่ม
                  </dt>
                  <dd className="mt-1 text-slate-800">{formatThaiDate(project.startDate)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                    <FontAwesomeIcon icon={faFlagCheckered} aria-hidden="true" />
                    เริ่มทำสัญญา
                  </dt>
                  <dd className="mt-1 text-slate-800">{formatThaiDate(project.processEndDate)}</dd>
                </div>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              <Link className="tceb-action-button inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800" href={`/projects/${project.id}`}>
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
        <table className="w-full min-w-[1200px] table-fixed divide-y divide-slate-200">
          <colgroup>
            <col className="w-[31%]" />
            <col className="w-[28%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="border-b border-indigo-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[31%] whitespace-nowrap px-3 py-3 align-middle"><span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faFolderOpen} className="text-indigo-600" aria-hidden="true" />โครงการ</span></th>
              <th className="w-[28%] whitespace-nowrap px-3 py-3 align-middle"><span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faSackDollar} className="text-emerald-600" aria-hidden="true" />วิธี / วงเงิน</span></th>
              <th className="whitespace-nowrap px-3 py-3 align-middle"><span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faCalendarDays} className="text-blue-600" aria-hidden="true" />วันเริ่ม</span></th>
              <th className="whitespace-nowrap px-3 py-3 align-middle"><span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faFlagCheckered} className="text-amber-500" aria-hidden="true" />วันที่เริ่มทำสัญญา</span></th>
              <th className="w-[16%] whitespace-nowrap px-3 py-3 text-center align-middle"><span className="inline-flex items-center justify-center gap-2"><FontAwesomeIcon icon={faGear} className="text-slate-500" aria-hidden="true" />จัดการ</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-indigo-50/40">
                <td className="px-3 py-3">
                  <div className="flex items-start gap-3">
                    <span className="tceb-icon-badge mt-0.5" aria-hidden="true">
                      <FontAwesomeIcon icon={faFileLines} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950">{project.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{project.ownerName}</p>
                      {project.departmentName ? <p className="mt-1 text-xs text-slate-500">{project.departmentName}</p> : null}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-700"><p className="font-medium">{budgetCategoryLabel(project.budgetCategory)}</p></td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-blue-800"><span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faCalendarDays} className="text-blue-500" aria-hidden="true" />{formatThaiDate(project.startDate)}</span></td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-amber-700"><span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faCalendarCheck} className="text-amber-500" aria-hidden="true" />{formatThaiDate(project.processEndDate)}</span></td>
                <td className="px-3 py-3 text-right">
                  <div className="inline-flex items-center gap-3">
                    <Link className="tceb-action-button inline-flex whitespace-nowrap items-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800" href={`/projects/${project.id}`}>
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
