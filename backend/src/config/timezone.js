"use strict";

// The business runs on Bangladesh time. Day boundaries all over the code
// ("today", "this month", report date ranges) use local-time Date methods such
// as setHours(0, 0, 0, 0), so the process must run in Asia/Dhaka whatever the
// host is set to. A VPS or container usually runs in UTC: there, "today"
// started at 6 AM Bangladesh time and the dashboard kept showing yesterday's
// sales until then. Must be loaded before any Date is created.
//

// Hosts and container images often set TZ=UTC themselves, so TZ is overridden
// rather than defaulted. APP_TIMEZONE picks another zone if ever needed.
process.env.TZ = process.env.APP_TIMEZONE || "Asia/Dhaka";
