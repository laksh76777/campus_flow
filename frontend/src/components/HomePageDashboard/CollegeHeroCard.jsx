import { MapPin } from "lucide-react";

export default function CollegeHeroCard() {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white/95 p-3 shadow-md shadow-slate-900/5 backdrop-blur-xs transition hover:border-blue-200">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1 border border-slate-100 shadow-2xs">
          <img
            src="/images/jssateb/college-logo.png"
            alt="JSS Academy of Technical Education, Bengaluru Logo"
            className="h-9 w-9 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
              JSSATEB Placement Portal
            </h3>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shrink-0">
              ● Active
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
            <span>Uttarahalli–Kengeri Main Road, Bengaluru</span>
          </p>
        </div>
      </div>

      <div className="relative h-12 w-20 sm:w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 shadow-2xs group">
        <img
          src="/images/jssateb/campus-main.jpg"
          alt="JSSATE Bengaluru Campus"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    </div>
  );
}
