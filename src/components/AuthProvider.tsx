// src/components/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { User } from "@supabase/supabase-js";

export type Role = "admin" | "dev" | "poster" | "user" | "reader";

interface AuthContextProps {
  user: User | null;
  role: Role;
  quota: number;
  loading: boolean;
  logout: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, role?: string, extraMetadata?: Record<string, string>) => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  role: "reader",
  quota: 0,
  loading: true,
  logout: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  refetchProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("reader");
  const [quota, setQuota] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, quota")
        .eq("id", uid)
        .single();

      if (error) {
        console.error("Profile fetch error", error);
        setRole("reader");
        setQuota(0);
      } else {
        setRole((data?.role as Role) || "reader");
        setQuota(data?.quota ?? 0);
      }
    } catch (err) {
      console.error("Error fetching role:", err);
      setRole("reader");
      setQuota(0);
    }
  };

  const refetchProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up the auth state listener first — it fires immediately with the
    // current session, so we don't need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        // Use setTimeout to defer the async profile fetch outside the listener
        // callback, avoiding potential Supabase deadlock on nested calls
        setTimeout(() => fetchProfile(currentUser.id), 0);
      } else {
        setRole("reader");
        setQuota(0);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []); // Empty deps — subscribe once, the listener handles all state changes

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string, signupRole?: string, extraMetadata?: Record<string, string>) => {
    // Only allow safe roles on self-signup — admin/dev must be assigned by a dev
    const allowedSelfRoles = ["user", "poster"];
    const safeRole = allowedSelfRoles.includes(signupRole ?? "") ? signupRole : "user";

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: safeRole,
          full_name: extraMetadata?.full_name || email.split("@")[0],
          ...extraMetadata,
        },
      },
    });
    if (error) throw error;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Sign out error:", error);
    // State will be cleared by the onAuthStateChange SIGNED_OUT event
  };

  return (
    <AuthContext.Provider value={{ user, role, quota, loading, logout, signInWithEmail, signUpWithEmail, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
