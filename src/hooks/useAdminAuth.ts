import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [role, setRole] = useState<"admin" | "moderator" | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/admin/login");
        return;
      }

      // Check admin first
      const { data: isAdminRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin' as const,
      });

      if (isAdminRole) {
        setIsAdmin(true);
        setRole("admin");
        setLoading(false);
        return;
      }

      // Check moderator
      const { data: isModRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'moderator' as const,
      });

      if (isModRole) {
        setIsAdmin(true);
        setRole("moderator");
        setLoading(false);
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

  return { isAdmin, loading, role };
}
