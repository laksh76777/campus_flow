import {
  Building2,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  MapPin,
  Laptop,
} from "lucide-react";

const campusImages = [
  {
    title: "Main Campus & Administration",
    description: "Official JSSATEB Bengaluru campus on Uttarahalli–Kengeri Main Road",
    image: "/images/jssateb/campus-main.jpg",
    alt: "JSS Academy of Technical Education Bengaluru main campus building",
  },
  {
    title: "Academic Blocks & Lecture Halls",
    description: "Modern engineering classrooms, seminar complexes, and departments",
    image: "/images/jssateb/campus-building.jpg",
    alt: "JSSATEB academic and departmental building block",
  },
  {
    title: "Infrastructure & Technology Labs",
    description: "Computing facilities, state-of-the-art workshops, and innovation centers",
    image: "/images/jssateb/campus-entrance.jpg",
    alt: "JSSATEB campus infrastructure and technology laboratories",
  },
];

const collegeFacts = [
  {
    icon: CalendarDays,
    label: "Established",
    value: "1997",
    subtext: "Silver jubilee institution",
  },
  {
    icon: GraduationCap,
    label: "Affiliation",
    value: "Visvesvaraya Technological University (VTU)",
    subtext: "Belagavi, Karnataka",
  },
  {
    icon: MapPin,
    label: "Campus Location",
    value: "Uttarahalli–Kengeri Main Road",
    subtext: "Srinivaspura Post, Bengaluru 560060",
  },
  {
    icon: Laptop,
    label: "Placement Operations",
    value: "Dedicated TPO Portal",
    subtext: "CampusFlow placement management",
  },
];

export default function CollegeShowcase() {
  return (
    <section
      id="college"
      aria-labelledby="college-heading"
      className="border-t border-slate-200/80 bg-gradient-to-b from-white via-slate-50/60 to-white py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700">
            <Building2 className="h-4 w-4" />
            <span>COLLEGE PLACEMENT PORTAL</span>
          </div>

          <h2
            id="college-heading"
            className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl"
          >
            One Campus.{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              One Placement Platform.
            </span>
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            Bringing college placement activities into one organized digital experience for JSS Academy of Technical Education, Bengaluru.
          </p>
        </div>

        {/* Institution Overview & Verified Facts */}
        <div className="mt-12 grid items-stretch gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
          {/* Left: Institutional Profile Card */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            <div>
              <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-1.5 border border-slate-200/80 shadow-2xs">
                  <img
                    src="/images/jssateb/college-logo.png"
                    alt="JSS Academy of Technical Education Logo"
                    className="h-11 w-11 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug">
                    JSS Academy of Technical Education, Bengaluru
                  </h3>
                  <p className="text-xs font-semibold text-blue-700 mt-0.5">
                    An institution under JSS Mahavidyapeetha, Mysuru
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm sm:text-base leading-7 text-slate-600">
                CampusFlow provides a centralized placement management experience for students, departmental placement coordinators, and Training &amp; Placement officers at JSSATEB Bengaluru. From student academic credentials verification to recruitment drive scheduling, interview pipelines, and official offers, every step is coordinated in real time.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3 pt-5 border-t border-slate-100">
              <a
                href="https://www.jssateb.ac.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 active:scale-95"
              >
                <span>Official College Website</span>
                <ExternalLink className="h-4 w-4" />
              </a>

              <a
                href="https://www.google.com/maps/search/?api=1&query=JSS+Academy+of+Technical+Education+Bengaluru"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 transition active:scale-95"
              >
                <MapPin className="h-4 w-4 text-slate-500" />
                <span>Locate Campus</span>
              </a>
            </div>
          </div>

          {/* Right: Institutional Facts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {collegeFacts.map(({ icon: Icon, label, value, subtext }) => (
              <div
                key={label}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-2xs">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-slate-900 leading-snug">
                    {value}
                  </p>
                </div>
                <p className="mt-3 text-[11px] text-slate-500 font-medium border-t border-slate-100 pt-2">
                  {subtext}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Verified JSSATEB Campus Photography Gallery */}
        <div className="mt-14 sm:mt-18">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
                Verified Campus Facilities
              </p>
              <h3 className="mt-1 text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                JSSATE Bengaluru Campus Photography
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Uttarahalli–Kengeri Main Road, Bengaluru
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {campusImages.map((item, index) => (
              <article
                key={item.title}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                  <img
                    src={item.image}
                    alt={item.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-mono font-bold text-slate-800 shadow-sm backdrop-blur-xs">
                    0{index + 1}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {item.title}
                    </h4>
                    <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}