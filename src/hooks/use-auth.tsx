import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { syncOnLogin, clearLocalCacheOnLogout } from "@/lib/cloud-sync";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let lastUserId: string | null = null;
    // CRITICAL: subscribe FIRST, then getSession
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      const newUid = s?.user?.id ?? null;
      if (event === "SIGNED_OUT") {
        lastUserId = null;
        clearLocalCacheOnLogout();
      } else if (newUid && newUid !== lastUserId) {
        lastUserId = newUid;
        // defer sync — never block auth events
        setTimeout(() => {
          void syncOnLogin();
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      const uid = s?.user?.id ?? null;
      if (uid && uid !== lastUserId) {
        lastUserId = uid;
        setTimeout(() => {
          void syncOnLogin();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}