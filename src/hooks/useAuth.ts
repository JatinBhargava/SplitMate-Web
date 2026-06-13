import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");

  const fetchDisplayName = (u: User) => {
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", u.id)
      .single()
      .then(({ data }) => {
        setDisplayName(data?.display_name || u.user_metadata?.display_name || "User");
      });
  };

  useEffect(() => {
    // Restore session from storage first
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchDisplayName(u);
      setLoading(false);
    });

    // Then listen for subsequent auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          fetchDisplayName(u);
        } else {
          setDisplayName("");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, displayName, signOut };
}
