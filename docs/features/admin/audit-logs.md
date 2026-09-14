# Audit Logs

`/admin/audit-logs` presents sensitive administrative activity as a read-only history. Records should include actor, action, target, timestamp, severity, and outcome where the backend provides them. Empty and unavailable states must be distinct. Audit records must not expose tokens, private document content, or raw request headers.
