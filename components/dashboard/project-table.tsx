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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-4">โครงการ</th>
              <th className="px-5 py-4">วงเงิน</th>
              <th className="px-5 py-4">วันเริ่ม</th>
              <th className="px-5 py-4">วันสิ้นสุด</th>
              <th className="px-5 py-4"><span className="sr-only">เปิด</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-indigo-50/40">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-950">{project.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{project.ownerName}</p>
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
