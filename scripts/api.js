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

  api.getCreatorStorefront = async function getCreatorStorefront(ownerId) {
    return cached("creator-storefront", { ownerId }, async () => {
      const client = await requireClient();
      const [liveRows, featuredRows, allRows] = await Promise.all([
        client.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "live"),
        client.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "live").gte("views_count", 1),
        client
          .from("listings")
          .select("id,title,category,status,views_count,updated_at")
          .eq("owner_id", ownerId)
          .order("views_count", { ascending: false, nullsFirst: false })
          .limit(5),
      ]);

      return {
        stats: [
          { label: "Live assets", value: compactNumber(liveRows.count), detail: "Listings visible to buyers." },
          { label: "Buyer attention", value: compactNumber(featuredRows.count), detail: "Live listings with recorded views." },
        ],
        items: (allRows.data || []).map((item) => ({
          title: item.title,
          meta: `${item.category || "Listing"} • ${item.status || "draft"} • ${compactNumber(item.views_count)} views`,
        })),
      };
    });
  };

  api.getCreatorMessages = async function getCreatorMessages(userId) {
    return cached("creator-messages", { userId }, async () => {
      const client = await requireClient();
      const { data, error } = await client
        .from("inquiries")
        .select("id,subject,message,status,updated_at,listings(title)")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      const rows = data || [];
      return {
        stats: [
          { label: "Unread threads", value: compactNumber(rows.filter((row) => row.status === "new").length), detail: "New buyer conversations." },
          { label: "Active threads", value: compactNumber(rows.filter((row) => ["open", "negotiating"].includes(row.status)).length), detail: "Requests still in motion." },
        ],
        items: rows.map((row) => ({
          title: row.subject || row.listings?.title || "Buyer inquiry",
          meta: `${row.status || "new"} • ${(row.message || "").slice(0, 96)}`,
        })),
      };
    });
  };

  api.getCreatorLicensing = async function getCreatorLicensing(userId) {
    return cached("creator-licensing", { userId }, async () => {
      const client = await requireClient();
      const { data, error } = await client
        .from("inquiries")
        .select("id,subject,status,updated_at,listings!inner(title,owner_id)")
        .eq("listings.owner_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      const rows = data || [];
      return {
        stats: [
          { label: "Open requests", value: compactNumber(rows.filter((row) => ["new", "open", "negotiating"].includes(row.status)).length), detail: "Licensing contacts waiting for review." },
          { label: "Approved", value: compactNumber(rows.filter((row) => row.status === "accepted").length), detail: "Confirmed licensing conversations." },
        ],
        items: rows.map((row) => ({
          title: row.listings?.title || row.subject || "Licensing request",
          meta: `${row.status || "new"} • ${row.subject || "Buyer request"}`,
        })),
      };
    });
  };

  api.getCreatorEarnings = async function getCreatorEarnings(userId) {
    return cached("creator-earnings", { userId }, async () => {
      const client = await requireClient();
      const [orders, payouts] = await Promise.all([
        client.from("orders").select("id,creator_amount,status,created_at,listings(title)").eq("creator_id", userId).order("created_at", { ascending: false }).limit(20),
        client.from("payouts").select("id,amount,status,created_at").eq("creator_id", userId).order("created_at", { ascending: false }).limit(20),
      ]);
      if (orders.error) throw orders.error;
      if (payouts.error) throw payouts.error;

      const orderRows = orders.data || [];
      const payoutRows = payouts.data || [];
      const revenue = orderRows.reduce((sum, row) => sum + Number(row.creator_amount || 0), 0);
      const pending = payoutRows.filter((row) => ["pending", "processing"].includes(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0);

      return {
        stats: [
          { label: "Total revenue", value: money(revenue), detail: "Paid and released creator earnings." },
          { label: "Pending payout", value: money(pending), detail: "Payouts awaiting release or processing." },
        ],
        items: orderRows.map((row) => ({
          title: row.listings?.title || "License order",
          meta: `${money(row.creator_amount)} • ${row.status || "pending"}`,
        })),
      };
    });
  };

  api.getAdminWorkQueue = async function getAdminWorkQueue(type) {
    return cached("admin-work-queue", { type }, async () => {
      const client = await requireClient();

      if (type === "content") {
        const { data, error } = await client
          .from("listings")
          .select("id,title,category,status,updated_at")
          .in("status", ["review", "changes_requested"])
          .order("updated_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        const rows = data || [];
        return {
          stats: [
            { label: "Pending assets", value: compactNumber(rows.filter((row) => row.status === "review").length), detail: "Awaiting marketplace review." },
            { label: "Requires changes", value: compactNumber(rows.filter((row) => row.status === "changes_requested").length), detail: "Listings returned to creators." },
          ],
          items: rows.map((row) => ({ title: row.title, meta: `${row.category || "Listing"} • ${row.status}` })),
        };
      }

      if (type === "licensing") {
        const { data, error } = await client
          .from("inquiries")
          .select("id,subject,status,updated_at,listings(title)")
          .in("status", ["new", "open", "negotiating"])
          .order("updated_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        const rows = data || [];
        return {
          stats: [
            { label: "Open requests", value: compactNumber(rows.length), detail: "Licensing tasks waiting for action." },
            { label: "Negotiating", value: compactNumber(rows.filter((row) => row.status === "negotiating").length), detail: "Requests in active deal review." },
          ],
          items: rows.map((row) => ({ title: row.listings?.title || row.subject || "Licensing request", meta: `${row.status} • ${row.subject || "Buyer request"}` })),
        };
      }

      if (type === "payouts") {
        const { data, error } = await client
          .from("payouts")
          .select("id,amount,status,created_at")
          .in("status", ["pending", "processing"])
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        const rows = data || [];
        return {
          stats: [
            { label: "Pending payouts", value: compactNumber(rows.length), detail: "Payments waiting release." },
            { label: "Funds held", value: money(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)), detail: "Pending and processing payout value." },
          ],
          items: rows.map((row) => ({ title: `Payout ${String(row.id).slice(0, 8)}`, meta: `${money(row.amount)} • ${row.status}` })),
        };
      }

      if (type === "support") {
        const { data, error } = await client
          .from("support_tickets")
          .select("id,subject,priority,status,updated_at")
          .in("status", ["new", "open", "waiting"])
          .order("updated_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        const rows = data || [];
        return {
          stats: [
            { label: "Open tickets", value: compactNumber(rows.length), detail: "Requests waiting a response." },
            { label: "Urgent", value: compactNumber(rows.filter((row) => row.priority === "urgent" || row.priority === "high").length), detail: "High-priority support items." },
          ],
          items: rows.map((row) => ({ title: row.subject || "Support ticket", meta: `${row.priority || "normal"} priority • ${row.status}` })),
        };
      }

      const { data, error, count } = await client
        .from("profiles")
        .select("id,full_name,email,role,onboarding_complete,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = data || [];
      return {
        stats: [
          { label: "Active users", value: compactNumber(count || 0), detail: "Total marketplace participants." },
          { label: "Creators", value: compactNumber(rows.filter((row) => row.role === "creator").length), detail: "Recent creator accounts in this view." },
        ],
        items: rows.map((row) => ({ title: row.full_name || row.email, meta: `${row.role || "buyer"} • ${row.onboarding_complete ? "complete" : "pending"}` })),
      };
    });
  };

  api.getPublicListings = async function getPublicListings(options = {}) {
    return cached("public-listings", options, async () => {
      const client = await requireClient();
      const limit = options.limit || 24;
      const search = (options.search || "").trim();
      const category = (options.category || "").trim();
      const license = (options.license || "").trim();
      const industry = (options.industry || "").trim();
      const price = (options.price || "").trim();
      const sort = options.sort || "newest";

      let query = client
        .from("listings")
        .select("id,title,slug,category,description,price,currency,status,cover_url,rights_summary,views_count,updated_at,profiles:owner_id(full_name,studio_name,specialization,role)")
        .eq("status", "live")
        .limit(limit);

      if (category && category !== "all") query = query.eq("category", category);
      if (search) query = query.or(`title.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);
      if (license) query = query.ilike("rights_summary", `%${license}%`);
      if (industry) query = query.ilike("description", `%${industry}%`);
      if (price === "0-1000") query = query.lte("price", 1000);
      if (price === "1000-5000") query = query.gte("price", 1000).lte("price", 5000);
      if (price === "5000+") query = query.gte("price", 5000);

      if (sort === "price_asc") query = query.order("price", { ascending: true, nullsFirst: false });
      else if (sort === "price_desc") query = query.order("price", { ascending: false, nullsFirst: false });
      else if (sort === "popular") query = query.order("views_count", { ascending: false, nullsFirst: false });
      else query = query.order("updated_at", { ascending: false });

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
