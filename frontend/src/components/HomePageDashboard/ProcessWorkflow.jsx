import {
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  FileText,
  UserRound,
} from "lucide-react";

const steps = [
  { title: "Students maintain profiles", description: "Students provide their academic information and supporting documents.", icon: UserRound },
  { title: "TPO configures drives", description: "Placement teams manage company information, drives, and application requirements.", icon: BriefcaseBusiness },
  { title: "Eligibility is checked", description: "Configured academic and cohort criteria are evaluated against student profiles.", icon: CheckCircle2 },
  { title: "Students apply and track", description: "Students review available drives and follow their application status.", icon: ClipboardList },
  { title: "TPO manages outcomes", description: "Authorized staff review applications and update recruitment progress.", icon: FileText },
  { title: "Updates and reports", description: "Announcements and available reports help keep placement activity organized.", icon: Bell },
];

export default function ProcessWorkflow() {
  return (
    <section id="process" className="border-t border-slate-100 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">HOW IT WORKS</span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">A shared placement workflow</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            CampusFlow brings student and Training &amp; Placement activities together while keeping access role-based.
          </p>
        </div>
        <ol className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map(({ title, description, icon: Icon }, index) => (
            <li key={title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 transition hover:border-blue-200 hover:bg-white hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-slate-300">0{index + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
