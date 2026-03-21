# Vue watch vs computed — コーディング指針

## 原則: computed を優先、watch は最終手段

### computed を使うべき場面

- 値の導出・変換・フィルタリング
- 条件分岐による値の選択
- 複数の reactive 値を組み合わせた計算

```typescript
// ✅ computed
const filteredItems = computed(() => items.value.filter(i => i.visible))

// ❌ watch で同じことをやらない
watch(items, (newItems) => {
  filteredItems.value = newItems.filter(i => i.visible)
})
```

### watch を使ってよい場面

副作用が必要なときだけ:
- DOM 操作（scrollIntoView, focus 等）
- API 呼び出し（fetch）
- ブラウザ API（history.pushState, localStorage）
- 外部ライブラリの命令的呼び出し

### watch を使うときの flush 設定

**デフォルトの `flush: "pre"` は罠**。DOM を触る watch は必ず `flush: "post"` にする。

```
refの値を変更する
↓
watch: { flush: "sync" }     ← 即座に呼ばれる（ほぼ使わない）
↓
watch: { flush: "pre" }      ← デフォルト。DOM 更新前
↓
onBeforeUpdate
↓
watch: { flush: "post" }     ← DOM 更新後。scrollIntoView 等はここ
↓
onUpdated
```

参照: https://qiita.com/Hiroshiba/items/5492d8cd2a34c40328de

### 実例: scrollIntoView

```typescript
// ❌ flush: "pre" (デフォルト) — DOM が更新されていないので要素が見つからない
watch(filters, () => {
  const el = document.querySelector('[data-uuid="..."]')
  el?.scrollIntoView()  // el が null かもしれない！
})

// ✅ flush: "post" — DOM 更新後に実行
watch(filters, () => {
  const el = document.querySelector('[data-uuid="..."]')
  el?.scrollIntoView({ behavior: 'instant', block: 'start' })
}, { flush: 'post' })

// ✅ nextTick を使う方法もある（flush: "pre" のまま）
watch(filters, () => {
  nextTick(() => {
    const el = document.querySelector('[data-uuid="..."]')
    el?.scrollIntoView()
  })
})
```

## ccconv web での適用

| 箇所 | 方式 | 理由 |
|---|---|---|
| filteredConversations | computed | 値の導出 |
| displayItems | computed | 値の導出 |
| SubagentTree の expanded | computed | props からの導出 |
| MessageBubble の isEmpty | computed | 値の判定 |
| ConversationView のフィルタ変更→scrollIntoView | watch + nextTick | DOM 副作用 |
| ProjectTree の選択プロジェクト自動展開 | watch | Set への副作用 |

## 参照

- Vue 公式: https://ja.vuejs.org/guide/essentials/watchers.html
- flush タイミング: https://qiita.com/Hiroshiba/items/5492d8cd2a34c40328de
