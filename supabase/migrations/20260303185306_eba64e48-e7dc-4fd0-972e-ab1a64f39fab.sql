-- Delete duplicate Bruno Peck (user_id: 3791597a, no data associated)
DELETE FROM user_roles WHERE user_id = '3791597a-a509-4b7d-9a0a-dd06104349c6';
DELETE FROM profiles WHERE user_id = '3791597a-a509-4b7d-9a0a-dd06104349c6';

-- Also delete from auth.users to fully remove the account
DELETE FROM auth.users WHERE id = '3791597a-a509-4b7d-9a0a-dd06104349c6';