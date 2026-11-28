-- Overdue and missed-period notices are emitted once (spec §5.6: one warning,
-- not a reminder loop). The date remembers which period was already announced;
-- the occurrence keeps its own stamp because the job writes it before anyone
-- opens the app.
alter table todo_tasks add column overdue_notified_on date;
alter table todo_task_occurrences add column notified_at timestamptz;
