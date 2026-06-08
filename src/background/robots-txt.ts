interface RobotsRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
  crawlDelay: number | null;
}

let cachedRules: Map<string, RobotsRule[]> = new Map();

export async function fetchRobotsTxt(origin: string): Promise<RobotsRule[]> {
  if (cachedRules.has(origin)) {
    return cachedRules.get(origin)!;
  }

  try {
    const response = await fetch(`${origin}/robots.txt`, {
      credentials: 'omit',
    });
    if (!response.ok) {
      cachedRules.set(origin, []);
      return [];
    }

    const text = await response.text();
    const rules = parseRobotsTxt(text);
    cachedRules.set(origin, rules);
    return rules;
  } catch {
    cachedRules.set(origin, []);
    return [];
  }
}

export function isUrlAllowed(url: string, rules: RobotsRule[]): boolean {
  const pathname = new URL(url).pathname;

  // Find rules for our user-agent (treat as generic bot)
  const applicableRules = rules.filter(
    (r) => r.userAgent === '*' || r.userAgent.toLowerCase() === 'saveit'
  );

  if (applicableRules.length === 0) return true;

  for (const rule of applicableRules) {
    // Check allow first (more specific wins)
    const allowed = rule.allow.some((pattern) => matchesPath(pathname, pattern));
    if (allowed) return true;

    const disallowed = rule.disallow.some((pattern) =>
      matchesPath(pathname, pattern)
    );
    if (disallowed) return false;
  }

  return true;
}

export function getCrawlDelay(rules: RobotsRule[]): number | null {
  for (const rule of rules) {
    if (rule.userAgent === '*' || rule.userAgent.toLowerCase() === 'saveit') {
      if (rule.crawlDelay !== null) return rule.crawlDelay;
    }
  }
  return null;
}

function parseRobotsTxt(text: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let current: RobotsRule | null = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (key === 'user-agent') {
      current = { userAgent: value, disallow: [], allow: [], crawlDelay: null };
      rules.push(current);
    } else if (current) {
      switch (key) {
        case 'disallow':
          if (value) current.disallow.push(value);
          break;
        case 'allow':
          if (value) current.allow.push(value);
          break;
        case 'crawl-delay':
          const delay = parseFloat(value);
          if (!isNaN(delay)) current.crawlDelay = delay;
          break;
      }
    }
  }

  return rules;
}

function matchesPath(pathname: string, pattern: string): boolean {
  if (!pattern) return false;

  // Simple prefix matching with * wildcard support
  if (pattern.endsWith('*')) {
    return pathname.startsWith(pattern.slice(0, -1));
  }
  if (pattern.endsWith('$')) {
    return pathname === pattern.slice(0, -1);
  }

  // Prefix match
  return pathname.startsWith(pattern);
}
