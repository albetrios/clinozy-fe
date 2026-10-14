// The app shell mounts this barrel. Export only the lazy shell — `BugReport.tsx` itself is
// imported directly by its own tests and loaded on demand by the shell.
export { BugReportLazy } from './BugReportLazy.tsx';
