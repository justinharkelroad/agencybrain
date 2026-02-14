export const isStaffModeEnabled = () => {
  return localStorage.getItem('auth_mode') === 'staff';
};
