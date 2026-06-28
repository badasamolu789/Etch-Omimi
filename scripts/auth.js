(function () {
    const auth = window.EtchAuth || {};

    function setFeedback(element, message, type = "error") {
        if (!element) return;
        element.textContent = normalizeMessage(message, type === "success" ? "Done." : "Something went wrong. Please try again.");
        element.classList.toggle("form-feedback--success", type === "success");
        element.classList.toggle("form-feedback--error", type !== "success");
    }

    function normalizeMessage(value, fallback) {
        if (!value) return fallback;
        if (typeof value === "string") {
            const trimmed = value.trim();
            return trimmed && trimmed !== "{}" ? trimmed : fallback;
        }
        if (typeof value === "object") {
            const useful = value.message || value.error_description || value.error || value.msg || value.details || value.hint;
            if (useful) return normalizeMessage(useful, fallback);
            return fallback;
        }
        return String(value);
    }

    function errorDebugText(error) {
        if (!error || typeof error !== "object") return "";
        const parts = [];
        const keys = new Set([
            ...Object.keys(error),
            ...Object.getOwnPropertyNames(error),
            ...Object.getOwnPropertyNames(Object.getPrototypeOf(error) || {}),
        ]);

        keys.forEach((key) => {
            if (["stack", "constructor"].includes(key)) return;
            try {
                const value = error[key];
                if (typeof value === "string" || typeof value === "number") {
                    parts.push(`${key}: ${value}`);
                }
            } catch (_err) {
                // Some browser error properties throw when read.
            }
        });

        return parts.join(" | ");
    }

    function authErrorMessage(error, fallback) {
        const debug = errorDebugText(error);
        const message = normalizeMessage(error, debug || fallback);
        const raw = `${debug} ${JSON.stringify(error || {})}`.toLowerCase();
        if (
            raw.includes("redirect") ||
            raw.includes("emailredirectto") ||
            raw.includes("not allowed") ||
            raw.includes("invalid")
        ) {
            return "Signup is blocked by Supabase redirect settings. Add http://127.0.0.1:5500/auth/confirm.html to Authentication > URL Configuration.";
        }
        if (
            raw.includes("database") ||
            raw.includes("saving new user") ||
            raw.includes("authretryablefetcherror") ||
            raw.includes("status: 500")
        ) {
            return "Supabase returned a signup server error. Check Auth Logs; if SMTP is enabled, use the exact SMTP host from your mail provider, without https:// or a port in the host field.";
        }
        if (raw.includes("already") || raw.includes("registered")) {
            return "This email already has an Etch account. Please sign in instead, or use a fresh email for testing.";
        }
        return message;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showSignupConfirmation(email) {
        const safeEmail = escapeHtml(email || "your email");
        if (!window.EtchUI?.openDialog) return;

        window.EtchUI.openDialog({
            title: "Check your email",
            content: `
                <div class="auth-status">
                    <span class="auth-status__icon" aria-hidden="true">+</span>
                    <h3>Confirm your Etch account</h3>
                    <p>We sent a confirmation link to <strong>${safeEmail}</strong>. Open the latest email from Etch, confirm your address, then continue your setup.</p>
                    <p class="auth-status__note">If the link says expired, request a fresh signup email and use the newest message in your inbox.</p>
                </div>
            `,
            actionLabel: "Go to sign in",
            onAction(close) {
                close();
                (window.EtchRouter?.navigate || ((path) => { window.location.href = path; }))(ROUTES.authSignin);
            },
        });
    }

    async function handleSignIn(event) {
        event.preventDefault();
        const form = event.target;
        const feedback = form.querySelector("[data-signin-feedback]");
        const email = form.email.value.trim();
        const password = form.password.value.trim();

        if (!email || !password) {
            setFeedback(feedback, "Please enter both email and password.");
            return;
        }

        window.EtchUI?.setButtonLoading(form.querySelector("[data-signin-button]"), true, "Signing in...");
        setFeedback(feedback, "Signing in...");
        const { data, error } = await window.EtchSupabase.signIn(email, password);

        if (error) {
            window.EtchUI?.setButtonLoading(form.querySelector("[data-signin-button]"), false);
            console.warn("Etch sign-in error:", error);
            setFeedback(feedback, authErrorMessage(error, "Unable to sign in."));
            return;
        }

        if (!data?.session) {
            window.EtchUI?.setButtonLoading(form.querySelector("[data-signin-button]"), false);
            setFeedback(feedback, "Sign in succeeded but no session was detected.");
            return;
        }

        const profileRes = await window.EtchSupabase.getProfile(data.user.id);
        if (profileRes.error || !profileRes.data) {
            window.EtchUI?.setButtonLoading(form.querySelector("[data-signin-button]"), false);
            setFeedback(feedback, "Signed in, but your profile is not set up yet.");
            (window.EtchRouter?.navigate || ((path) => { window.location.href = path; }))(ROUTES.authOnboarding);
            return;
        }

        setFeedback(feedback, "Sign in successful. Redirecting...", "success");
        auth.redirectWithProfile(profileRes.data);
    }

    const ROUTES = {
        authSignin: "/auth/signin",
        authSignup: "/auth/signup",
        authOnboarding: "/auth/onboarding",
        userDashboard: "/user/dashboard",
        adminDashboard: "/admin/dashboard",
    };

    async function handleSignUp(event) {
        event.preventDefault();
        const form = event.target;
        const feedback = form.querySelector("[data-signup-feedback]");
        const fullName = form.full_name.value.trim();
        const email = form.email.value.trim();
        const password = form.password.value.trim();
        const confirmPassword = form.confirm_password.value.trim();
        const role = form.role.value;

        if (!fullName || !email || !password || !confirmPassword || !role) {
            setFeedback(feedback, "Please complete all fields to create your account.");
            return;
        }

        if (password !== confirmPassword) {
            setFeedback(feedback, "Passwords do not match.");
            return;
        }

        setFeedback(feedback, "Creating your account...");
        window.EtchUI?.setButtonLoading(form.querySelector("[data-signup-button]"), true, "Creating...");
        const { data, error } = await window.EtchSupabase.signUp(email, password, {
            full_name: fullName,
            role,
        });

        if (error) {
            window.EtchUI?.setButtonLoading(form.querySelector("[data-signup-button]"), false);
            console.warn("Etch signup error:", error);
            setFeedback(feedback, authErrorMessage(error, "Unable to create account. Please check your Supabase auth settings and try again."));
            return;
        }

        if (data?.user) {
            const hasSession = Boolean(data.session);
            const profile = {
                id: data.user.id,
                email,
                role,
                full_name: fullName,
                onboarding_complete: false,
                created_at: new Date().toISOString(),
            };

            if (hasSession) {
                const profileRes = await window.EtchSupabase.ensureProfile(profile);
                if (profileRes.error) {
                    window.EtchUI?.setButtonLoading(form.querySelector("[data-signup-button]"), false);
                    console.warn("Etch profile setup error:", profileRes.error);
                    setFeedback(feedback, authErrorMessage(profileRes.error, "Account created, but profile setup failed."));
                    return;
                }
            } else {
                window.EtchUI?.setButtonLoading(form.querySelector("[data-signup-button]"), false);
                form.reset();
                setFeedback(feedback, "Account created. Check your email to confirm your account before onboarding.", "success");
                showSignupConfirmation(email);
                return;
            }

            setFeedback(feedback, "Account created. Opening your dashboard...", "success");
            auth.redirectWithProfile(profile);
            return;
        }

        window.EtchUI?.setButtonLoading(form.querySelector("[data-signup-button]"), false);
        setFeedback(feedback, "Account creation completed but sign-in failed.");
    }

    auth.handleConfirmationPage = async function handleConfirmationPage() {
        const statusNode = document.querySelector("[data-confirm-status]");
        const titleNode = document.querySelector("[data-confirm-title]");
        const messageNode = document.querySelector("[data-confirm-message]");
        const actionsNode = document.querySelector("[data-confirm-actions]");

        function render(state, title, message, actions = "") {
            if (statusNode) statusNode.dataset.state = state;
            if (titleNode) titleNode.textContent = title;
            if (messageNode) messageNode.textContent = message;
            if (actionsNode) actionsNode.innerHTML = actions;
        }

        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const error = searchParams.get("error_description") || hashParams.get("error_description");

        if (error) {
            render(
                "error",
                "Link expired",
                error.replace(/\+/g, " "),
                `<a class="button button--primary" href="signup">Create account again</a><a class="button button--secondary" href="signin">Sign in</a>`
            );
            return;
        }

        render("loading", "Confirming email", "Please wait while Etch verifies your account.");

        const client = await window.EtchSupabase.getClient();
        if (!client) {
            render("error", "Supabase not configured", "Add your Supabase URL and anon key before confirming accounts.");
            return;
        }

        const code = searchParams.get("code");
        if (code && client.auth.exchangeCodeForSession) {
            const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
            if (exchangeError) {
                render(
                    "error",
                    "Could not confirm",
                    exchangeError.message || "The confirmation link could not be verified.",
                    `<a class="button button--primary" href="signup">Request a new link</a>`
                );
                return;
            }
        }

        const session = await window.EtchSupabase.getSession();
        if (!session?.user) {
            render(
                "error",
                "Confirmation needed",
                "Your link may have expired or already been used. Please sign in, or create the account again to receive a fresh email.",
                `<a class="button button--primary" href="signin">Sign in</a><a class="button button--secondary" href="signup">Create account</a>`
            );
            return;
        }

        const metadata = session.user.user_metadata || {};
        const profileRes = await window.EtchSupabase.ensureProfile({
            id: session.user.id,
            email: session.user.email || "",
            role: metadata.role || "buyer",
            full_name: metadata.full_name || session.user.email?.split("@")[0] || "Etch user",
            onboarding_complete: false,
            created_at: new Date().toISOString(),
        });
        const profile = profileRes.data || {
            id: session.user.id,
            email: session.user.email || "",
            role: metadata.role || "buyer",
            full_name: metadata.full_name || "Etch user",
        };

        render(
            "success",
            "Email confirmed",
            "Your Etch account is ready. Opening your dashboard now.",
            `<a class="button button--primary" href="${profile.role === "admin" ? "../admin/dashboard" : "../user/dashboard"}">Open dashboard</a><a class="button button--secondary" href="../index">Back home</a>`
        );
        window.setTimeout(() => auth.redirectWithProfile(profile), 1200);
    };

    async function handleForgotPassword(event) {
        event.preventDefault();
        const form = event.target;
        const feedback = form.querySelector("[data-forgot-feedback]");
        const email = form.email.value.trim();

        if (!email) {
            setFeedback(feedback, "Please enter your email.");
            return;
        }

        setFeedback(feedback, "Sending password reset link...");

        const { error } = await window.EtchSupabase.resetPassword(email);
        if (error) {
            setFeedback(feedback, error.message || "Unable to send reset link.");
            return;
        }

        setFeedback(feedback, "Check your email for the reset link.", "success");
    }

    async function handleOnboarding(event) {
        event.preventDefault();
        const form = event.target;
        const feedback = form.querySelector("[data-onboarding-feedback]");
        const formData = new FormData(form);
        const role = formData.get("role") || "buyer";

        const payload = {
            id: null,
            role,
            full_name: formData.get("full_name")?.toString().trim(),
            country: formData.get("country")?.toString().trim(),
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
        };

        if (role === "buyer") {
            payload.company = formData.get("company")?.toString().trim();
            payload.creative_need = formData.get("creative_need")?.toString().trim();
            payload.budget_range = formData.get("budget_range")?.toString().trim();
            payload.preferred_categories = formData.get("preferred_categories")?.toString().trim();
        } else {
            payload.studio_name = formData.get("studio_name")?.toString().trim();
            payload.bio = formData.get("bio")?.toString().trim();
            payload.specialization = formData.get("specialization")?.toString().trim();
            payload.portfolio_link = formData.get("portfolio_link")?.toString().trim();
            payload.avatar_url = formData.get("avatar_url")?.toString().trim();
        }

        if (!payload.full_name || !payload.country) {
            setFeedback(feedback, "Please complete the required profile fields.");
            return;
        }

        setFeedback(feedback, "Saving your profile...");
        const user = await window.EtchSupabase.getUser();
        if (!user) {
            (window.EtchRouter?.navigate || ((path) => { window.location.href = path; }))(ROUTES.authSignin);
            return;
        }

        payload.id = user.id;
        const { data, error } = await window.EtchSupabase.updateProfile(payload);

        if (error) {
            setFeedback(feedback, error.message || "Unable to save onboarding details.");
            return;
        }

        setFeedback(feedback, "Onboarding complete. Redirecting...", "success");
        auth.redirectWithProfile(data || { ...payload, id: user.id });
    }

    auth.redirectWithProfile = async function redirectWithProfile(profile) {
        if (!profile || !profile.role) {
            (window.EtchRouter?.navigate || ((path) => { window.location.href = path; }))(ROUTES.authSignin);
            return;
        }

        if (profile.role === "admin") {
            (window.EtchRouter?.navigate || ((path) => { window.location.href = path; }))(ROUTES.adminDashboard);
            return;
        }

        (window.EtchRouter?.navigate || ((path) => { window.location.href = path; }))(ROUTES.userDashboard);
    };

    auth.initAuthPage = function initAuthPage() {
        const signinForm = document.querySelector("[data-signin-form]");
        const signupForm = document.querySelector("[data-signup-form]");
        const forgotForm = document.querySelector("[data-forgot-form]");
        const onboardingForm = document.querySelector("[data-onboarding-form]");
        const confirmStatus = document.querySelector("[data-confirm-status]");
        const roleInput = document.querySelector("[data-role-input]");
        const buyerFields = document.querySelector("[data-buyer-fields]");
        const creatorFields = document.querySelector("[data-creator-fields]");

        if (signinForm) {
            signinForm.addEventListener("submit", handleSignIn);
        }

        if (signupForm) {
            signupForm.addEventListener("submit", handleSignUp);
        }

        if (forgotForm) {
            forgotForm.addEventListener("submit", handleForgotPassword);
        }

        if (onboardingForm) {
            const roleFromQuery = new URLSearchParams(window.location.search).get("role");
            if (roleInput && roleFromQuery) {
                roleInput.value = roleFromQuery;
            }

            function syncFields() {
                const currentRole = roleInput?.value || "buyer";
                if (buyerFields && creatorFields) {
                    buyerFields.hidden = currentRole !== "buyer";
                    creatorFields.hidden = currentRole !== "creator";
                }
            }

            syncFields();
            onboardingForm.addEventListener("submit", handleOnboarding);
        }

        if (confirmStatus) {
            auth.handleConfirmationPage();
        }
    };

    auth.protectDashboard = async function protectDashboard(allowedRoles) {
        const session = await window.EtchSupabase.requireSession(allowedRoles, "/auth/signin");
        if (!session) return;

        const topbar = document.querySelector(".dashboard-topbar");
        if (topbar && session.profile && session.profile.full_name) {
            const title = topbar.querySelector("h1");
            if (title) {
                title.textContent = `${session.profile.full_name}'s dashboard`;
            }
        }
    };

    window.EtchAuth = auth;

    document.addEventListener("DOMContentLoaded", () => {
        auth.initAuthPage();

        const path = window.location.pathname;
        if (path.includes("/user/")) {
            auth.protectDashboard(["buyer", "creator"]);
        }

        if (path.includes("/admin/")) {
            auth.protectDashboard(["admin"]);
        }
    });
})();
