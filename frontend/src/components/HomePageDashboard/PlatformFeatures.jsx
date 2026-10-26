import {
  BellRing,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  FileCheck2,
  GraduationCap,
  UsersRound,
} from "lucide-react";

const features = [
  { icon: GraduationCap, title: "Student profiles", description: "Maintain academic details, profile information, and supporting documents for placement activities." },
  { icon: UsersRound, title: "Placement sessions", description: "Organize student cohorts around configured placement sessions and academic records." },
  { icon: BriefcaseBusiness, title: "Drive management", description: "TPO staff create and manage company drives, requirements, and application windows." },
  { icon: FileCheck2, title: "Applications & eligibility", description: "Review configured eligibility criteria, applications, and recruitment status in one workflow." },
  { icon: BellRing, title: "Announcements", description: "Use the available notification tools to share placement-related updates with students." },
  { icon: ChartNoAxesCombined, title: "Administration & reports", description: "Manage student and drive records and use the reporting and spreadsheet tools available to TPO staff." },
];

export default function PlatformFeatures() {
  return (
    <section id="features" className="border-t border-slate-100 bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-bold text-indigo-700">CAMPUSFLOW PLATFORM</span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">The tools behind the workflow</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">A role-based workspace for the core tasks involved in coordinating campus recruitment.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
