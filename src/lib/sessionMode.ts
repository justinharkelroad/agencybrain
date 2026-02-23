export const isStaffModeEnabled = () => {
  if (typeof window === 'undefined') return false;

  try {
    return (
      localStorage.getItem('auth_mode') === 'staff' &&
      !!localStorage.getItem('staff_session_token')
    );
  } catch (_err) {
    return false;
  }
};
