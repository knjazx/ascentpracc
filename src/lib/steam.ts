/**
 * Steam User Profile Resolver
 * Retrieves real player persona name and high-resolution avatar.
 * Supports both Valve Steam Web API and the direct Steam Community XML feed fallback (no API key required).
 */

export interface SteamProfile {
  nickname: string;
  avatarUrl: string;
}

export async function fetchSteamUserProfile(
  steamId: string,
  apiKey?: string
): Promise<SteamProfile> {
  let nickname = `Player_${steamId.slice(-6)}`;
  let avatarUrl = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';

  // 1. Try official Steam Web API if a valid key is provided
  if (apiKey && apiKey !== 'DUMMY_STEAM_API_KEY_CHANGE_ME' && apiKey !== 'YOUR_STEAM_API_KEY_HERE') {
    try {
      const apiUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`;
      const res = await fetch(apiUrl, { next: { revalidate: 0 } });
      if (res.ok) {
        const data = await res.json();
        const player = data?.response?.players?.[0];
        if (player) {
          if (player.personaname) nickname = player.personaname;
          if (player.avatarfull) avatarUrl = player.avatarfull;
          return { nickname, avatarUrl };
        }
      }
    } catch (err) {
      console.warn('[Steam API] Web API request failed, falling back to community feed:', err);
    }
  }

  // 2. Direct Steam Community XML Feed Fallback (reliable, no API key required)
  try {
    const communityXmlUrl = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
    const res = await fetch(communityXmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/xml, application/xml, text/plain',
      },
      next: { revalidate: 0 },
    });

    if (res.ok) {
      const xml = await res.text();
      const nickMatch =
        xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/i) ||
        xml.match(/<steamID>(.*?)<\/steamID>/i);
      const avatarMatch =
        xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/i) ||
        xml.match(/<avatarFull>(.*?)<\/avatarFull>/i);

      if (nickMatch && nickMatch[1]?.trim()) {
        nickname = nickMatch[1].trim();
      }
      if (avatarMatch && avatarMatch[1]?.trim()) {
        avatarUrl = avatarMatch[1].trim();
      }
    }
  } catch (err) {
    console.warn('[Steam Community] XML fallback fetch error:', err);
  }

  return { nickname, avatarUrl };
}
