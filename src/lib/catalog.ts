export type Category = 'system' | 'dev' | 'background-app' | 'browser' | 'editor' | 'other';

export interface Classification {
  category: Category;
  /** True when this is generally safe to close to reclaim RAM. */
  safeToClose: boolean;
  /** Human-friendly note explaining what it is / whether to close it. */
  advice: string | null;
}

interface Rule {
  patterns: string[];
  category: Category;
  safeToClose: boolean;
  advice: string;
}

/**
 * Ordered rules — the first rule with a pattern that is a substring of the
 * (lower-cased) process name wins. More specific rules must come first
 * (e.g. "msedgewebview2" before the "msedge" browser rule).
 */
const RULES: Rule[] = [
  // --- Local LLMs / heavy dev daemons (big RAM wins) ---
  { patterns: ['llama-server', 'llama_cpp', 'llamacpp', 'ollama', 'lm-studio', 'lmstudio', 'koboldcpp'], category: 'dev', safeToClose: true, advice: 'Local LLM server — close to reclaim a large amount of RAM when you are not prompting it.' },
  { patterns: ['dockerd', 'com.docker', 'docker desktop', 'docker'], category: 'dev', safeToClose: true, advice: 'Docker — close if you are not running containers right now.' },
  { patterns: ['mysqld', 'postgres', 'mongod', 'redis-server', 'redis'], category: 'dev', safeToClose: true, advice: 'Local database server — close if no project needs it at the moment.' },

  // --- Dev servers / toolchains ---
  { patterns: ['node'], category: 'dev', safeToClose: true, advice: 'Node process (dev server, watcher, or tool) — close if you are not actively running it.' },
  { patterns: ['esbuild', 'vite', 'webpack', 'rollup', 'next-server', 'nodemon', 'ts-node'], category: 'dev', safeToClose: true, advice: 'Dev build/watch process — close when you are not developing.' },
  { patterns: ['gradle', 'kotlin-daemon'], category: 'dev', safeToClose: true, advice: 'Gradle/Kotlin daemon — safe to close when you are not building.' },
  { patterns: ['python', 'python3', 'pythonw'], category: 'dev', safeToClose: true, advice: 'Python process — close if no script or notebook needs it.' },
  { patterns: ['java', 'javaw', 'openjdk'], category: 'dev', safeToClose: true, advice: 'Java process — close if the app using it is not needed.' },
  { patterns: ['php'], category: 'dev', safeToClose: true, advice: 'PHP process — close if no local site needs it.' },
  { patterns: ['tsserver', 'typescript'], category: 'dev', safeToClose: false, advice: 'TypeScript language server — part of your editor; it stops when you close the editor.' },

  // --- Editors / IDEs ---
  { patterns: ['msedgewebview2'], category: 'background-app', safeToClose: true, advice: 'Edge WebView runtime — used by widgets and some apps; safe to close if you do not need those.' },
  { patterns: ['code - insiders', 'code'], category: 'editor', safeToClose: false, advice: 'Code editor — each window and extension host adds up; close windows/workspaces you are not using.' },
  { patterns: ['devenv'], category: 'editor', safeToClose: false, advice: 'Visual Studio — close solutions you are not working on.' },
  { patterns: ['idea', 'pycharm', 'webstorm', 'phpstorm', 'rider', 'goland', 'clion'], category: 'editor', safeToClose: false, advice: 'JetBrains IDE — close projects you are not working on.' },
  { patterns: ['sublime_text', 'sublime'], category: 'editor', safeToClose: false, advice: 'Editor.' },

  // --- Messaging / chat (safe to close) ---
  { patterns: ['discord'], category: 'background-app', safeToClose: true, advice: 'Discord — safe to close when you are not in a call or chat.' },
  { patterns: ['slack'], category: 'background-app', safeToClose: true, advice: 'Slack — safe to close when you do not need notifications.' },
  { patterns: ['whatsapp'], category: 'background-app', safeToClose: true, advice: 'WhatsApp — safe to close; use the web version when you need it.' },
  { patterns: ['telegram'], category: 'background-app', safeToClose: true, advice: 'Telegram — safe to close.' },
  { patterns: ['signal'], category: 'background-app', safeToClose: true, advice: 'Signal — safe to close.' },
  { patterns: ['ms-teams', 'teams'], category: 'background-app', safeToClose: true, advice: 'Teams — safe to close when you are not in a meeting.' },
  { patterns: ['zoom'], category: 'background-app', safeToClose: true, advice: 'Zoom — safe to close when you are not in a meeting.' },
  { patterns: ['skype'], category: 'background-app', safeToClose: true, advice: 'Skype — safe to close when you are not calling.' },

  // --- Media ---
  { patterns: ['spotify'], category: 'background-app', safeToClose: true, advice: 'Spotify — safe to close to reclaim RAM when you are not listening.' },
  { patterns: ['vlc', 'itunes', 'applemusic'], category: 'background-app', safeToClose: true, advice: 'Media player — safe to close when not in use.' },

  // --- Game launchers ---
  { patterns: ['steamwebhelper', 'steam'], category: 'background-app', safeToClose: true, advice: 'Steam — safe to close when you are not gaming.' },
  { patterns: ['epicgameslauncher', 'epicgames'], category: 'background-app', safeToClose: true, advice: 'Epic Games launcher — safe to close when you are not gaming.' },
  { patterns: ['battle.net', 'blizzard'], category: 'background-app', safeToClose: true, advice: 'Battle.net — safe to close when you are not gaming.' },
  { patterns: ['riotclient', 'leagueclient'], category: 'background-app', safeToClose: true, advice: 'Riot client — safe to close when you are not playing.' },
  { patterns: ['eabackground', 'ealauncher'], category: 'background-app', safeToClose: true, advice: 'EA launcher — safe to close when you are not gaming.' },

  // --- Cloud sync ---
  { patterns: ['onedrive'], category: 'background-app', safeToClose: true, advice: 'OneDrive — safe to pause/close temporarily; it re-syncs when reopened.' },
  { patterns: ['dropbox'], category: 'background-app', safeToClose: true, advice: 'Dropbox — safe to close temporarily.' },
  { patterns: ['googledrivefs', 'googledrive'], category: 'background-app', safeToClose: true, advice: 'Google Drive — safe to close temporarily.' },

  // --- Peripheral / vendor bloat ---
  { patterns: ['razer', 'synapse'], category: 'background-app', safeToClose: true, advice: 'Razer software — usually safe to close (your mouse/keyboard keep working).' },
  { patterns: ['icue', 'corsair'], category: 'background-app', safeToClose: true, advice: 'Corsair iCUE — usually safe to close.' },
  { patterns: ['logitech', 'logioptions', 'lghub'], category: 'background-app', safeToClose: true, advice: 'Logitech software — usually safe to close.' },
  { patterns: ['armoury', 'armourycrate', 'asus'], category: 'background-app', safeToClose: true, advice: 'ASUS Armoury Crate — usually safe to close.' },
  { patterns: ['nvcontainer', 'nvidia web helper', 'nvidia share'], category: 'background-app', safeToClose: true, advice: 'NVIDIA helper — safe to close (the display driver keeps running).' },

  // --- Adobe background ---
  { patterns: ['creativecloud', 'ccxprocess', 'adobeipcbroker', 'acrotray', 'adobe'], category: 'background-app', safeToClose: true, advice: 'Adobe background service — safe to close when you are not using Adobe apps.' },

  // --- Windows extras ---
  { patterns: ['gamebar', 'gamebarft', 'xbox'], category: 'background-app', safeToClose: true, advice: 'Xbox / Game Bar — safe to close.' },
  { patterns: ['widgets', 'widgetservice'], category: 'background-app', safeToClose: true, advice: 'Windows Widgets — safe to close.' },
  { patterns: ['phoneexperiencehost', 'yourphone', 'phonelink'], category: 'background-app', safeToClose: true, advice: 'Phone Link — safe to close if you do not use it.' },

  // --- Browsers (heavy, but usually intentional) ---
  { patterns: ['chrome', 'chromium'], category: 'browser', safeToClose: false, advice: 'Browser — heavy on RAM; close unused tabs/windows to free memory.' },
  { patterns: ['msedge'], category: 'browser', safeToClose: false, advice: 'Microsoft Edge — close unused tabs/windows to free memory.' },
  { patterns: ['firefox'], category: 'browser', safeToClose: false, advice: 'Firefox — close unused tabs/windows to free memory.' },
  { patterns: ['brave'], category: 'browser', safeToClose: false, advice: 'Brave — close unused tabs/windows to free memory.' },
  { patterns: ['opera'], category: 'browser', safeToClose: false, advice: 'Opera — close unused tabs/windows to free memory.' },
  { patterns: ['vivaldi'], category: 'browser', safeToClose: false, advice: 'Vivaldi — close unused tabs/windows to free memory.' },
  { patterns: ['safari'], category: 'browser', safeToClose: false, advice: 'Safari — close unused tabs/windows to free memory.' },
  { patterns: ['arc'], category: 'browser', safeToClose: false, advice: 'Arc — close unused tabs/windows to free memory.' },
];

export function classify(name: string, isSystemProtected: boolean): Classification {
  if (isSystemProtected) {
    return { category: 'system', safeToClose: false, advice: 'Windows/OS system process — do not stop it.' };
  }
  const lower = name.trim().toLowerCase();
  for (const rule of RULES) {
    if (rule.patterns.some((p) => lower.includes(p))) {
      return { category: rule.category, safeToClose: rule.safeToClose, advice: rule.advice };
    }
  }
  return { category: 'other', safeToClose: false, advice: null };
}
