import { useNavigate } from "react-router-dom";
import {
  Building2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

const corporatePartners = [
  {
    name: "Google",
    initial: "G",
    industry: "Cloud & AI / Software",
    hiringRoles: "Software Engineer, ML Intern",
    highestPackage: "₹24 LPA",
    color: "from-blue-600 to-indigo-600",
  },
  {
    name: "Microsoft",
    initial: "M",
    industry: "Enterprise Software",
    hiringRoles: "Cloud Solution Architect, SDE",
    highestPackage: "₹18.5 LPA",
    color: "from-sky-600 to-blue-700",
  },
  {
    name: "Amazon",
    initial: "A",
    industry: "Cloud & E-Commerce",
    hiringRoles: "SDE 1, Data Analyst",
    highestPackage: "₹28 LPA",
    color: "from-amber-500 to-orange-600",
  },
  {
    name: "Atlassian",
    initial: "A",
    industry: "Developer Tools & SaaS",
    hiringRoles: "Associate Software Engineer",
    highestPackage: "₹22 LPA",
    color: "from-indigo-600 to-violet-600",
  },
  {
    name: "Goldman Sachs",
    initial: "G",
    industry: "Investment Banking & FinTech",
    hiringRoles: "Analyst - Engineering",
    highestPackage: "₹26 LPA",
    color: "from-cyan-600 to-blue-800",
  },
  {
    name: "Adobe",
    initial: "A",
    industry: "Creative & Digital Experience",
    hiringRoles: "Product Engineer, Design Lead",
    highestPackage: "₹20 LPA",
    color: "from-rose-600 to-pink-600",
  },
  {
    name: "Cisco",
    initial: "C",
    industry: "Networking & Security",
    hiringRoles: "Software Engineer, Network Consulting",
    highestPackage: "₹17 LPA",
    color: "from-teal-600 to-emerald-700",
  },
  {
    name: "TCS / Infosys",
    initial: "T",
    industry: "IT Services & Digital Consulting",
    hiringRoles: "Specialist Programmer, Digital",
    highestPackage: "₹9.5 LPA",
    color: "from-slate-700 to-slate-900",
  },
];

export default function TopRecruitingCompanies() {
  const navigate = useNavigate();

  return (
    <section id="companies" className="py-16 sm:py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto pb-12">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-100">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            ELITE RECRUITMENT PARTNERS
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Trusted by Industry Leaders
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Over 120+ top-tier global multinationals, unicorn tech enterprises, and consulting giants actively recruit from our campus.
          </p>
        </div>

        {/* Company Cards Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {corporatePartners.map((company, index) => (
            <div
              key={index}
              className="group relative rounded-2xl border border-slate-200/90 bg-slate-50/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-lg"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${company.color} text-lg font-bold text-white shadow-sm`}
                >
                  {company.initial}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                    {company.name}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    {company.industry}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-1 border-t border-slate-200/60 pt-3">
                <p className="text-[11px] text-slate-500">
                  <span className="font-medium text-slate-700">Roles:</span> {company.hiringRoles}
                </p>
                <p className="text-[11px] font-semibold text-blue-600 flex items-center justify-between pt-1">
                  <span>Up to {company.highestPackage}</span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Hiring</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Banner */}
        <div className="mt-12 rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-blue-50/70 p-6 text-center sm:flex sm:items-center sm:justify-between sm:text-left sm:p-8">
          <div>
            <h4 className="text-base sm:text-lg font-bold text-slate-900">
              Are you an employer seeking exceptional campus talent?
            </h4>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Schedule your on-campus or virtual recruitment drive directly with our training and placement office.
            </p>
          </div>
          <a
            href="#contact"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 sm:mt-0 shrink-0"
          >
            <span>Partner With Us</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

      </div>
    </section>
  );
}