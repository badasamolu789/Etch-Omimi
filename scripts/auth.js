(function () {
    const auth = window.EtchAuth || {};

    function setFeedback(element, message, type = "error") {
        if (!element) return;
        element.textContent = message;
        element.classList.toggle("form-feedback--success", type === "success");
        element.classList.toggle("form-feedback--error", type !== "success");
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
            setFeedback(feedback, error.message || "Unable to sign in.");
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
            setFeedback(feedback, error.message || "Unable to create account.");
            return;
        }

        if (data?.user) {
            const profile = {
                id: data.user.id,
                email,
                role,
                full_name: fullName,
                onboarding_complete: false,
                created_at: new Date().toISOString(),
            };

            const profileRes = await window.EtchSupabase.createProfile(profile);
            if (profileRes.error) {
                window.EtchUI?.setButtonLoading(form.querySelector("[data-signup-button]"), false);
                setFeedback(feedback, profileRes.error.message || "Account created, but profile setup failed.");
                return;
            }
            setFeedback(feedback, "Account created. Continue to onboarding...", "success");
            (window.EtchRouter?.navigate || ((path) => { window.location.href = path; }))(ROUTES.authOnboarding + "?role=" + encodeURIComponent(role));
            return;
        }

        window.EtchUI?.setButtonLoading(form.querySelector("[data-signup-button]"), false);
        setFeedback(feedback, "Account creation completed but sign-in failed.");
    }

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
