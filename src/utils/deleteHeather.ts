import { supabase } from '@/integrations/supabase/client';

export const deleteHeatherAccount = async () => {
  try {
    // Get the current session to send the auth token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No authentication token found');
    }

    // Call the edge function to delete the user
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: {
        userId: '35a88f0c-f5ed-44d9-b08a-96db87ad62f7' // Heather's user ID
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return { success: true, message: 'Heather\'s account deleted successfully' };
  } catch (error: any) {
    console.error('Error deleting Heather\'s account:', error);
    throw error;
  }
};