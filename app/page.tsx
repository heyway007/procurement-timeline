export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold tracking-wide text-indigo-700">
            Procurement Timeline
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            แผนงานจัดซื้อจัดจ้าง
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            วางแผนวันดำเนินงานอัตโนมัติตามวันทำการราชการไทย
          </p>
        </div>
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          type="button"
        >
          สร้าง Timeline
        </button>
      </header>

      <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Timeline ของทุกโครงการจะแสดงที่นี่
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          เริ่มต้นด้วยการสร้าง Timeline โครงการแรก
        </p>
      </section>
    </main>
  );
}
