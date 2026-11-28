alter table todo_task_occurrences drop column if exists notified_at;
alter table todo_tasks drop column if exists overdue_notified_on;
