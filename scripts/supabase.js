(function () {
    const namespace = window.EtchSupabase || {};
    namespace.client = null;
    namespace.initialized = false;
    namespace.configured = false;
    namespace._sessionPromise = null;

    function loadSupabaseScript() {
        if (window.supabase?.createClient) return Promise.resolve();
        if (document.querySelector("script[data-etch-supabase-cdn]")) {
            return new Promise((resolve) => {
                const poll = window.setInterval(() => {
                    if (window.supabase?.createClient) {
                        window.clearInterval(poll);
                        resolve();
                    }
                }, 50);
                window.setTimeout(() => {
                    window.clearInterval(poll);
                    resolve();
                }, 2500);
            });
        }

        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js";
            script.async = true;
            script.dataset.etchSupabaseCdn = "true";
            script.onload = resolve;
            script.onerror = resolve;
            document.head.appendChild(script);
        });
    }

    namespace.init = async function initSupabase() {
        if (namespace.initialized) return namespace.client;

        const url = window.ETCH_SUPABASE_URL || "";
        const anonKey = window.ETCH_SUPABASE_ANON_KEY || "";

        namespace.initialized = true;
        namespace.configured = Boolean(url && anonKey);

        if (!url || !anonKey) {
            console.warn(
                "Supabase is not configured yet. Add your project URL and anon key to window.ETCH_SUPABASE_URL and window.ETCH_SUPABASE_ANON_KEY."
            );
            return null;
        }

        await loadSupabaseScript();

        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            console.warn("Supabase client script is not loaded yet.");
            return null;
        }

        namespace.client = window.supabase.createClient(url, anonKey);
        return namespace.client;
    };

    namespace.getClient = async function getClient() {
        return await namespace.init();
    };

    namespace.getSession = async function getSession() {
        const client = await namespace.getClient();
        if (!client) return null;
        if (namespace._sessionPromise) return namespace._sessionPromise;
        namespace._sessionPromise = client.auth.getSession();
        const { data, error } = await namespace._sessionPromise;
        namespace._sessionPromise = null;
        if (error) {
            console.warn("Supabase getSession error:", error.message);
            return null;
        }
        return data.session;
    };

    namespace.getUser = async function getUser() {
        const session = await namespace.getSession();
        return session?.user ?? null;
    };

    namespace.signIn = async function signIn(email, password) {
        const client = await namespace.getClient();
        if (!client) return { error: { message: "Supabase is not configured yet." } };
        namespace._sessionPromise = null;
        return client.auth.signInWithPassword({ email, password });
    };

    namespace.signUp = async function signUp(email, password, metadata = {}) {
        const client = await namespace.getClient();
        if (!client) return { error: { message: "Supabase is not configured yet." } };
        namespace._sessionPromise = null;
        return client.auth.signUp({
            email,
            password,
            options: { data: metadata },
        });
    };

    namespace.signOut = async function signOut() {
        const client = await namespace.getClient();
        if (!client) return { error: { message: "Supabase is not configured yet." } };
        namespace._sessionPromise = null;
        return client.auth.signOut();
    };

    namespace.resetPassword = async function resetPassword(email) {
        const client = await namespace.getClient();
        if (!client) return { error: { message: "Supabase is not configured yet." } };
        return client.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/signin`,
        });
    };

    namespace.getProfile = async function getProfile(userId) {
        const client = await namespace.getClient();
        if (!client) return { data: null, error: { message: "Supabase is not configured yet." } };
        return client.from("profiles").select("*").eq("id", userId).single();
    };

    namespace.getProfileByEmail = async function getProfileByEmail(email) {
        const client = await namespace.getClient();
        if (!client) return { data: null, error: { message: "Supabase is not configured yet." } };
        return client.from("profiles").select("*").eq("email", email).single();
    };

    namespace.createProfile = async function createProfile(profile) {
        const client = await namespace.getClient();
        if (!client) return { data: null, error: { message: "Supabase is not configured yet." } };
        return client.from("profiles").upsert([{ ...profile }], { onConflict: "id" }).select().single();
    };

    namespace.updateProfile = async function updateProfile(profile) {
        const client = await namespace.getClient();
        if (!client) return { data: null, error: { message: "Supabase is not configured yet." } };
        const { id, ...rest } = profile;
        return client.from("profiles").update(rest).eq("id", id).select().single();
    };

    namespace.createCreatorProfile = async function createCreatorProfile(data) {
        const client = await namespace.getClient();
        if (!client) return { data: null, error: { message: "Supabase is not configured yet." } };
        return client.from("creator_profiles").insert([{ ...data }]);
    };

    namespace.requireSession = async function requireSession(allowedRoles = ["buyer", "creator", "admin"], redirectTo = "/auth/signin") {
        const client = await namespace.getClient();
        if (!client) {
            window.location.href = redirectTo;
            return null;
        }

        const user = await namespace.getUser();
        if (!user) {
            window.location.href = redirectTo;
            return null;
        }

        const { data, error } = await namespace.getProfile(user.id);
        if (error || !data) {
            window.location.href = redirectTo;
            return null;
        }

        if (!allowedRoles.includes(data.role)) {
            window.location.href = redirectTo;
            return null;
        }

        return { user, profile: data };
    };

    namespace.redirectBasedOnRole = async function redirectBasedOnRole(profile) {
        if (!profile || !profile.role) {
            window.location.href = "/auth/signin";
            return;
        }

        if (profile.role === "admin") {
            window.location.href = "/admin/dashboard";
            return;
        }

        window.location.href = "/user/dashboard";
    };

    window.EtchSupabase = namespace;
})();
