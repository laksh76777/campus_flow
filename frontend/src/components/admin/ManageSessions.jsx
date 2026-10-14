import { useState, useEffect } from "react";
import {
  Calendar,
  Plus,
  CheckCircle2,
  Archive,
  GraduationCap,
  Briefcase,
  Users,
  Target,
  Sparkles,
  RefreshCw,
  X,
  Clock,
  Layers,
  ArrowRight,
  Database,
  Lock,
  Check,
  AlertTriangle,
  Info
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getAllPlacementSessions,
  createPlacementSession,
  activatePlacementSession,
  updatePlacementSession,
  closePlacementSession,
  archivePlacementSession,
  seedDefaultSessions,
  previewSessionBackfill,
  executeSessionBackfill
} from "../../services/sessionService";

export default function ManageSessions({ onSessionChanged }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Backfill Modal State
  const [isBackfillOpen, setIsBackfillOpen] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillPreview, setBackfillPreview] = useState(null);
  const [backfillExecuting, setBackfillExecuting] = useState(false);

  // Inspect Session Modal State
  const [inspectedSession, setInspectedSession] = useState(null);

  // Form State
  const [sessionYear, setSessionYear] = useState(new Date().getFullYear() + 1);
  const [sessionName, setSessionName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [targetPercentage, setTargetPercentage] = useState(90);
  const [description, setDescription] = useState("");
  const [makeActive, setMakeActive] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await getAllPlacementSessions({ includeArchived: "true" });
      if (Array.isArray(res?.data)) {
        setSessions(res.data);
      }
    } catch (err) {
      console.warn("Failed to load sessions:", err.message);
      toast.error("Could not load placement sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionYear) {
      toast.error("Please enter a graduation year");
      return;
    }

    setSubmitting(true);
    try {
      const yearNum = parseInt(sessionYear);
      await createPlacementSession({
        sessionYear: yearNum,
        name: sessionName || `Class of ${yearNum} Placement Session`,
        academicYear: academicYear || `${yearNum - 1}-${yearNum}`,
        targetPlacementPercentage: Number(targetPercentage) || 90,
        description,
        isActive: makeActive,
        admissionYearMapping: [
          { course: "B.Tech", courseDurationYears: 4, admissionYear: yearNum - 4 },
          { course: "MCA", courseDurationYears: 2, admissionYear: yearNum - 2 },
          { course: "M.Tech", courseDurationYears: 2, admissionYear: yearNum - 2 }
        ]
      });

      toast.success(`Placement session for Class of ${yearNum} created!`);
      setIsCreateOpen(false);
      setSessionYear(new Date().getFullYear() + 1);
      setSessionName("");
      setAcademicYear("");
      setDescription("");
      fetchSessions();
      if (onSessionChanged) onSessionChanged();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to create session";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (sessionId, year) => {
    try {
      await activatePlacementSession(sessionId);
      toast.success(`Session for Class of ${year} is now active!`);
      fetchSessions();
      if (onSessionChanged) onSessionChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to activate session");
    }
  };

  const handleClose = async (sessionId, year) => {
    if (!window.confirm(`Are you sure you want to conclude and close the placement session for Class of ${year}?`)) {
      return;
    }
    try {
      await closePlacementSession(sessionId);
      toast.success(`Placement session for Class of ${year} closed!`);
      fetchSessions();
      if (onSessionChanged) onSessionChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to close session");
    }
  };

  const handleArchive = async (sessionId, currentArchived) => {
    try {
      if (currentArchived) {
        await updatePlacementSession(sessionId, { isArchived: false });
        toast.success("Session unarchived");
      } else {
        await archivePlacementSession(sessionId);
        toast.success("Session moved to historical archive");
      }
      fetchSessions();
      if (onSessionChanged) onSessionChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update session archive status");
    }
  };

  const handleSeedDefaults = async () => {
    try {
      const res = await seedDefaultSessions();
      toast.success(res.message || "Cohorts initialized for 2025-2029!");
      fetchSessions();
      if (onSessionChanged) onSessionChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to initialize default cohorts");
    }
  };

  const handleOpenBackfill = async () => {
    setIsBackfillOpen(true);
    setBackfillLoading(true);
    try {
      const res = await previewSessionBackfill();
      setBackfillPreview(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to preview backfill");
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleExecuteBackfill = async () => {
    if (!backfillPreview) return;
    setBackfillExecuting(true);
    try {
      const studentMappings = (backfillPreview.studentPlanned || []).map((s) => ({
        studentId: s.studentId,
        sessionId: s.mappedSessionId
      }));
      const driveMappings = (backfillPreview.drivePlanned || []).map((d) => ({
        driveId: d.driveId,
        sessionId: d.mappedSessionId
      }));

      const res = await executeSessionBackfill({ studentMappings, driveMappings });
      toast.success(res.message || "Safe session backfill completed!");
      setIsBackfillOpen(false);
      fetchSessions();
      if (onSessionChanged) onSessionChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to execute backfill");
    } finally {
      setBackfillExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Placement Sessions & Academic Cohorts
            </h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-black text-blue-700 border border-blue-100">
              V2 Architecture
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Isolate placement drives, student eligibility, and institutional statistics by graduation cohort. Prevents unintended cross-session data mixing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition active:scale-95"
            title="Refresh sessions"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleSeedDefaults}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition active:scale-95 shadow-2xs"
            title="Pre-provision standard sessions 2025-2029"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Seed 2025-2029</span>
          </button>

          <button
            onClick={handleOpenBackfill}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-2xs"
            title="Safely audit and backfill unlinked students and drives"
          >
            <Database className="h-3.5 w-3.5 text-blue-600" />
            <span>Migration Audit</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-56 rounded-3xl border border-slate-200 bg-white p-6 animate-pulse"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Calendar className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Placement Sessions Configured</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Initialize standard academic cohorts (2025-2029) or create a custom placement session.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSeedDefaults}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
            >
              <Sparkles className="h-4 w-4" />
              <span>Initialize Standard Cohorts (2025-2029)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sessions.map((sess) => {
            const isActive = sess.isActive;
            const isClosed = sess.isClosed || sess.status === "CLOSED";
            const isArchived = sess.isArchived || sess.status === "ARCHIVED";

            return (
              <div
                key={sess._id}
                className={`relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-200 bg-white ${
                  isActive
                    ? "border-emerald-300 ring-2 ring-emerald-500/20 shadow-md"
                    : isArchived
                    ? "border-slate-200 bg-slate-50/50 opacity-75"
                    : "border-slate-200 hover:border-blue-300 hover:shadow-xs"
                }`}
              >
                <div>
                  {/* Top Status Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-2xl font-black text-slate-900 tracking-tight">
                      Class of {sess.sessionYear}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Active</span>
                        </span>
                      ) : isClosed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200">
                          <Lock className="h-3 w-3" />
                          <span>Closed</span>
                        </span>
                      ) : isArchived ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold border border-slate-200">
                          <Archive className="h-3 w-3" />
                          <span>Archived</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                          <span>Upcoming</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 mt-2 truncate">
                    {sess.name}
                  </h3>
                  {sess.academicYear && (
                    <p className="text-xs text-slate-400 font-medium">
                      Academic Year: {sess.academicYear}
                    </p>
                  )}

                  {/* Metrics strip */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                    <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                      <Users className="h-3.5 w-3.5 text-blue-600 mx-auto mb-0.5" />
                      <span className="text-xs font-black text-slate-900 block">
                        {sess.studentCount ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Students</span>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                      <Briefcase className="h-3.5 w-3.5 text-indigo-600 mx-auto mb-0.5" />
                      <span className="text-xs font-black text-slate-900 block">
                        {sess.driveCount ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Drives</span>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                      <Target className="h-3.5 w-3.5 text-emerald-600 mx-auto mb-0.5" />
                      <span className="text-xs font-black text-slate-900 block">
                        {sess.targetPlacementPercentage ?? 90}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Target</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => setInspectedSession(sess)}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Inspect Mapping
                  </button>

                  <div className="flex items-center gap-2">
                    {!isActive && !isArchived && (
                      <button
                        onClick={() => handleActivate(sess._id, sess.sessionYear)}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-bold transition shadow-xs active:scale-95"
                      >
                        <Check className="h-3 w-3" />
                        <span>Activate</span>
                      </button>
                    )}

                    {isActive && (
                      <button
                        onClick={() => handleClose(sess._id, sess.sessionYear)}
                        className="inline-flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 text-xs font-bold transition shadow-xs"
                      >
                        <Lock className="h-3 w-3" />
                        <span>Close</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleArchive(sess._id, isArchived)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
                    >
                      {isArchived ? "Unarchive" : "Archive"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Session Details Modal */}
      {inspectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                <h3 className="font-black text-slate-900 text-base">
                  Session Cohort Mapping ({inspectedSession.sessionYear})
                </h3>
              </div>
              <button onClick={() => setInspectedSession(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Admission year mapping configuration for graduating Class of {inspectedSession.sessionYear}:
            </p>

            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Course</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Admission Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {(inspectedSession.admissionYearMapping || [
                    { course: "B.Tech", courseDurationYears: 4, admissionYear: inspectedSession.sessionYear - 4 },
                    { course: "MCA", courseDurationYears: 2, admissionYear: inspectedSession.sessionYear - 2 },
                    { course: "M.Tech", courseDurationYears: 2, admissionYear: inspectedSession.sessionYear - 2 }
                  ]).map((m, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-bold">{m.course}</td>
                      <td className="py-2.5 px-3 text-slate-500">{m.courseDurationYears} Years</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{m.admissionYear}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectedSession(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Migration / Backfill Audit Modal */}
      {isBackfillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Safe Migration & Backfill Audit</h3>
                  <p className="text-xs text-slate-500">Maps existing unlinked students & drives to placement sessions</p>
                </div>
              </div>
              <button onClick={() => setIsBackfillOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {backfillLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Scanning database records...</div>
              ) : backfillPreview ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Unlinked Students</span>
                      <p className="text-lg font-black text-slate-900 mt-0.5">{backfillPreview.totalUnlinkedStudents}</p>
                    </div>
                    <div className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">Planned Mappings</span>
                      <p className="text-lg font-black text-emerald-800 mt-0.5">{backfillPreview.studentPlannedCount}</p>
                    </div>
                    <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Unlinked Drives</span>
                      <p className="text-lg font-black text-slate-900 mt-0.5">{backfillPreview.totalUnlinkedDrives}</p>
                    </div>
                    <div className="p-3 rounded-2xl border border-amber-200 bg-amber-50">
                      <span className="text-[10px] font-bold text-amber-600 uppercase">Ambiguous Items</span>
                      <p className="text-lg font-black text-amber-800 mt-0.5">{backfillPreview.studentAmbiguousCount}</p>
                    </div>
                  </div>

                  {/* Planned mappings preview list */}
                  {backfillPreview.studentPlanned?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Planned Student Mappings ({backfillPreview.studentPlanned.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100 text-xs">
                        {backfillPreview.studentPlanned.slice(0, 10).map((s, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between bg-white">
                            <div>
                              <span className="font-bold text-slate-900">{s.name}</span>
                              <span className="text-slate-400 ml-1.5 font-mono text-[11px]">({s.enrollmentNumber})</span>
                            </div>
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                              Mapped to {s.mappedSessionYear}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ambiguous preview */}
                  {backfillPreview.studentAmbiguous?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span>Ambiguous Records (Require Manual Intervention)</span>
                      </h4>
                      <div className="max-h-32 overflow-y-auto rounded-2xl border border-amber-200 divide-y divide-amber-100 text-xs bg-amber-50/40">
                        {backfillPreview.studentAmbiguous.map((s, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between">
                            <span className="font-bold text-slate-800">{s.name} ({s.enrollmentNumber})</span>
                            <span className="text-[11px] text-amber-700">{s.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 -mx-6 -mb-6 rounded-b-3xl flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">Safe dry-run preview enabled</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBackfillOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBackfill}
                  disabled={backfillExecuting || !backfillPreview || (backfillPreview.studentPlannedCount === 0 && backfillPreview.drivePlannedCount === 0)}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {backfillExecuting ? "Writing Changes..." : "Confirm & Write Backfill"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-5 right-5 h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Placement Session</h3>
                <p className="text-xs text-slate-500">Configure new student graduating cohort</p>
              </div>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Graduation Year *
                </label>
                <input
                  type="number"
                  required
                  min="2020"
                  max="2035"
                  value={sessionYear}
                  onChange={(e) => setSessionYear(e.target.value)}
                  placeholder="e.g. 2026"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Session Cohort Name
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder={`Class of ${sessionYear} Placement Session`}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder={`${sessionYear - 1}-${sessionYear}`}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Target Placement %
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={targetPercentage}
                    onChange={(e) => setTargetPercentage(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="makeActive"
                  checked={makeActive}
                  onChange={(e) => setMakeActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="makeActive" className="text-xs font-bold text-slate-700">
                  Set as Active Campus Placement Session immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Cohort Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
