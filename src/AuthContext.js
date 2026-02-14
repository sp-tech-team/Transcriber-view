import React, { createContext, useState, useEffect } from "react";
import { supabase } from "./supabase/supabaseClient";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Check if user profile is deleted
  const checkIfUserDeleted = async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("deleted")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error checking user deletion status:", error);
      return false;
    }

    // If profile exists and deleted is true, user is banned
    if (data && data.deleted === true) {
      console.log("🚫 User is deleted/banned");
      return true;
    }

    return false;
  };

  // ✅ Create or update profile
  const ensureProfile = async (user) => {
    if (!user) return;

    // First check if user is deleted
    const isDeleted = await checkIfUserDeleted(user.id);
    if (isDeleted) {
      console.log("❌ User is banned, signing out");
      await supabase.auth.signOut();
      sessionStorage.setItem(
        "loginError",
        "Your account has been deactivated. Please contact an administrator."
      );
      return;
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      // Create new profile
      const { error: insertError } = await supabase.from("profiles").insert([
        {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          deleted: false,
        },
      ]);

      if (insertError) {
        console.error("Error creating profile:", insertError);
      } else {
        console.log("✅ Profile created for:", user.email);
      }
    }
  };

  // ✅ Fetch profile data
  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Fetch profile error:", error);
      return;
    }

    // Double-check deleted status
    if (data && data.deleted === true) {
      console.log("🚫 Profile is deleted during fetch");
      await supabase.auth.signOut();
      sessionStorage.setItem(
        "loginError",
        "Your account has been deactivated. Please contact an administrator."
      );
      return;
    }

    setProfile(data);
  };

  // ✅ Verify token scopes
  async function verifyTokenScopes(token) {
    try {
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=" + token
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const scopes = data.scope || "";

      console.log("📋 Token scopes:", scopes);

      return scopes.includes("https://www.googleapis.com/auth/spreadsheets");
    } catch (error) {
      console.error("Error verifying token scopes:", error);
      return false;
    }
  }

  useEffect(() => {
    console.log("🚀 AuthProvider mounted - getting session...");

    let isMounted = true;

    const timeout = setTimeout(() => {
      if (isMounted) {
        console.warn("⏰ Auth check timeout - forcing loading = false");
        setLoading(false);
      }
    }, 5000);

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return;

        clearTimeout(timeout);

        console.log("📦 Initial session:", session ? "Found" : "Not found");

        // ✅ Check if token has spreadsheets scope
        if (session?.provider_token) {
          console.log("🔍 Checking token scopes...");

          const hasRequiredScope = await verifyTokenScopes(
            session.provider_token
          );

          if (!hasRequiredScope) {
            console.warn(
              "⚠️ Token missing required scopes - forcing re-authentication"
            );
            sessionStorage.setItem("scopeUpgradeRequired", "true");
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }
        }

        const currentUser = session?.user ?? null;

        if (currentUser) {
          console.log("👤 User found:", currentUser.email);

          // ✅ Check if user is deleted FIRST
          const isDeleted = await checkIfUserDeleted(currentUser.id);
          if (isDeleted) {
            console.log("❌ Deleted user detected, signing out");
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }

          // ✅ Ensure profile exists
          await ensureProfile(currentUser);
          await fetchProfile(currentUser.id);

          setUser(currentUser);
          setAccessToken(session?.provider_token ?? null);
        } else {
          console.log("👤 No user in session");
        }

        console.log("✅ Initial auth check complete - setting loading = false");
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;

        clearTimeout(timeout);
        console.error("❌ Error getting session:", err);
        setLoading(false);
      });

    // ✅ Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔔 Auth event:", event);

      if (event === "SIGNED_IN" && session?.user) {
        console.log("👤 User signed in, checking status...");

        // Check if user is deleted
        const isDeleted = await checkIfUserDeleted(session.user.id);
        if (isDeleted) {
          console.log("❌ Deleted user tried to sign in");
          sessionStorage.setItem(
            "loginError",
            "Your account has been deactivated. Please contact an administrator."
          );
          await supabase.auth.signOut();
          return; // ✅ Return early, don't set user
        }

        await ensureProfile(session.user);
        await fetchProfile(session.user.id);
        setUser(session.user);
        setAccessToken(session.provider_token);
      }

      if (event === "SIGNED_OUT") {
        console.log("🔴 User signed out");
        setUser(null);
        setProfile(null);
        setAccessToken(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      console.log("🔴 Logout initiated");

      setUser(null);
      setProfile(null);
      setAccessToken(null);

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("❌ Logout error:", error);
        throw error;
      }

      console.log("✅ Successfully logged out");
    } catch (err) {
      console.error("❌ Logout failed:", err);
      alert("Failed to log out. Please try again.");
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, accessToken, loading, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
