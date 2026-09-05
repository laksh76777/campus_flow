import {
  FileText,
  Filter,
  Send,
  Trophy,
  ArrowRight,
} from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Setup Academic Profile",
    description:
      "Enter your degree, branch, semester, verified CGPA, active backlogs, and upload your current resume.",
    icon: FileText,
    color: "bg-blue-50 text-blue-600 border-blue-200",
  },
  {
    step: "02",
    title: "Instant Eligibility Matching",
    description:
      "Our system compares your academic credentials in real-time against corporate eligibility requirements.",
    icon: Filter,
    color: "bg-indigo-50 text-indigo-600 border-indigo-200",
  },
  {
    step: "03",
    title: "1-Click Drive Application",
    description:
      "Apply directly to top recruiters with your verified resume without tedious repetitive paperwork.",
    icon: Send,
    color: "bg-purple-50 text-purple-600 border-purple-200",
  },
  {
    step: "04",
    title: "Track Selection & Offers",
    description:
      "Follow real-time status updates from shortlisting to technical interviews and offer letter release.",
    icon: Trophy,
    color: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
];

export default function ProcessWorkflow() {
  return (
    <section id="process" className="py-16 sm:py-24 bg-white border-t border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto pb-14">
          <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-100">
            HOW IT WORKS
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            A Transparent 4-Step Placement Journey
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            From initial registration to securing your dream job offer, our portal streamlines the entire campus hiring lifecycle.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <div
                key={index}
                className="relative rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 transition-all duration-300 hover:bg-white hover:shadow-lg hover:border-blue-200/80 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${item.color} shadow-xs`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <span className="text-2xl font-black text-slate-300 group-hover:text-blue-500/50 transition">
                    {item.step}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
