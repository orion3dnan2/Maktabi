# Permissions — first shared-data milestone

Server policies are authoritative; frontend controls follow these rules.

| Operation | Platform owner only | Office admin | Lawyer | Employee | Reception | Client |
|---|---|---|---|---|---|---|
| Manage office SaaS status | Yes | No | No | No | No | No |
| Read clients | No | Office | Own/accessible cases | Office | Office | Portal projection only |
| Create clients | No | Yes | Yes | Yes | Yes | No |
| Edit clients | No | Yes | Accessible | Yes | Contact fields only | No |
| Read/create/edit cases | No | Office | Assigned/created; create allowed | Office | No | Portal projection only |
| Assign case team | No | Yes | No | No | No | No |
| Manage team accounts | No | Yes | No | No | No | No |
| Change office settings | No | Yes | No | No | No | No |

Suspended or invited membership grants no work access. Suspended offices grant no work access. Platform ownership alone grants no office membership. The current UI selects the legacy profile's office; future switching must select a validated membership.

Local legacy modules are not protected by server RLS and are not yet shared. Their migration is tracked separately; no claim of cloud enforcement is made for local writes.
