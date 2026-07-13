import Link from "next/link";
import type { ProjectRecord } from "@/lib/projects/types";
import { formatBaht, formatThaiDate } from "@/lib/ui/date-format";
import { budgetCategoryLabel } from "@/lib/projects/budget-category";

export function ProjectTable({ projects }: { projects: ProjectRecord[] }) {
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
      <div className="divide-y divide-slate-100 md:hidden">
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
            <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-indigo-700 px-4 font-semibold text-white" href={`/projects/${project.id}`}>
              เปิด Timeline
            </Link>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-4">โครงการ</th>
              <th className="px-5 py-4">วงเงิน</th>
              <th className="px-5 py-4">วันเริ่ม</th>
              <th className="px-5 py-4">วันที่เริ่มทำสัญญา</th>
              <th className="px-5 py-4"><span className="sr-only">เปิด</span></th>
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
                  <Link className="font-semibold text-indigo-700 hover:text-indigo-900" href={`/projects/${project.id}`}>
                    เปิด Timeline
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
