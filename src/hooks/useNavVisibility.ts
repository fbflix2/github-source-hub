import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useNavVisibility() {
  const [hiddenLinks, setHiddenLinks] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "hidden_nav_links")
          .maybeSingle();

        if (data?.value) {
          try {
            setHiddenLinks(JSON.parse(data.value));
          } catch {
            setHiddenLinks([]);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    };
    fetch();
  }, []);

  return { hiddenLinks, loaded };
}
