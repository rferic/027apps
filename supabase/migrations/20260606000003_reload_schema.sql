-- Force PostgREST schema reload to pick up the app_settings table
notify pgrst, 'reload schema';
