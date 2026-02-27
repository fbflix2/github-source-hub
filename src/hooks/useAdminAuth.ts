// Admin auth hook - supports admin and moderator roles
import { useState, useEffect, useRef } from "react";
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
  const checkedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const verifyRole = async (userId: string): Promise<AdminRole> => {
      const { data: isAdminRole } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin' as const,
      });
      if (isAdminRole) return "admin";

      const { data: isModRole } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'moderator' as const,
      });
      if (isModRole) return "moderator";

      return null;
    };

    const checkAdmin = async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession();

        // If no session or token looks expired, try refreshing
        if (!session) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          session = refreshData.session;
        }

        if (!session) {
          if (!cancelled) navigate("/admin/login");
          return;
        }

        const role = await verifyRole(session.user.id);
        if (cancelled) return;

        if (role) {
          setState({ isAdmin: true, loading: false, role });
        } else {
          await supabase.auth.signOut();
          navigate("/admin/login");
        }
      } catch (err) {
        console.error("useAdminAuth check failed:", err);
        // Don't logout on transient errors — just stop loading
        if (!cancelled) {
          setState(prev => ({ ...prev, loading: false }));
        }
      }
    };

    // Only check once on mount
    if (!checkedRef.current) {
      checkedRef.current = true;
      checkAdmin();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (!cancelled) {
          setState({ isAdmin: null, loading: false, role: null });
          navigate("/admin/login");
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Re-verify role on token refresh to keep state fresh
        const role = await verifyRole(session.user.id);
        if (!cancelled && role) {
          setState({ isAdmin: true, loading: false, role });
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return { isAdmin: state.isAdmin, loading: state.loading, role: state.role };
}
