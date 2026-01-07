-- Reactivate Jess Ives' staff account
UPDATE staff_users 
SET is_active = true 
WHERE email = 'jessicaives@allstate.com';