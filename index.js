export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers });

    try {
      const url = new URL(request.url);
      const username = url.searchParams.get("username");
      if (!username)
        return new Response(
          JSON.stringify({ status: "error", message: "Missing username" }),
          { headers, status: 400 }
        );

      const cleanUsername = username.replace("@", "");
      const tiktokUrl = `https://www.tiktok.com/@${cleanUsername}`;

      const res = await fetch(tiktokUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
          "Referer": "https://www.tiktok.com/",
          "Accept": "text/html"
        }
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({
            status: "error",
            message: "Failed to fetch TikTok page",
            code: res.status
          }),
          { headers, status: res.status }
        );
      }

      const html = await res.text();

      // 🧩 Regex cập nhật để tìm JSON mới nhất
      let jsonData = null;

      // Cấu trúc mới của TikTok: __UNIVERSAL_DATA_FOR_REHYDRATION__
      const universalMatch = html.match(
        /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/
      );
      if (universalMatch) {
        try {
          const parsed = JSON.parse(universalMatch[1]);
          jsonData =
            parsed?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"]?.userInfo;
        } catch {}
      }

      // Nếu chưa tìm thấy, thử với cấu trúc cũ SIGI_STATE
      if (!jsonData) {
        const sigiMatch = html.match(
          /<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/
        );
        if (sigiMatch) {
          const parsed = JSON.parse(sigiMatch[1]);
          const userObj = Object.values(parsed?.UserModule?.users || {})[0];
          const statsObj = Object.values(parsed?.UserModule?.stats || {})[0];
          jsonData = { user: userObj, stats: statsObj };
        }
      }

      if (!jsonData || !jsonData.user) {
        return new Response(
          JSON.stringify({
            status: "error",
            message: "Could not extract TikTok user data (page structure changed)"
          }),
          { headers, status: 500 }
        );
      }

      const result = {
        status: "success",
        user: {
          avatar: jsonData.user.avatarLarger,
          nickname: jsonData.user.nickname,
          followers:
            jsonData.stats?.followerCount ||
            jsonData.user.stats?.followerCount ||
            0
        }
      };

      return new Response(JSON.stringify(result), { headers, status: 200 });
    } catch (err) {
      return new Response(
        JSON.stringify({ status: "error", message: err.message }),
        { headers, status: 500 }
      );
    }
  }
};
