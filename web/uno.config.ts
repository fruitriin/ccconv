import { defineConfig, presetUno, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons(),
  ],
  theme: {
    colors: {
      bg: '#1a1a2e',
      surface: '#16213e',
      surface2: '#0f3460',
      text: '#e0e0e0',
      'text-dim': '#888',
      accent: '#e94560',
      'user-bg': '#1a3a5c',
      'assistant-bg': '#2a2a3e',
      'subagent-border': '#e94560',
    }
  },
  shortcuts: {
    'btn': 'px-3 py-1 rounded cursor-pointer transition-colors',
    'sidebar-item': 'px-3 py-2 cursor-pointer rounded transition-colors hover:bg-surface2',
    'sidebar-item-active': 'bg-surface2 text-accent',
    'badge': 'text-xs px-1.5 py-0.5 rounded-full',
  }
})
