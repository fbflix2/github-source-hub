import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type AdminRole = "admin" | "moderator" | null;

interface AdminAuthState {
  isAdmin: boolean | null;
  loading: boolean;
  role: AdminRole;
}

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    isAdmin: null,
    loading: true,
    role: null,
  });
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/admin/login");
        return;
      }

      const { data: isAdminRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin' as const,
      });

      if (isAdminRole) {
        setState({ isAdmin: true, loading: false, role: "admin" });
        return;
      }

      const { data: isModRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'moderator' as const,
      });

      if (isModRole) {
        setState({ isAdmin: true, loading: false, role: "moderator" });
        return;
      }

      await supabase.auth.signOut();
      navigate("/admin/login");
    };

    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate("/admin/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return { isAdmin: state.isAdmin, loading: state.loading, role: state.role };
}
