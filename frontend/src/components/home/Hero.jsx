const Hero = () => {
  return (
    <section
      id="home"
      className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-slate-50"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />

        <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-64px)] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-12 lg:grid-cols-2">
          
          {/* Left Content */}
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
              🎓 Your Gateway to Career Opportunities
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Build Your Career With
              <span className="block text-blue-600">
                Better Opportunities
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              Discover placement opportunities, apply for your dream
              companies, track your applications, and take the next step
              towards your professional career.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <button className="rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-200 transition duration-200 hover:bg-blue-700 hover:shadow-xl active:scale-95">
                Explore Opportunities
              </button>

              <button className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">
                Learn More
              </button>
            </div>

            {/* Statistics */}
            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-slate-200 pt-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  100+
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Companies
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  500+
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Students
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  95%
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Success Rate
                </p>
              </div>
            </div>
          </div>

          {/* Right Side */}
          <div className="relative hidden lg:block">
            <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200">
              
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    Placement Overview
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-slate-900">
                    Your Career Dashboard
                  </h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-xl">
                  📊
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">
                        Eligible Drives
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Opportunities available for you
                      </p>
                    </div>

                    <span className="text-2xl font-bold text-blue-600">
                      12
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">
                        Applications
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Track your placement applications
                      </p>
                    </div>

                    <span className="text-2xl font-bold text-green-600">
                      08
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">
                        Upcoming Drives
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Don't miss your next opportunity
                      </p>
                    </div>

                    <span className="text-2xl font-bold text-purple-600">
                      05
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating cards */}
            <div className="absolute -left-10 bottom-10 rounded-2xl border border-slate-100 bg-white p-4 shadow-xl">
              <p className="text-sm text-slate-500">
                Latest Status
              </p>

              <p className="mt-1 font-bold text-green-600">
                ✓ Shortlisted
              </p>
            </div>

            <div className="absolute -right-6 top-12 rounded-2xl border border-slate-100 bg-white p-4 shadow-xl">
              <p className="text-sm text-slate-500">
                Package
              </p>

              <p className="mt-1 text-xl font-bold text-slate-900">
                ₹20 LPA
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;