/** Severity level for a warning. */
type WarningSeverity = "info" | "warn" | "error";

/** A non-fatal warning during spec parsing or generation. */
interface Warning {
  message: string;
  severity: WarningSeverity;
  file?: string;
  line?: number;
  column?: number;
}

/** A validation error with source location for precise CLI error reporting. */
interface ValidationError {
  /** Source file path or identifier. */
  file: string;
  /** Line number in the source (1-based), if available. */
  line?: number;
  /** Column number in the source (1-based), if available. */
  column?: number;
  /** Human-readable error message. */
  message: string;
  /** Optional error code for programmatic handling. */
  code?: string;
}

/** The overall result of spec validation. */
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: Warning[];
}

export type { ValidationError, ValidationResult, Warning, WarningSeverity };
