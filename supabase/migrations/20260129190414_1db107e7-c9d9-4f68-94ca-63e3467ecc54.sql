-- Fix help video keys to match in-app HelpVideoButton usage

update public.help_videos
set video_key = 'cancel_audit'
where trim(video_key) = 'Cancel Audit';

update public.help_videos
set video_key = 'sales_dashboard'
where trim(video_key) = 'Sales Dashboard';
