import { render } from 'solid-js/web';
import { createSignal, Show, For, createEffect } from 'solid-js';
import type { SaveItMessage } from '@/shared/messages';
import type { NavNode } from '@/shared/types';

const api = (typeof browser !== 'undefined' ? browser : chrome) as typeof browser;

type Mode = 'page' | 'site';
type Status = 'idle' | 'discovering' | 'previewing' | 'capturing' | 'crawling' | 'done' | 'error';

function App() {
  const [mode, setMode] = createSignal<Mode>('page');
  const [status, setStatus] = createSignal<Status>('idle');
  const [message, setMessage] = createSignal('');
  const [navTree, setNavTree] = createSignal<NavNode[]>([]);
  const [progress, setProgress] = createSignal({ completed: 0, total: 0, currentUrl: '' });

  api.runtime.onMessage.addListener((msg: SaveItMessage) => {
    switch (msg.type) {
      case 'bg.status':
        setStatus('capturing');
        setMessage('正在捕获页面...');
        break;
      case 'bg.saveComplete':
        setStatus('done');
        setMessage(`已保存: ${msg.filename}`);
        break;
      case 'bg.error':
        setStatus('error');
        setMessage(`错误: ${msg.error}`);
        break;
      case 'bg.progress':
        setProgress({ completed: msg.completed, total: msg.total, currentUrl: msg.currentUrl });
        break;
    }
  });

  async function handleSavePage() {
    setStatus('capturing');
    setMessage('正在捕获页面...');
    try {
      await api.runtime.sendMessage({ type: 'popup.savePage' });
    } catch (err) {
      setStatus('error');
      setMessage(`错误: ${err}`);
    }
  }

  async function handleDiscover() {
    setStatus('discovering');
    setMessage('正在发现页面结构...');
    try {
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) throw new Error('No active tab');

      const response = await api.tabs.sendMessage(tab.id, {
        type: 'content.discoverNav',
      });

      if (!response?.success) {
        throw new Error(response?.error || '发现失败');
      }

      const { nodes } = response.data as { nodes: NavNode[]; source: string };
      if (nodes.length === 0) {
        setStatus('error');
        setMessage('未找到导航结构');
        return;
      }

      setNavTree(nodes);
      setStatus('previewing');
      setMessage(`发现 ${countNodes(nodes)} 个页面`);
    } catch (err) {
      setStatus('error');
      setMessage(`发现失败: ${err}`);
    }
  }

  async function handleSaveSite() {
    const selected = getSelectedUrls(navTree());
    if (selected.length === 0) {
      setMessage('请至少选择一个页面');
      return;
    }

    setStatus('crawling');
    setMessage(`正在保存 ${selected.length} 个页面...`);
    try {
      await api.runtime.sendMessage({
        type: 'popup.startCrawl',
        selectedUrls: selected,
      });
    } catch (err) {
      setStatus('error');
      setMessage(`保存失败: ${err}`);
    }
  }

  function toggleNode(node: NavNode) {
    node.selected = !node.selected;
    // Toggle children too
    toggleChildren(node, node.selected);
    setNavTree([...navTree()]);
  }

  return (
    <div>
      <header style={{ "margin-bottom": "12px" }}>
        <h1 style={{ "font-size": "18px", "font-weight": "600" }}>SaveIt</h1>
      </header>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: "4px", "margin-bottom": "12px" }}>
        <TabButton
          active={mode() === 'page'}
          onClick={() => { setMode('page'); setStatus('idle'); setMessage(''); }}
          label="保存页面"
        />
        <TabButton
          active={mode() === 'site'}
          onClick={() => { setMode('site'); setStatus('idle'); setMessage(''); }}
          label="保存站点"
        />
      </div>

      {/* Page mode */}
      <Show when={mode() === 'page'}>
        <button
          onClick={handleSavePage}
          disabled={status() === 'capturing'}
          style={btnStyle(status() === 'capturing')}
        >
          {status() === 'capturing' ? '保存中...' : '保存当前页面'}
        </button>
      </Show>

      {/* Site mode */}
      <Show when={mode() === 'site'}>
        <Show when={status() === 'idle' || status() === 'error'}>
          <button onClick={handleDiscover} style={btnStyle(false)}>
            发现页面结构
          </button>
        </Show>

        <Show when={status() === 'discovering'}>
          <div style={{ padding: "12px", "text-align": "center", color: "#666" }}>
            正在分析页面导航...
          </div>
        </Show>

        <Show when={status() === 'previewing'}>
          <div style={{ "max-height": "300px", overflow: "auto", border: "1px solid #e2e8f0", "border-radius": "6px", padding: "8px", "margin-bottom": "8px" }}>
            <NavTreeView nodes={navTree()} onToggle={toggleNode} />
          </div>
          <button onClick={handleSaveSite} style={btnStyle(false)}>
            保存选中页面 ({getSelectedUrls(navTree()).length})
          </button>
        </Show>

        <Show when={status() === 'crawling'}>
          <ProgressBar
            completed={progress().completed}
            total={progress().total}
            currentUrl={progress().currentUrl}
          />
        </Show>
      </Show>

      {/* Status message */}
      <Show when={message()}>
        <div
          style={{
            "margin-top": "8px",
            padding: "8px 12px",
            "border-radius": "4px",
            "font-size": "12px",
            background: status() === 'error' ? '#fef2f2' : status() === 'done' ? '#f0fdf4' : '#f0f9ff',
            color: status() === 'error' ? '#dc2626' : status() === 'done' ? '#16a34a' : '#2563eb',
          }}
        >
          {message()}
        </div>
      </Show>
    </div>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        flex: "1",
        padding: "6px 12px",
        "border-radius": "4px",
        border: "1px solid " + (props.active ? '#2563eb' : '#e2e8f0'),
        background: props.active ? '#eff6ff' : '#fff',
        color: props.active ? '#2563eb' : '#666',
        "font-size": "13px",
        "font-weight": props.active ? "600" : "400",
        cursor: "pointer",
      }}
    >
      {props.label}
    </button>
  );
}

function NavTreeView(props: { nodes: NavNode[]; onToggle: (node: NavNode) => void }) {
  return (
    <ul style={{ "list-style": "none", padding: "0", margin: "0", "font-size": "12px" }}>
      <For each={props.nodes}>
        {(node) => (
          <li style={{ "padding-left": `${node.depth * 16}px` }}>
            <label style={{ display: "flex", "align-items": "center", gap: "4px", padding: "2px 0", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={node.selected}
                onChange={() => props.onToggle(node)}
              />
              <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                {node.title || node.url}
              </span>
            </label>
            <Show when={node.children.length > 0}>
              <NavTreeView nodes={node.children} onToggle={props.onToggle} />
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

function ProgressBar(props: { completed: number; total: number; currentUrl: string }) {
  const pct = () => props.total > 0 ? Math.round((props.completed / props.total) * 100) : 0;
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", "justify-content": "space-between", "font-size": "12px", color: "#666", "margin-bottom": "4px" }}>
        <span>{props.completed} / {props.total}</span>
        <span>{pct()}%</span>
      </div>
      <div style={{ height: "4px", background: "#e2e8f0", "border-radius": "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#2563eb", width: `${pct()}%`, transition: "width 0.3s" }} />
      </div>
      <div style={{ "font-size": "11px", color: "#999", "margin-top": "4px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
        {props.currentUrl}
      </div>
    </div>
  );
}

function btnStyle(disabled: boolean) {
  return {
    width: "100%",
    padding: "10px 16px",
    "border-radius": "6px",
    border: "none",
    background: disabled ? '#94a3b8' : '#2563eb',
    color: "#fff",
    "font-size": "14px",
    "font-weight": "500",
    cursor: disabled ? 'wait' : 'pointer',
  };
}

function countNodes(nodes: NavNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.url) count++;
    count += countNodes(node.children);
  }
  return count;
}

function getSelectedUrls(nodes: NavNode[]): string[] {
  const urls: string[] = [];
  for (const node of nodes) {
    if (node.selected && node.url) urls.push(node.url);
    urls.push(...getSelectedUrls(node.children));
  }
  return urls;
}

function toggleChildren(node: NavNode, selected: boolean) {
  for (const child of node.children) {
    child.selected = selected;
    toggleChildren(child, selected);
  }
}

render(() => <App />, document.getElementById('app')!);
