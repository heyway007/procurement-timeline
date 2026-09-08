"use client";

import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faCalendarCheck,
  faChevronLeft,
  faChevronRight,
  faMagnifyingGlass,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import Link from "next/link";
import Swal from "sweetalert2";
import type { CreateProjectInput, ProjectRecord } from "@/lib/projects/types";
import { formatProjectName } from "@/lib/projects/name";
import { createProject, deleteProject, getProjects } from "@/lib/ui/api-client";
import { ProjectForm } from "./project-form";
import { ProjectTable } from "./project-table";

const PROJECTS_PER_PAGE = 10;

export function Dashboard({ initialProjects }: { initialProjects?: ProjectRecord[] }) {
  const [projects, setProjects] = useState(initialProjects ?? []);
  const [loading, setLoading] = useState(initialProjects === undefined);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);

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
        formatProjectName(project.name).toLocaleLowerCase("th").includes(normalized) ||
        project.ownerName.toLocaleLowerCase("th").includes(normalized) ||
        (project.departmentName ?? "").toLocaleLowerCase("th").includes(normalized);
      const overlapsFrom = !from || project.processEndDate >= from;
      const overlapsTo = !to || project.startDate <= to;
      return matchesQuery && overlapsFrom && overlapsTo;
    });
  }, [from, projects, query, to]);

  const pageCount = Math.max(1, Math.ceil(visibleProjects.length / PROJECTS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pagedProjects = visibleProjects.slice(
    (currentPage - 1) * PROJECTS_PER_PAGE,
    currentPage * PROJECTS_PER_PAGE,
  );

  useEffect(() => {
    setPage(1);
  }, [from, query, to]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  async function handleCreate(input: CreateProjectInput): Promise<{ id: string }> {
    const result = await createProject(input);
    setProjects((current) => [result.project, ...current]);
    setPage(1);
    return { id: result.project.id };
  }

  async function handleDelete(project: ProjectRecord) {
    const confirmation = await Swal.fire({
      title: "ลบ Timeline นี้?",
      text: `ต้องการลบ ${formatProjectName(project.name)} ใช่หรือไม่`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ Timeline",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#be123c",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    try {
      await deleteProject(project.id, project.version);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      await Swal.fire({
        title: "ลบ Timeline สำเร็จ",
        icon: "success",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#4338ca",
      });
    } catch {
      setError("ไม่สามารถลบ Timeline ได้ กรุณาลองใหม่อีกครั้ง");
    }
  }

  return (
    <main className="tceb-page-shell mx-auto min-h-dvh max-w-7xl overflow-x-clip px-4 py-6 pb-64 sm:px-6 sm:py-8 sm:pb-8 lg:px-8">
      <header data-testid="dashboard-header" className="tceb-hero tceb-hero--flat flex flex-col justify-between gap-5 px-0 py-5 sm:flex-row sm:items-center sm:px-0 sm:py-6">
        <div className="relative z-10 flex min-w-0 items-center gap-4">
          <Image src="/logo-tceb.webp" alt="TCEB" width={88} height={88} priority className="h-20 w-20 shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-indigo-700">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <FontAwesomeIcon icon={faCalendarCheck} aria-hidden="true" />
              </span>
              Procurement Timeline
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl">แผนงานจัดซื้อจัดจ้าง</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">วางแผนวันดำเนินงานอัตโนมัติตามวันทำการราชการไทย</p>
          </div>
        </div>
        <div className="relative z-10 grid gap-3 sm:flex sm:shrink-0">
          <Link href="/holidays" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white/80 px-4 font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50">
            <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" />
            จัดการวันหยุด
          </Link>
          <button className="tceb-action-button inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800" type="button" onClick={() => setCreating(true)}>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            สร้าง Timeline
          </button>
        </div>
      </header>

      <section aria-label="ตัวกรองโครงการ" className="tceb-filter-panel my-6 grid gap-4 rounded-2xl border p-4 sm:my-7 sm:grid-cols-3 sm:p-5">
        <label className="min-w-0 text-sm font-medium text-slate-700">
          <span className="flex items-center gap-2">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-indigo-600" aria-hidden="true" />
            ค้นหาโครงการ
          </span>
          <span className="relative mt-2 block">
            <input className="min-h-11 w-full min-w-0 max-w-full rounded-xl border px-3 pr-10 text-base" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อโครงการหรือผู้รับผิดชอบ" />
            <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          </span>
        </label>
        <label className="min-w-0 text-sm font-medium text-slate-700">
          <span className="flex items-center gap-2">
            <FontAwesomeIcon icon={faCalendarDays} className="text-indigo-600" aria-hidden="true" />
            ช่วงวันที่เริ่ม
          </span>
          <input className="mt-2 min-h-11 w-full min-w-0 max-w-full rounded-xl border px-3 text-base appearance-none" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="min-w-0 text-sm font-medium text-slate-700">
          <span className="flex items-center gap-2">
            <FontAwesomeIcon icon={faCalendarDays} className="text-indigo-600" aria-hidden="true" />
            ถึงวันที่
          </span>
          <input className="mt-2 min-h-11 w-full min-w-0 max-w-full rounded-xl border px-3 text-base appearance-none" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </section>

      {loading ? <p className="py-12 text-center text-slate-600">กำลังโหลด Timeline...</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800" role="alert">{error}</p> : null}
      {!loading ? <ProjectTable projects={pagedProjects} onDelete={handleDelete} /> : null}
      {!loading && visibleProjects.length > PROJECTS_PER_PAGE ? (
        <nav data-testid="project-pagination" aria-label="การแบ่งหน้าโครงการ" className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>แสดง {(currentPage - 1) * PROJECTS_PER_PAGE + 1}–{Math.min(currentPage * PROJECTS_PER_PAGE, visibleProjects.length)} จาก {visibleProjects.length} โครงการ</p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button type="button" aria-label="หน้าก่อนหน้า" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, Math.min(current, pageCount) - 1))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
              <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
              ก่อนหน้า
            </button>
            <span aria-live="polite" className="whitespace-nowrap font-semibold text-indigo-700">หน้า {currentPage} จาก {pageCount}</span>
            <button type="button" aria-label="หน้าถัดไป" disabled={currentPage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, Math.max(current, currentPage) + 1))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
              ถัดไป
              <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
            </button>
          </div>
        </nav>
      ) : null}
      {creating ? <ProjectForm onCancel={() => setCreating(false)} onCreate={handleCreate} /> : null}
    </main>
  );
}
