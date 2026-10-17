/**
 * CampusFlow Centralized Eligibility Engine (V2 - Phase 4)
 * Deterministic multi-criteria evaluation with 3-state status:
 * - "ELIGIBLE": Meets all academic & institutional criteria
 * - "INELIGIBLE": Fails one or more specific criteria (with precise human-readable reasons)
 * - "MISSING_DATA": Student profile is incomplete; cannot evaluate criteria.
 *                   Missing data NEVER silently passes or converts to zero.
 */
import { resolveStudentProgram } from "../constants/programCatalog.js";
import { getDriveProgramCodes, studentMatchesDriveProgram } from "./programTargeting.service.js";

export const EligibilityStatus = {
    ELIGIBLE: "ELIGIBLE",
    INELIGIBLE: "INELIGIBLE",
    MISSING_DATA: "MISSING_DATA"
};

export class EligibilityService {
    /**
     * Evaluate a student against a placement drive's requirements
     * @param {Object} student - StudentProfile document or plain object
     * @param {Object} drive - PlacementDrive document or plain object
     * @returns {Object} Deterministic evaluation report
     */
    static evaluate(student, drive) {
        if (!student) {
            return {
                status: EligibilityStatus.MISSING_DATA,
                isEligible: false,
                summary: "Student profile does not exist",
                reasons: ["Academic profile has not been created yet"],
                missingFields: ["studentProfile"],
                criteriaBreakdown: []
            };
        }

        if (!drive) {
            return {
                status: EligibilityStatus.INELIGIBLE,
                isEligible: false,
                summary: "Placement drive not found",
                reasons: ["Invalid or inactive placement drive"],
                missingFields: [],
                criteriaBreakdown: []
            };
        }

        const missingFields = [];
        const failureReasons = [];
        const criteriaBreakdown = [];

        // 1. Resolve student metrics using verified data first
        const studentCGPA = student.verifiedCGPA != null ? Number(student.verifiedCGPA) : (student.cgpa != null ? Number(student.cgpa) : null);
        const studentActiveBacklogs = student.activeBacklogs != null ? Number(student.activeBacklogs) : (student.backlogs != null ? Number(student.backlogs) : null);
        const studentHistBacklogs = student.historicalBacklogs != null ? Number(student.historicalBacklogs) : (student.backlogDetails ? student.backlogDetails.length : 0);
        const studentTenth = student.tenthDetails?.percentage != null ? Number(student.tenthDetails.percentage) : (student.tenthPercentage != null ? Number(student.tenthPercentage) : null);
        const studentTwelfth = student.twelfthOrDiplomaDetails?.percentage != null ? Number(student.twelfthOrDiplomaDetails.percentage) : (student.twelfthPercentage != null ? Number(student.twelfthPercentage) : null);
        const studentResumeUrl = student.resume?.url || student.resumeUrl;

        // 2. Strict Missing Data Detection (Cannot evaluate if essential criteria are unrecorded)
        if (studentCGPA === null || isNaN(studentCGPA)) missingFields.push("CGPA");
        if (!student.branch && !student.department) missingFields.push("Department / Branch");
        if (student.graduationYear == null) missingFields.push("Graduation Year");
        if (studentActiveBacklogs === null || isNaN(studentActiveBacklogs)) missingFields.push("Backlog Status");

        // If drive requires 10th or 12th minimum cutoffs, student MUST have recorded them
        const requiresTenthCheck = drive.checkTenthMarks || (drive.minimumTenthPercentage && Number(drive.minimumTenthPercentage) > 0);
        if (requiresTenthCheck) {
            if (studentTenth === null || isNaN(studentTenth)) {
                missingFields.push("10th Standard Percentage");
            }
        }
        const requiresTwelfthCheck = drive.checkTwelfthMarks || (drive.minimumTwelfthPercentage && Number(drive.minimumTwelfthPercentage) > 0);
        if (requiresTwelfthCheck) {
            if (studentTwelfth === null || isNaN(studentTwelfth)) {
                missingFields.push("12th / Diploma Percentage");
            }
        }

        // Resume requirement
        if (!studentResumeUrl) {
            missingFields.push("Master Resume Document");
        }

        if (missingFields.length > 0) {
            return {
                status: EligibilityStatus.MISSING_DATA,
                isEligible: false,
                summary: "Cannot evaluate eligibility: Academic profile has missing required information",
                reasons: missingFields.map((f) => `Missing ${f} in profile`),
                missingFields,
                criteriaBreakdown: [
                    {
                        criterion: "Profile Completeness & Documents",
                        required: "All required academic metrics and verified resume",
                        actual: `Missing: ${missingFields.join(", ")}`,
                        passed: false
                    }
                ]
            };
        }

        // 3. Drive Status & Deadline Check
        const now = new Date();
        const deadline = drive.applicationDeadline ? new Date(drive.applicationDeadline) : null;
        const isDriveActive = Boolean(drive.isActive);
        const isDeadlineOpen = deadline ? now <= deadline : true;

        criteriaBreakdown.push({
            criterion: "Drive Status & Deadline",
            required: "Active drive with open deadline",
            actual: isDeadlineOpen ? "Deadline open" : "Deadline passed",
            passed: isDriveActive && isDeadlineOpen
        });

        if (!isDriveActive) {
            failureReasons.push("Placement drive has been closed or archived by TPO");
        } else if (!isDeadlineOpen) {
            failureReasons.push("Application deadline has passed");
        }

        // 4. Graduation Cohort & Placement Session Matching
        const studentGradYear = Number(student.graduationYear);
        const driveGradYear = Number(drive.graduationYear);
        const gradYearMatches = studentGradYear === driveGradYear;

        criteriaBreakdown.push({
            criterion: "Graduation Cohort",
            required: `Class of ${driveGradYear}`,
            actual: `Class of ${studentGradYear}`,
            passed: gradYearMatches
        });

        if (!gradYearMatches) {
            failureReasons.push(
                `Drive is reserved for Class of ${driveGradYear}; your profile indicates Class of ${studentGradYear}`
            );
        }

        // 5. Branch / Specialization Match
        const studentProgram = resolveStudentProgram({
            programCode: student.programCode,
            course: student.course,
            branch: student.branch,
            department: student.department
        });
        const eligibleBranches = Array.isArray(drive.eligibleBranches)
            ? drive.eligibleBranches
            : [];
        const targetProgramCodes = getDriveProgramCodes(drive);
        const isAllBranches = targetProgramCodes.length === 13;
        const branchMatches = studentMatchesDriveProgram(student, drive);
        const requiredPrograms = isAllBranches
            ? "All approved programs"
            : (targetProgramCodes.length
                ? targetProgramCodes.map((code) => resolveStudentProgram({ programCode: code }).name).join(", ")
                : eligibleBranches.join(", "));

        criteriaBreakdown.push({
            criterion: "Department / Branch",
            required: requiredPrograms || "No approved programs configured",
            actual: studentProgram?.name || student.branch || student.department || "Unknown",
            passed: branchMatches
        });

        if (!branchMatches) {
            failureReasons.push(
                `Your academic program (${studentProgram?.name || student.branch || student.department || "unknown"}) is not in the eligible programs list (${requiredPrograms || "none"})`
            );
        }

        // 6. CGPA Cutoff Evaluation
        const shouldCheckCgpa = drive.checkCgpa !== false;
        const minCGPA = Number(drive.minimumCGPA) || 0;
        if (shouldCheckCgpa && minCGPA > 0) {
            const cgpaPassed = studentCGPA >= minCGPA;
            criteriaBreakdown.push({
                criterion: "CGPA Score",
                required: `>= ${minCGPA.toFixed(2)}`,
                actual: studentCGPA.toFixed(2),
                passed: cgpaPassed
            });

            if (!cgpaPassed) {
                failureReasons.push(
                    `Current CGPA (${studentCGPA.toFixed(2)}) is below minimum required (${minCGPA.toFixed(2)})`
                );
            }
        }

        // 7. Active Backlogs Evaluation
        const shouldCheckBacklogs = drive.checkBacklogs !== false;
        if (shouldCheckBacklogs) {
            const maxAllowedBacklogs = Number(drive.maximumBacklogs) || 0;
            const backlogsPassed = studentActiveBacklogs <= maxAllowedBacklogs;

            criteriaBreakdown.push({
                criterion: "Active Backlogs",
                required: `<= ${maxAllowedBacklogs} backlogs`,
                actual: `${studentActiveBacklogs} active backlogs`,
                passed: backlogsPassed
            });

            if (!backlogsPassed) {
                failureReasons.push(
                    `Active backlogs (${studentActiveBacklogs}) exceed maximum allowed (${maxAllowedBacklogs})`
                );
            }
        }

        // 8. 10th Percentage Cutoff (if configured or enabled)
        const shouldCheckTenth = drive.checkTenthMarks || (drive.minimumTenthPercentage && Number(drive.minimumTenthPercentage) > 0);
        if (shouldCheckTenth) {
            const minTenth = Number(drive.minimumTenthPercentage) || 0;
            const tenthPassed = studentTenth >= minTenth;

            criteriaBreakdown.push({
                criterion: "10th Standard Cutoff",
                required: `>= ${minTenth}%`,
                actual: `${studentTenth}%`,
                passed: tenthPassed
            });

            if (!tenthPassed) {
                failureReasons.push(
                    `10th percentage (${studentTenth}%) is below minimum required (${minTenth}%)`
                );
            }
        }

        // 9. 12th / Diploma Percentage Cutoff (if configured or enabled)
        const shouldCheckTwelfth = drive.checkTwelfthMarks || (drive.minimumTwelfthPercentage && Number(drive.minimumTwelfthPercentage) > 0);
        if (shouldCheckTwelfth) {
            const minTwelfth = Number(drive.minimumTwelfthPercentage) || 0;
            const twelfthPassed = studentTwelfth >= minTwelfth;

            criteriaBreakdown.push({
                criterion: "12th / Diploma Cutoff",
                required: `>= ${minTwelfth}%`,
                actual: `${studentTwelfth}%`,
                passed: twelfthPassed
            });

            if (!twelfthPassed) {
                failureReasons.push(
                    `12th / Diploma percentage (${studentTwelfth}%) is below minimum required (${minTwelfth}%)`
                );
            }
        }

        // 10. Education Gap Verification (if configured)
        if (drive.checkEducationGaps) {
            const studentHasGap = Boolean(
                student.hasEducationGap ||
                (Array.isArray(student.educationGaps) && student.educationGaps.length > 0)
            );
            let totalGapYears = 0;
            if (Array.isArray(student.educationGaps) && student.educationGaps.length > 0) {
                totalGapYears = student.educationGaps.reduce((sum, g) => {
                    if (g.durationMonths) return sum + (g.durationMonths / 12);
                    if (g.startYear && g.endYear && g.endYear >= g.startYear) return sum + Math.max(1, g.endYear - g.startYear);
                    return sum + 1;
                }, 0);
                totalGapYears = Math.round(totalGapYears * 10) / 10;
            } else if (studentHasGap) {
                totalGapYears = 1;
            }

            const allowsGaps = drive.allowEducationGaps !== false;
            const maxAllowedGapYears = Number(drive.maxEducationGapYears) || 0;
            let gapPassed = true;
            let gapReason = "";

            if (studentHasGap) {
                if (!allowsGaps) {
                    gapPassed = false;
                    gapReason = "Education gaps are not permitted for this placement drive";
                } else if (totalGapYears > maxAllowedGapYears) {
                    gapPassed = false;
                    gapReason = `Total education gap (${totalGapYears} year(s)) exceeds allowed threshold (${maxAllowedGapYears} year(s))`;
                }
            }

            criteriaBreakdown.push({
                criterion: "Education Gap Check",
                required: !allowsGaps
                    ? "No education gaps permitted"
                    : `Max ${maxAllowedGapYears} year(s) gap allowed`,
                actual: studentHasGap ? `${totalGapYears} year(s) gap declared` : "No education gaps",
                passed: gapPassed
            });

            if (!gapPassed) {
                failureReasons.push(gapReason);
            }
        }

        // 11. Historical Backlogs Limit (if configured)
        if (
            drive.maximumHistoricalBacklogs != null &&
            drive.maximumHistoricalBacklogs >= 0
        ) {
            const maxHist = Number(drive.maximumHistoricalBacklogs);
            const histPassed = studentHistBacklogs <= maxHist;

            criteriaBreakdown.push({
                criterion: "Historical Backlogs Ledger",
                required: `<= ${maxHist} historical backlogs`,
                actual: `${studentHistBacklogs} historical backlogs`,
                passed: histPassed
            });

            if (!histPassed) {
                failureReasons.push(
                    `Historical backlogs count (${studentHistBacklogs}) exceeds allowed threshold (${maxHist})`
                );
            }
        }

        const isEligible = failureReasons.length === 0;

        return {
            status: isEligible ? EligibilityStatus.ELIGIBLE : EligibilityStatus.INELIGIBLE,
            isEligible,
            summary: isEligible
                ? "Eligible: Meets all academic, cohort, and document requirements"
                : "Ineligible for this placement drive",
            reasons: failureReasons,
            missingFields: [],
            criteriaBreakdown
        };
    }
}
