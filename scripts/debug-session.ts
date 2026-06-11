/**
 * Connect to Firefox remote debugging and collect SaveIt logs.
 * Usage: npx tsx scripts/debug-session.ts [--port 6000]
 *
 * Prerequisites:
 *   1. Close all Firefox windows
 *   2. Start Firefox: firefox.exe --start-debugger-server 6000
 *   3. In Firefox: about:debugging → load SaveIt extension
 *   4. Run this script
 *   5. Use SaveIt to discover + save a site
 *   6. Ctrl+C to stop and print collected logs
 */

const PORT = parseInt(process.argv[process.argv.indexOf('--port') + 1]) || 6000;

interface LogEntry {
  time: string;
  type: 'browser' | 'page' | 'worker' | 'content' | 'extension';
  source: string;
  text: string;
  level: string;
}

const logs: LogEntry[] = [];

async function main() {
  // Connect to Firefox
  const tabsRes = await fetch(`http://localhost:${PORT}/json/list`);
  const tabs = await tabsRes.json() as any[];

  console.log(`Connected to Firefox. Found ${tabs.length} targets.\n`);

  // Listen on all relevant targets
  for (const tab of tabs) {
    if (!tab.webSocketDebuggerUrl) continue;

    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    ws.onopen = () => {
      // Enable Runtime to capture console messages
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.addBinding',
        params: { name: '__saveit_log' },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        // Capture console.log calls
        if (msg.method === 'Runtime.consoleAPICalled') {
          const args = msg.params.args || [];
          const text = args.map((a: any) => a.value ?? a.description ?? '').join(' ');
          if (text.includes('[SaveIt]')) {
            logs.push({
              time: new Date().toISOString().slice(11, 23),
              type: tab.type || 'page',
              source: tab.url?.substring(0, 60) || tab.title || '',
              text,
              level: 'log',
            });
            console.log(`[${tab.type || 'target'}] ${text}`);
          }
        }

        // Capture Runtime.exceptionThrown
        if (msg.method === 'Runtime.exceptionThrown') {
          const exc = msg.params.exceptionDetails;
          const text = `${exc.text || exc.exception?.description || 'unknown error'}`;
          logs.push({
            time: new Date().toISOString().slice(11, 23),
            type: tab.type || 'page',
            source: tab.url?.substring(0, 60) || tab.title || '',
            text: `ERROR: ${text}`,
            level: 'error',
          });
          console.log(`[${tab.type || 'target'}] ERROR: ${text}`);
        }
      } catch {}
    };
  }

  console.log('Listening for [SaveIt] logs...');
  console.log('Use SaveIt to discover + save a site, then press Ctrl+C\n');
}

process.on('SIGINT', () => {
  console.log(`\n=== Collected ${logs.length} SaveIt log entries ===\n`);
  for (const l of logs) {
    console.log(`[${l.time}] [${l.type}] ${l.text}`);
  }
  process.exit(0);
});

main().catch((err) => {
  console.error('Failed to connect:', err.message);
  console.error('Make sure Firefox is running with: firefox.exe --start-debugger-server 6000');
  process.exit(1);
});
