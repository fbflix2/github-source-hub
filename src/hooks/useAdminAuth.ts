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

    const checkAdmin = async (retryCount = 0) => {
      try {
        let { data: { session } } = await supabase.auth.getSession();

        // If no session, try refreshing (token may have expired in background)
        if (!session) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          session = refreshData.session;
        }

        // Still no session — retry up to 2 times with delay before giving up
        if (!session) {
          if (retryCount < 2) {
            console.warn(`[useAdminAuth] No session found, retrying (${retryCount + 1}/2)...`);
            await new Promise(r => setTimeout(r, 1500));
            if (!cancelled) return checkAdmin(retryCount + 1);
            return;
          }
          // Only redirect if user truly has no session after retries
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
        // NEVER logout on transient/network errors — just stop loading
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (event === 'SIGNED_OUT') {
        setState({ isAdmin: null, loading: false, role: null });
        navigate("/admin/login");
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Re-verify role on token refresh to keep session alive
        verifyRole(session.user.id).then(role => {
          if (cancelled) return;
          if (role) {
            setState({ isAdmin: true, loading: false, role });
          }
        }).catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      checkedRef.current = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return { isAdmin: state.isAdmin, loading: state.loading, role: state.role };
}
