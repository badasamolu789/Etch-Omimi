(function () {
  const api = window.EtchApi || {};
  const cache = new Map();
  const DEFAULT_TTL = 45000;

  function cacheKey(name, params) {
    return `${name}:${JSON.stringify(params || {})}`;
  }

  async function cached(name, params, loader, ttl = DEFAULT_TTL) {
    const key = cacheKey(name, params);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.createdAt < ttl) return hit.value;
    const value = await loader();
    cache.set(key, { value, createdAt: Date.now() });
    return value;
  }

  function compactNumber(value) {
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
  }

  async function requireClient() {
    const client = await window.EtchSupabase.getClient();
    if (!client) throw new Error("Supabase is not configured yet.");
    return client;
  }

  function normalizeListing(row = {}) {
    const profile = row.profiles || row.owner || {};
    return {
      ...row,
      owner_name: row.owner_name || profile.studio_name || profile.full_name || "",
      owner_title: row.owner_title || profile.specialization || profile.role || "",
      cover_url: row.cover_url,
    };
  }

  api.clearCache = function clearCache(prefix) {
    Array.from(cache.keys()).forEach((key) => {
      if (!prefix || key.startsWith(prefix)) cache.delete(key);
    });
  };

  api.getCreatorDashboard = async function getCreatorDashboard(ownerId) {
    return cached("creator-dashboard", { ownerId }, async () => {
      const client = await requireClient();

      const [liveListings, draftListings, listingRows, inquiryRows, earningsRows] = await Promise.all([
        client.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "live"),
        client.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "draft"),
        client.from("listings").select("id,title,category,status,views_count,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(4),
        client.from("inquiries").select("id,status,listings!inner(owner_id)").eq("listings.owner_id", ownerId).in("status", ["new", "open", "negotiating"]),
        client.from("orders").select("creator_amount,status,created_at").eq("creator_id", ownerId).in("status", ["paid", "released"]),
      ]);

      const earnings = (earningsRows.data || []).reduce((sum, row) => sum + Number(row.creator_amount || 0), 0);
      return {
        configured: true,
        stats: [
          { label: "Monthly earnings", value: money(earnings), detail: "Released and paid licensing revenue." },
          { label: "Active titles", value: compactNumber(liveListings.count), detail: `${compactNumber(draftListings.count)} drafts waiting to publish.` },
          { label: "Buyer inquiries", value: compactNumber(inquiryRows.data?.length || 0), detail: "Open licensing conversations." },
        ],
        listings: (listingRows.data || []).map((item) => ({
          title: item.title,
          meta: `${item.category || "Listing"} • ${item.status || "draft"} • ${compactNumber(item.views_count)} views`,
        })),
        activity: (inquiryRows.data || []).slice(0, 4).map((item) => ({
          title: "Buyer inquiry updated",
          meta: `${item.status || "open"} • inquiry ${String(item.id).slice(0, 8)}`,
        })),
      };
    });
  };

  api.getAdminDashboard = async function getAdminDashboard() {
    return cached("admin-dashboard", {}, async () => {
      const client = await requireClient();

      const [pendingReviews, tickets, payouts, users, recentReviews] = await Promise.all([
        client.from("listings").select("id", { count: "exact", head: true }).eq("status", "review"),
        client.from("support_tickets").select("id,subject,priority,status,created_at").in("status", ["new", "open"]).order("created_at", { ascending: false }).limit(4),
        client.from("payouts").select("amount,status").in("status", ["pending", "processing"]),
        client.from("profiles").select("id", { count: "exact", head: true }),
        client.from("listings").select("title,category,status,updated_at").in("status", ["review", "changes_requested"]).order("updated_at", { ascending: false }).limit(4),
      ]);

      const payoutTotal = (payouts.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
      return {
        configured: true,
        stats: [
          { label: "Pending reviews", value: compactNumber(pendingReviews.count), detail: "Assets waiting for quality control." },
          { label: "Urgent tickets", value: compactNumber(tickets.data?.length || 0), detail: "Open support items requiring response." },
          { label: "Open payouts", value: money(payoutTotal), detail: `${compactNumber(users.count)} total user accounts.` },
        ],
        priorities: (recentReviews.data || []).map((item) => ({
          title: item.title,
          meta: `${item.category || "Listing"} • ${item.status || "review"}`,
        })),
        queue: (tickets.data || []).map((ticket) => ({
          title: ticket.subject || "Support ticket",
          meta: `${ticket.priority || "normal"} priority • ${ticket.status || "open"}`,
        })),
      };
    });
  };

  api.listCreatorListings = async function listCreatorListings(ownerId) {
    return cached("creator-listings", { ownerId }, async () => {
      const client = await requireClient();
      const { data, error } = await client
        .from("listings")
        .select("id,title,category,status,views_count,updated_at")
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    });
  };

  api.getPublicListings = async function getPublicListings(options = {}) {
    return cached("public-listings", options, async () => {
      const client = await requireClient();
      const limit = options.limit || 24;
      const search = (options.search || "").trim();
      const category = (options.category || "").trim();

      let query = client
        .from("listings")
        .select("id,title,slug,category,description,price,currency,status,cover_url,rights_summary,views_count,updated_at,profiles:owner_id(full_name,studio_name,specialization,role)")
        .eq("status", "live")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (category && category !== "all") query = query.eq("category", category);
      if (search) query = query.or(`title.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(normalizeListing);
    });
  };

  api.getListing = async function getListing(identifier) {
    return cached("listing-detail", { identifier }, async () => {
      const client = await requireClient();

      const { data, error } = await client
        .from("listings")
        .select("id,title,slug,category,description,price,currency,status,cover_url,preview_url,rights_summary,views_count,updated_at,profiles:owner_id(full_name,studio_name,specialization,role,avatar_url,bio)")
        .or(`slug.eq.${identifier},id.eq.${identifier}`)
        .eq("status", "live")
        .maybeSingle();
      if (error) throw error;
      return data ? normalizeListing(data) : null;
    });
  };

  api.getFeaturedCreators = async function getFeaturedCreators(limit = 3) {
    return cached("featured-creators", { limit }, async () => {
      const client = await requireClient();

      const { data, error } = await client
        .from("profiles")
        .select("id,full_name,studio_name,specialization,bio,avatar_url")
        .eq("role", "creator")
        .eq("onboarding_complete", true)
        .limit(limit);
      if (error) throw error;
      return data || [];
    });
  };

  api.getPlatformSummary = async function getPlatformSummary() {
    return cached("platform-summary", {}, async () => {
      const client = await requireClient();
      const [liveListings, creatorCount, categories] = await Promise.all([
        client.from("listings").select("id", { count: "exact", head: true }).eq("status", "live"),
        client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "creator").eq("onboarding_complete", true),
        client
          .from("listings")
          .select("category")
          .eq("status", "live")
          .neq("category", "")
          .limit(200),
      ]);

      const categoryCount = Array.isArray(categories.data)
        ? new Set(categories.data.map((item) => item.category).filter(Boolean)).size
        : 0;

      return {
        liveListings: liveListings.count || 0,
        creatorCount: creatorCount.count || 0,
        liveCategories: categoryCount,
      };
    });
  };

  api.submitContact = async function submitContact(payload) {
    const client = await requireClient();
    return client.from("contacts").insert([{ ...payload }]).select().single();
  };

  api.subscribeNewsletter = async function subscribeNewsletter(email, source = "website") {
    const client = await requireClient();
    return client.from("subscribers").upsert([{ email, source }], { onConflict: "email" }).select().single();
  };

  api.createListing = async function createListing(payload) {
    const client = await requireClient();
    const { data, error } = await client.from("listings").insert([{ ...payload }]).select().single();
    if (!error) api.clearCache("creator-listings");
    return { data, error };
  };

  api.updateListing = async function updateListing(id, payload) {
    const client = await requireClient();
    const { data, error } = await client.from("listings").update({ ...payload }).eq("id", id).select().single();
    if (!error) {
      api.clearCache("creator-listings");
      api.clearCache("public-listings");
      api.clearCache("listing-detail");
    }
    return { data, error };
  };

  api.deleteListing = async function deleteListing(id) {
    const client = await requireClient();
    const { error } = await client.from("listings").delete().eq("id", id);
    if (!error) {
      api.clearCache("creator-listings");
      api.clearCache("public-listings");
    }
    return { error };
  };

  window.EtchApi = api;
})();
