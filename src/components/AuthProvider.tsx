// src/components/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, signInWithGoogle, signOut as firebaseSignOut } from "../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { supabase } from "../lib/supabase";

type Role = "admin" | "publisher" | "reader";

interface AuthContextProps {
  user: User | null;
  role: Role;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  role: "reader",
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("reader");
  const [loading, setLoading] = useState(true);

  const fetchRole = async (uid: string) => {
    const { data, error } = await supabase.from("profiles").select("role").eq("uid", uid).single();
    if (error) {
      console.error("Profile fetch error", error);
      setRole("reader");
    } else {
      setRole(data.role as Role);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await fetchRole(u.uid);
      } else {
        setRole("reader");
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async () => {
    const u = await signInWithGoogle();
    setUser(u);
    await fetchRole(u.uid);
  };

  const logout = async () => {
    await firebaseSignOut();
    setUser(null);
    setRole("reader");
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
