import { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  History,
  FileCheck,
  Shield,
  Layers,
  ArrowRight,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Building,
  GraduationCap,
  Users,
  Briefcase
} from "lucide-react";
import { excelService } from "../../services/excelService";

export default function ExcelMigrationHub({ sessions = [], drives = [], onRefresh }) {
  const [activeTab, setActiveTab] = useState("import"); // 'import', 'history', 'exports'

  // Import State
  const [importType, setImportType] = useState("student_records");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [conflictStrategy, setConflictStrategy] = useState("skip");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  // History State
  const [batches, setBatches] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Export State
  const [exportDriveId, setExportDriveId] = useState("");
  const [exportSessionId, setExportSessionId] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [applicantFilterStatus, setApplicantFilterStatus] = useState("all");
  const [isCompanyFacing, setIsCompanyFacing] = useState(false);

  // Sync default session
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      const activeSess = sessions.find((s) => s.isActive) || sessions[0];
      setSelectedSessionId(activeSess._id);
      setExportSessionId(activeSess._id);
    }
  }, [sessions, selectedSessionId]);

  // Sync default drive
  useEffect(() => {
    if (drives.length > 0 && !exportDriveId) {
      setExportDriveId(drives[0]._id);
    }
  }, [drives, exportDriveId]);

  // Load audit history
  const fetchBatches = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await excelService.listBatches({ limit: 20 });
      if (res?.data?.batches) {
        setBatches(res.data.batches);
      }
    } catch (err) {
      console.warn("Failed to load import batches:", err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchBatches();
    }
  }, [activeTab, fetchBatches]);

  // Template Download Handler
  const handleDownloadTemplate = async (type) => {
    try {
      setStatusMessage({ type: "info", text: `Downloading ${type} template...` });
      await excelService.downloadTemplate(type);
      setStatusMessage({ type: "success", text: "Template downloaded successfully." });
    } catch (err) {
      setStatusMessage({ type: "error", text: err.response?.data?.message || err.message });
    }
  };

  // Upload & Preview Handler
  const handleUploadAndPreview = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setStatusMessage({ type: "error", text: "Please select an Excel (.xlsx) file to upload." });
      return;
    }

    try {
      setPreviewLoading(true);
      setStatusMessage({ type: "info", text: "Parsing spreadsheet and validating rows against constraints..." });
      const res = await excelService.uploadAndPreview({
        file: selectedFile,
        importType,
        placementSessionId: selectedSessionId,
        conflictStrategy
      });

      if (res?.data) {
        setCurrentBatch(res.data);
        setStatusMessage({
          type: "success",
          text: `Preview generated! ${res.data.validRows} valid rows, ${res.data.conflictRows || 0} conflicts, ${res.data.invalidRows} errors. Review before committing.`
        });
      }
    } catch (err) {
      setStatusMessage({ type: "error", text: err.response?.data?.message || err.message });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Commit Approved Batch Handler
  const handleCommitBatch = async () => {
    if (!currentBatch?.batchId) return;

    try {
      setCommitLoading(true);
      setStatusMessage({ type: "info", text: "Applying validated records to database..." });
      const res = await excelService.commitBatch(currentBatch.batchId);

      if (res?.data) {
        setCurrentBatch(res.data);
        setStatusMessage({
          type: "success",
          text: `Import committed successfully! ${res.data.insertedRows} inserted, ${res.data.updatedRows} updated, ${res.data.skippedRows} skipped.`
        });
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      setStatusMessage({ type: "error", text: err.response?.data?.message || err.message });
    } finally {
      setCommitLoading(false);
    }
  };

  // Download Error Report for Batch
  const handleDownloadErrorReport = async (batchId) => {
    try {
      setStatusMessage({ type: "info", text: "Generating actionable error report..." });
      await excelService.downloadErrorReport(batchId);
      setStatusMessage({ type: "success", text: "Error report downloaded." });
    } catch (err) {
      setStatusMessage({ type: "error", text: err.response?.data?.message || err.message });
    }
  };

  // Export Handlers
  const handleExportEligible = async () => {
    if (!exportDriveId) return;
    try {
      setExportLoading(true);
      const drive = drives.find((d) => d._id === exportDriveId);
      await excelService.exportEligibleStudents(exportDriveId, drive?.jobTitle || "Drive");
      setStatusMessage({ type: "success", text: "Eligible candidates export downloaded." });
    } catch (err) {
      setStatusMessage({ type: "error", text: err.response?.data?.message || err.message });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportApplicants = async () => {
    if (!exportDriveId) return;
    try {
      setExportLoading(true);
      const drive = drives.find((d) => d._id === exportDriveId);
      await excelService.exportDriveApplicants(exportDriveId, {
        status: applicantFilterStatus,
        isCompanyFacing,
        driveTitle: drive?.jobTitle || "Drive"
      });
      setStatusMessage({ type: "success", text: "Drive applicants export downloaded." });
    } catch (err) {
      setStatusMessage({ type: "error", text: err.response?.data?.message || err.message });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportSessionReport = async () => {
    if (!exportSessionId) return;
    try {
      setExportLoading(true);
      const sess = sessions.find((s) => s._id === exportSessionId);
      await excelService.exportSessionReport(exportSessionId, sess?.name || `Cohort_${sess?.sessionYear}`);
      setStatusMessage({ type: "success", text: "Session executive cohort report downloaded." });
    } catch (err) {
      setStatusMessage({ type: "error", text: err.response?.data?.message || err.message });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportDeptReport = async () => {
    if (!exportSessionId) return;
    try {
      setExportLoading(true);
      const sess = sessions.find((s) => s._id === exportSessionId);
      await excelService.exportDepartmentReport(exportSessionId, sess?.name || `Cohort_${sess?.sessionYear}`);
      setStatusMessage({ type: "success", text: "Department analytics export downloaded." });
    } catch (err) {
      setStatusMessage({ type: "error", text: err.response?.data?.message || err.message });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportHistorical = async () => {
    try {
      setExportLoading(true);
      await excelService.exportHistoricalPlacements(exportSessionId);
      setStatusMessage({ type: "success", text: "Historical placements summary downloaded." });
    } catch (err) {
      setStatusMessage({ type: "error", text: err.response?.data?.message || err.message });
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                Excel Import, Migration & Exports Hub
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Safe bulk student records ingestion, independent academic history imports, historical outcomes migration, and auditable reporting exports.
              </p>
            </div>
          </div>

          {/* Subnavigation Tabs */}
          <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100 p-1 border border-slate-200/60">
            <button
              onClick={() => { setActiveTab("import"); setStatusMessage(null); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                activeTab === "import"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Upload className="h-3.5 w-3.5 text-emerald-600" />
              <span>Import & Migrate</span>
            </button>
            <button
              onClick={() => { setActiveTab("history"); setStatusMessage(null); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                activeTab === "history"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="h-3.5 w-3.5 text-indigo-600" />
              <span>Audit History</span>
            </button>
            <button
              onClick={() => { setActiveTab("exports"); setStatusMessage(null); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                activeTab === "exports"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>Reporting Exports</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {statusMessage && (
          <div
            className={`mt-4 flex items-center justify-between rounded-2xl px-4 py-3 text-xs font-bold transition ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : statusMessage.type === "error"
                ? "bg-rose-50 text-rose-800 border border-rose-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
              {statusMessage.type === "error" && <XCircle className="h-4 w-4 text-rose-600 shrink-0" />}
              {statusMessage.type === "info" && <RefreshCw className="h-4 w-4 text-blue-600 animate-spin shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 ml-4"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: IMPORT & MIGRATION WORKFLOW */}
      {/* ========================================================================= */}
      {activeTab === "import" && (
        <div className="space-y-6">
          {/* Downloadable Standard Templates Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">1. Download Validated Import Templates</h3>
                <p className="text-xs text-slate-500">Each template contains styled header schemas, field guidance, allowed values, and non-student illustrative samples.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Template Card A */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 transition group flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700 border border-blue-200">
                      Roster Module
                    </span>
                    <FileSpreadsheet className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-2">Student Records Template</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    USN, Full Name, College Email, Phone, Course, Department, Admission Year, Graduation Year, Semester, and Gender.
                  </p>
                </div>
                <button
                  onClick={() => handleDownloadTemplate("student_records")}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .XLSX Template</span>
                </button>
              </div>

              {/* Template Card B */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 transition group flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200">
                      Academics Module
                    </span>
                    <FileSpreadsheet className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-2">Academic History Template</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Overall CGPA, Sem 1–8 independent SGPA, Class 10th & 12th details, backlogs counts, and education gap declarations.
                  </p>
                </div>
                <button
                  onClick={() => handleDownloadTemplate("academic_history")}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .XLSX Template</span>
                </button>
              </div>

              {/* Template Card C */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 transition group flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-purple-50 px-2 py-0.5 text-[10px] font-black text-purple-700 border border-purple-200">
                      Historical Placements
                    </span>
                    <FileSpreadsheet className="h-4 w-4 text-slate-400 group-hover:text-purple-600 transition" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-2">Historical Placement Results</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    USN matching, recruiter company name, job role, session year, offer package (CTC), selection milestone, and drive dates.
                  </p>
                </div>
                <button
                  onClick={() => handleDownloadTemplate("historical_placements")}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 py-2 text-xs font-black text-purple-700 hover:bg-purple-100 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .XLSX Template</span>
                </button>
              </div>
            </div>
          </div>

          {/* Upload Configuration & Staging Form */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">2. Upload Spreadsheet for Pre-Commit Validation</h3>

            <form onSubmit={handleUploadAndPreview} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Import Type */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">Import Schema Type</label>
                  <select
                    value={importType}
                    onChange={(e) => setImportType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition cursor-pointer"
                  >
                    <option value="student_records">Student Records (Profiles & Credentials)</option>
                    <option value="academic_history">Academic History (CGPA, SGPA, 10/12, Backlogs)</option>
                    <option value="historical_placements">Historical Placement Outcomes & Offers</option>
                  </select>
                </div>

                {/* 2. Target Placement Session */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">Target Placement Session</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition cursor-pointer"
                  >
                    {sessions.map((sess) => (
                      <option key={sess._id} value={sess._id}>
                        Class of {sess.sessionYear} ({sess.name}) {sess.isActive ? "• Active" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Conflict Resolution Strategy */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">Conflict Resolution Rule</label>
                  <select
                    value={conflictStrategy}
                    onChange={(e) => setConflictStrategy(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition cursor-pointer"
                  >
                    <option value="skip">Skip Conflicting Rows (Protect TPO-Verified Data)</option>
                    <option value="update_unverified">Update Unverified Fields Only</option>
                  </select>
                </div>
              </div>

              {/* File Dropzone */}
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center hover:bg-slate-50 transition">
                <input
                  type="file"
                  id="excelFileInput"
                  accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                  className="hidden"
                />
                <label htmlFor="excelFileInput" className="cursor-pointer flex flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 text-slate-600 mb-2">
                    <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {selectedFile ? selectedFile.name : "Choose or drag .xlsx spreadsheet here"}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB selected` : "Supports Excel .xlsx workbooks up to 10MB"}
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setCurrentBatch(null); }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!selectedFile || previewLoading}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition disabled:opacity-50 active:scale-95 shadow-sm"
                >
                  <Upload className={`h-4 w-4 ${previewLoading ? "animate-spin" : ""}`} />
                  <span>{previewLoading ? "Parsing & Validating..." : "Generate Upload Preview"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Staging / Preview Review Table */}
          {currentBatch && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">Upload Validation Preview</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      currentBatch.status === "COMMITTED"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}>
                      {currentBatch.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Batch ID: <span className="font-mono font-bold text-slate-700">{currentBatch.batchId}</span> • Filename: {currentBatch.originalFilename}</p>
                </div>

                {/* Metrics Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="rounded-xl bg-slate-50 px-3 py-1.5 border border-slate-200 text-center">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Total Rows</span>
                    <span className="text-sm font-black text-slate-900">{currentBatch.totalRows}</span>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-3 py-1.5 border border-emerald-200 text-center">
                    <span className="block text-[10px] font-bold text-emerald-600 uppercase">Valid</span>
                    <span className="text-sm font-black text-emerald-800">{currentBatch.validRows}</span>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-3 py-1.5 border border-amber-200 text-center">
                    <span className="block text-[10px] font-bold text-amber-600 uppercase">Conflicts</span>
                    <span className="text-sm font-black text-amber-800">{currentBatch.conflictRows || 0}</span>
                  </div>
                  <div className="rounded-xl bg-rose-50 px-3 py-1.5 border border-rose-200 text-center">
                    <span className="block text-[10px] font-bold text-rose-600 uppercase">Errors</span>
                    <span className="text-sm font-black text-rose-800">{currentBatch.invalidRows}</span>
                  </div>
                </div>
              </div>

              {/* Action Banners */}
              {currentBatch.status === "PREVIEWED" && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-indigo-50/80 p-4 border border-indigo-200">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-indigo-950">Explicit TPO Confirmation Required</h4>
                      <p className="text-xs text-indigo-700 font-medium">Review the preview table below. Successful preview is NOT permission to write. Clicking commit will permanently write valid rows to the placement database.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {currentBatch.invalidRows > 0 && (
                      <button
                        onClick={() => handleDownloadErrorReport(currentBatch.batchId)}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 transition"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download Errors</span>
                      </button>
                    )}
                    <button
                      onClick={handleCommitBatch}
                      disabled={commitLoading || currentBatch.validRows === 0}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 active:scale-95"
                    >
                      <CheckCircle2 className={`h-4 w-4 ${commitLoading ? "animate-spin" : ""}`} />
                      <span>{commitLoading ? "Committing Database Changes..." : "Confirm & Commit Import"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Results Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Row #</th>
                      <th className="px-4 py-3">Identifier (USN)</th>
                      <th className="px-4 py-3">Student / Entity Name</th>
                      <th className="px-4 py-3">Validation Status</th>
                      <th className="px-4 py-3">Proposed Action</th>
                      <th className="px-4 py-3">Inspection Details / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentBatch.previewResults?.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-2.5 font-mono text-slate-500">{row.rowNumber}</td>
                        <td className="px-4 py-2.5 font-bold font-mono text-slate-900">{row.identifier}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-700">{row.name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                            row.status === "VALID"
                              ? "bg-emerald-100 text-emerald-800"
                              : row.status === "CONFLICT"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {row.status === "VALID" && <CheckCircle2 className="h-3 w-3" />}
                            {row.status === "CONFLICT" && <AlertTriangle className="h-3 w-3" />}
                            {row.status === "ERROR" && <XCircle className="h-3 w-3" />}
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {row.action || row.proposedAction}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 max-w-md truncate" title={row.reason}>
                          {row.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {currentBatch.previewResults?.length > 50 && (
                <p className="text-center text-[11px] font-medium text-slate-400">
                  Showing first 50 rows of {currentBatch.previewResults.length} total staged records.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AUDIT & IMPORT HISTORY */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900">Auditable Batch Import History</h3>
              <p className="text-xs text-slate-500">Chronological ledger of all historical spreadsheet uploads, row-level counts, and downloadable error reports.</p>
            </div>
            <button
              onClick={fetchBatches}
              disabled={historyLoading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Batch ID</th>
                  <th className="px-4 py-3">Import Type</th>
                  <th className="px-4 py-3">Target Session</th>
                  <th className="px-4 py-3">Original File</th>
                  <th className="px-4 py-3">Initiated By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Row Breakdown</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                      No import batches recorded yet.
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b._id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{b.batchId}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700 capitalize">
                        {b.importType?.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {b.placementSession?.name || `Cohort ${b.placementSession?.sessionYear || "Unassigned"}`}
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={b.originalFilename}>
                        {b.originalFilename}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{b.initiatedBy?.fullName || "Admin"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          b.status === "COMMITTED"
                            ? "bg-emerald-100 text-emerald-800"
                            : b.status === "PREVIEWED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="text-emerald-700 font-bold">{b.insertedRows || 0} ins</span> •{" "}
                        <span className="text-blue-700 font-bold">{b.updatedRows || 0} upd</span> •{" "}
                        <span className="text-rose-700 font-bold">{b.failedRows || 0} fail</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {b.errorReport?.length > 0 && (
                          <button
                            onClick={() => handleDownloadErrorReport(b.batchId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition"
                          >
                            <Download className="h-3 w-3" />
                            <span>Error Report</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REPORTING EXPORTS CENTER */}
      {/* ========================================================================= */}
      {activeTab === "exports" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section A: Drive Specific Candidate Exports */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Placement Drive Candidate Exports</h3>
                <p className="text-xs text-slate-500">Evaluates actual criteria and respects company-sharing rules.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Select Placement Drive</label>
                <select
                  value={exportDriveId}
                  onChange={(e) => setExportDriveId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  {drives.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.jobTitle} • {d.company?.companyName || "Recruiter"} (Class of {d.graduationYear})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action 1: Eligible Students Export */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900">Eligible Candidates Export</h4>
                  <p className="text-[11px] text-slate-500">Runs centralized eligibility service; outputs satisfied candidates.</p>
                </div>
                <button
                  onClick={handleExportEligible}
                  disabled={exportLoading || !exportDriveId}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export (.XLSX)</span>
                </button>
              </div>

              {/* Action 2: Drive Applicants Export */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Drive Applicants & Shortlist Roster</h4>
                    <p className="text-[11px] text-slate-500">Exports candidates with interview rounds and CTC details.</p>
                  </div>
                  <button
                    onClick={handleExportApplicants}
                    disabled={exportLoading || !exportDriveId}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 transition active:scale-95 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export (.XLSX)</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Status Filter</label>
                    <select
                      value={applicantFilterStatus}
                      onChange={(e) => setApplicantFilterStatus(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                    >
                      <option value="all">All Applicants</option>
                      <option value="applied">Applied</option>
                      <option value="shortlisted">Shortlisted</option>
                      <option value="interview">Interview Stage</option>
                      <option value="selected">Selected</option>
                      <option value="offer_accepted">Offer Accepted</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="companyFacingCheckbox"
                      checked={isCompanyFacing}
                      onChange={(e) => setIsCompanyFacing(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="companyFacingCheckbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Company-Facing (Mask private data)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Cohort & Historical Summary Reports */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Cohort & Department Analytics</h3>
                <p className="text-xs text-slate-500">Session-wide executive reports and branch breakdown.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Select Cohort Session</label>
                <select
                  value={exportSessionId}
                  onChange={(e) => setExportSessionId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition cursor-pointer"
                >
                  {sessions.map((sess) => (
                    <option key={sess._id} value={sess._id}>
                      Class of {sess.sessionYear} ({sess.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action 1: Session Executive Summary & Roster */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900">Cohort Summary & Full Roster</h4>
                  <p className="text-[11px] text-slate-500">Multi-sheet workbook with placement rate and candidate status.</p>
                </div>
                <button
                  onClick={handleExportSessionReport}
                  disabled={exportLoading || !exportSessionId}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export (.XLSX)</span>
                </button>
              </div>

              {/* Action 2: Department-wise Breakdown Report */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900">Department Performance Report</h4>
                  <p className="text-[11px] text-slate-500">Placed vs unplaced ratios and recruiter counts per branch.</p>
                </div>
                <button
                  onClick={handleExportDeptReport}
                  disabled={exportLoading || !exportSessionId}
                  className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-black text-white hover:bg-teal-700 transition active:scale-95 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export (.XLSX)</span>
                </button>
              </div>

              {/* Action 3: Historical Placement Outcomes Ledger */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900">Historical Placement Ledger</h4>
                  <p className="text-[11px] text-slate-500">All historical confirmed offers, companies, packages and dates.</p>
                </div>
                <button
                  onClick={handleExportHistorical}
                  disabled={exportLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-black text-white hover:bg-purple-700 transition active:scale-95 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export (.XLSX)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
