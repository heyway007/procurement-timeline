"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CreateProjectInput, ProjectRecord } from "@/lib/projects/types";
import { createProject, getProjects } from "@/lib/ui/api-client";
import { ProjectForm } from "./project-form";
import { ProjectTable } from "./project-table";

export function Dashboard({ initialProjects }: { initialProjects?: ProjectRecord[] }) {
  const [projects, setProjects] = useState(initialProjects ?? []);
  const [loading, setLoading] = useState(initialProjects === undefined);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (initialProjects !== undefined) return;
    getProjects()
      .then(setProjects)
      .catch(() => setError("ไม่สามารถโหลดข้อมูลโครงการได้"))
      .finally(() => setLoading(false));
  }, [initialProjects]);

  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return projects.filter((project) => {
      const matchesQuery =
        !normalized ||
        project.name.toLocaleLowerCase("th").includes(normalized) ||
        project.ownerName.toLocaleLowerCase("th").includes(normalized) ||
        (project.departmentName ?? "").toLocaleLowerCase("th").includes(normalized);
      const overlapsFrom = !from || project.processEndDate >= from;
      const overlapsTo = !to || project.startDate <= to;
      return matchesQuery && overlapsFrom && overlapsTo;
    });
  }, [from, projects, query, to]);

  async function handleCreate(input: CreateProjectInput): Promise<{ id: string }> {
    const result = await createProject(input);
    setProjects((current) => [result.project, ...current]);
    return { id: result.project.id };
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold tracking-wide text-indigo-700">Procurement Timeline</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">แผนงานจัดซื้อจัดจ้าง</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">วางแผนวันดำเนินงานอัตโนมัติตามวันทำการราชการไทย</p>
        </div>
        <div className="flex gap-3"><Link href="/holidays" className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 px-4 font-semibold text-slate-700">จัดการวันหยุด</Link><button className="inline-flex min-h-12 items-center justify-center rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800" type="button" onClick={() => setCreating(true)}>สร้าง Timeline</button></div>
      </header>

      <section aria-label="ตัวกรองโครงการ" className="my-7 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          ค้นหาโครงการ
          <input className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อโครงการหรือผู้รับผิดชอบ" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          ช่วงวันที่เริ่ม
          <input className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          ถึงวันที่
          <input className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </section>

      {loading ? <p className="py-12 text-center text-slate-600">กำลังโหลด Timeline...</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800" role="alert">{error}</p> : null}
      {!loading ? <ProjectTable projects={visibleProjects} /> : null}
      {creating ? <ProjectForm onCancel={() => setCreating(false)} onCreate={handleCreate} /> : null}
    </main>
  );
}
