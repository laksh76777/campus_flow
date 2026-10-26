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

  // Form State with Custom Program & Session Duration support
  const [programType, setProgramType] = useState("UG"); // "UG" | "PG" | "LATERAL" | "CUSTOM"
  const [courseDuration, setCourseDuration] = useState(4);
  const [admissionStartYear, setAdmissionStartYear] = useState(2023);
  const [sessionBatch, setSessionBatch] = useState("2023-2027");
  const [sessionYear, setSessionYear] = useState("2027");
  const [sessionName, setSessionName] = useState("Placement Session 2023-2027 (Class of 2027)");
  const [academicYear, setAcademicYear] = useState("2023-2027");
  const [targetPercentage, setTargetPercentage] = useState(90);
  const [description, setDescription] = useState("");
  const [makeActive, setMakeActive] = useState(false);

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

  const updateDurationAndYears = (newDuration, startYr, pType = programType) => {
    const dur = Math.max(1, Math.min(6, parseInt(newDuration, 10) || 4));
    const sYr = parseInt(startYr, 10) || 2023;
    const gYr = sYr + dur;
    const batch = `${sYr}-${gYr}`;
    const pPrefix = pType === "PG" ? "PG " : pType === "LATERAL" ? "Lateral " : "";

    setCourseDuration(dur);
    setAdmissionStartYear(sYr);
    setSessionYear(String(gYr));
    setAcademicYear(batch);
    setSessionBatch(batch);
    setSessionName(`${pPrefix}Placement Session ${batch} (Class of ${gYr})`);
  };

  const handleProgramTypeChange = (type) => {
    setProgramType(type);
    if (type === "UG") {
      updateDurationAndYears(4, admissionStartYear, "UG");
    } else if (type === "PG") {
      updateDurationAndYears(2, admissionStartYear, "PG");
    } else if (type === "LATERAL") {
      updateDurationAndYears(3, admissionStartYear, "LATERAL");
    } else {
      updateDurationAndYears(courseDuration, admissionStartYear, "CUSTOM");
    }
  };

  const handleStartYearChange = (startYr) => {
    setAdmissionStartYear(startYr);
    const sYr = parseInt(startYr, 10);
    if (sYr && !isNaN(sYr)) {
      const gYr = sYr + courseDuration;
      const batch = `${sYr}-${gYr}`;
      const pPrefix = programType === "PG" ? "PG " : programType === "LATERAL" ? "Lateral " : "";
      setSessionYear(String(gYr));
      setAcademicYear(batch);
      setSessionBatch(batch);
      setSessionName(`${pPrefix}Placement Session ${batch} (Class of ${gYr})`);
    }
  };

  const handleGradYearChange = (gradYr) => {
    setSessionYear(gradYr);
    const gYr = parseInt(gradYr, 10);
    if (gYr && !isNaN(gYr)) {
      const sYr = gYr - courseDuration;
      const batch = `${sYr}-${gYr}`;
      const pPrefix = programType === "PG" ? "PG " : programType === "LATERAL" ? "Lateral " : "";
      setAdmissionStartYear(sYr);
      setAcademicYear(batch);
      setSessionBatch(batch);
      setSessionName(`${pPrefix}Placement Session ${batch} (Class of ${gYr})`);
    }
  };

  const handleSelectPreset = (presetRange, dur = 4, type = "UG") => {
    const parts = presetRange.split("-");
    const startYr = parseInt(parts[0], 10);
    const gradYr = parseInt(parts[1], 10);
    const calculatedDur = gradYr - startYr;
    setProgramType(type);
    setCourseDuration(calculatedDur);
    setAdmissionStartYear(startYr);
    setSessionBatch(presetRange);
    setSessionYear(String(gradYr));
    setAcademicYear(presetRange);
    const pPrefix = type === "PG" ? "PG " : "";
    setSessionName(`${pPrefix}Placement Session ${presetRange} (Class of ${gradYr})`);
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    let yearNum = parseInt(sessionYear, 10);
    let startYr = parseInt(admissionStartYear, 10) || (yearNum - courseDuration);
    let acadYr = academicYear?.trim() || `${startYr}-${yearNum}`;

    if (!yearNum || isNaN(yearNum)) {
      toast.error("Please enter a valid graduating cohort year (e.g. 2027, 2028)");
      return;
    }

    // Dynamic admission year mapping based on program type & duration
    let mapping;
    if (programType === "PG" || courseDuration === 2) {
      mapping = [
        { course: "MBA", courseDurationYears: 2, admissionYear: startYr },
        { course: "MCA", courseDurationYears: 2, admissionYear: startYr },
        { course: "M.Tech", courseDurationYears: 2, admissionYear: startYr }
      ];
    } else if (programType === "LATERAL" || courseDuration === 3) {
      mapping = [
        { course: "B.E. (Lateral)", courseDurationYears: 3, admissionYear: startYr },
        { course: "B.Tech (Lateral)", courseDurationYears: 3, admissionYear: startYr }
      ];
    } else if (programType === "UG" || courseDuration === 4) {
      mapping = [
        { course: "B.E.", courseDurationYears: 4, admissionYear: startYr },
        { course: "B.Tech", courseDurationYears: 4, admissionYear: startYr },
        { course: "MBA", courseDurationYears: 2, admissionYear: yearNum - 2 },
        { course: "MCA", courseDurationYears: 2, admissionYear: yearNum - 2 },
        { course: "M.Tech", courseDurationYears: 2, admissionYear: yearNum - 2 }
      ];
    } else {
      mapping = [
        { course: `Cohort (${courseDuration}Y)`, courseDurationYears: courseDuration, admissionYear: startYr }
      ];
    }

    setSubmitting(true);
    try {
      await createPlacementSession({
        sessionYear: yearNum,
        name: sessionName || `Placement Session ${acadYr} (Class of ${yearNum})`,
        academicYear: acadYr,
        targetPlacementPercentage: Number(targetPercentage) || 90,
        description,
        isActive: makeActive,
        admissionYearMapping: mapping
      });

      toast.success(`Placement session for ${acadYr} (Class of ${yearNum}) created!`);
      setIsCreateOpen(false);
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
              {sessions.length} Cohort{sessions.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Isolate placement drives, student eligibility, and institutional statistics by graduation cohort. Prevents unintended cross-session data mixing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button aria-label="Refresh sessions"
            onClick={fetchSessions}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition active:scale-95"
            title="Refresh sessions"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
            Create a placement session for the graduation cohort configured by your Placement Office.
          </p>
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
                  {/* Top Status & Cohort Duration Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-2xl font-black text-slate-900 tracking-tight">
                          {sess.academicYear || `${sess.sessionYear - 4}-${sess.sessionYear}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                          Class of {sess.sessionYear}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          • {(() => {
                            const match = (sess.academicYear || "").match(/^(\d{4})-(\d{4})$/);
                            if (match) {
                              const diff = parseInt(match[2], 10) - parseInt(match[1], 10);
                              return `${diff}-Year Cohort`;
                            }
                            return "4-Year Cohort";
                          })()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
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

                  <h3 className="text-sm font-bold text-slate-800 mt-3 truncate" title={sess.name}>
                    {sess.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Academic Batch: <span className="font-semibold text-slate-700">{sess.academicYear || `${sess.sessionYear - 4}-${sess.sessionYear}`}</span>
                  </p>

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
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
                  {(inspectedSession.admissionYearMapping || []).map((m, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-bold">{m.course === "B.Tech" ? "B.E. (legacy mapping)" : m.course}</td>
                      <td className="py-2.5 px-3 text-slate-500">{m.courseDurationYears} Years</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{m.admissionYear}</td>
                    </tr>
                  ))}
                  {!inspectedSession.admissionYearMapping?.length && (
                    <tr><td colSpan="3" className="px-3 py-4 text-center text-slate-500">No admission-year mappings configured for this session.</td></tr>
                  )}
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
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
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
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
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
                <h3 className="text-lg font-bold text-slate-900">Add Placement Session</h3>
                <p className="text-xs text-slate-500">Configure academic session batch (e.g. 2023-2027, 2024-2028)</p>
              </div>
            </div>

            {/* Program Type & Session Duration Options */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Program Cohort Type & Duration:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {[
                  { type: "UG", label: "UG Engineering", sub: "4 Years (B.E./B.Tech)", dur: 4 },
                  { type: "PG", label: "PG Programs", sub: "2 Years (MBA/MCA/M.Tech)", dur: 2 },
                  { type: "LATERAL", label: "Lateral Entry", sub: "3 Years (Diploma Entry)", dur: 3 },
                  { type: "CUSTOM", label: "Custom Duration", sub: "Customizable Years", dur: courseDuration }
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleProgramTypeChange(item.type)}
                    className={`rounded-2xl border p-2.5 text-left transition flex flex-col justify-between ${
                      programType === item.type
                        ? "border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs ring-1 ring-blue-500/20"
                        : "border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-xs font-black block">{item.label}</span>
                    <span className="text-[10px] text-slate-500 font-medium mt-0.5">{item.sub}</span>
                  </button>
                ))}
              </div>

              {/* Custom Duration Input when Custom selected */}
              {programType === "CUSTOM" && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between mb-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block">Custom Program Duration (Years):</label>
                    <span className="text-[10px] text-slate-400">Total course length from admission to graduation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={courseDuration}
                      onChange={(e) => updateDurationAndYears(e.target.value, admissionStartYear, "CUSTOM")}
                      className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-center text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-600">Years</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Presets */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Quick Select Batch Presets:
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Auto-fills 4-Year UG / 2-Year PG</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { range: "2022-2026", dur: 4, type: "UG", tag: "UG 4Y" },
                  { range: "2023-2027", dur: 4, type: "UG", tag: "UG 4Y" },
                  { range: "2024-2028", dur: 4, type: "UG", tag: "UG 4Y" },
                  { range: "2025-2029", dur: 4, type: "UG", tag: "UG 4Y" },
                  { range: "2024-2026", dur: 2, type: "PG", tag: "PG 2Y" },
                  { range: "2025-2027", dur: 2, type: "PG", tag: "PG 2Y" }
                ].map((preset) => (
                  <button
                    key={preset.range}
                    type="button"
                    onClick={() => handleSelectPreset(preset.range, preset.dur, preset.type)}
                    className={`rounded-xl border py-1.5 px-2.5 text-xs font-bold transition flex items-center gap-1.5 ${
                      sessionBatch === preset.range && programType === preset.type
                        ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{preset.range}</span>
                    <span className={`text-[10px] px-1 py-0.2 rounded font-black ${
                      sessionBatch === preset.range && programType === preset.type
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}>
                      {preset.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Admission Year *
                  </label>
                  <input
                    type="number"
                    required
                    min="2018"
                    max="2035"
                    value={admissionStartYear}
                    onChange={(e) => handleStartYearChange(e.target.value)}
                    placeholder="e.g. 2023"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Year of admission</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Duration
                  </label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-700 flex items-center justify-between">
                    <span>{courseDuration} Years</span>
                    <span className="text-[10px] uppercase font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                      {programType}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">Span of program</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Graduation (Class Of) *
                  </label>
                  <input
                    type="number"
                    required
                    min="2020"
                    max="2040"
                    value={sessionYear}
                    onChange={(e) => handleGradYearChange(e.target.value)}
                    placeholder="e.g. 2027"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Year of passout</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Academic Session Batch Format *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={academicYear}
                    onChange={(e) => {
                      setAcademicYear(e.target.value);
                      setSessionBatch(e.target.value);
                    }}
                    placeholder="e.g. 2023-2027"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
                  />
                  <span className="shrink-0 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100">
                    {courseDuration}-Year Batch
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">Admitted {admissionStartYear} → Passout {sessionYear} (displayed as {academicYear})</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Session Cohort Name
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder={`Placement Session ${academicYear} (Class of ${sessionYear})`}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
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

              {/* Dynamic Auto-Mapping Preview Box */}
              {sessionYear && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
                  <div className="flex items-center gap-1.5 font-bold text-blue-800 mb-1">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <span>Automatic Student Registration & Eligibility Mapping</span>
                  </div>
                  <p className="text-[11px] text-blue-700 mb-2">
                    Creating this session ({academicYear}) will link students joining in {admissionStartYear} with passout year {sessionYear}:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-xl bg-white/90 p-2.5 border border-blue-100">
                      <span className="font-bold text-slate-700 block">{programType === "PG" ? "Postgraduate (PG)" : "Undergraduate (UG)"}:</span>
                      <span className="text-emerald-700 font-extrabold block mt-0.5">
                        Admission Year {admissionStartYear} ({courseDuration} Years)
                      </span>
                    </div>
                    <div className="rounded-xl bg-white/90 p-2.5 border border-blue-100">
                      <span className="font-bold text-slate-700 block">Graduation Cohort:</span>
                      <span className="text-blue-700 font-extrabold block mt-0.5">
                        Class of {sessionYear} ({academicYear})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="makeActive"
                  checked={makeActive}
                  onChange={(e) => setMakeActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="makeActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Set as Active Campus Placement Session immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
                  {submitting ? "Creating..." : "Save & Activate Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
