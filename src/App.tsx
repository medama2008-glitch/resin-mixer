import { useEffect, useState } from 'react'
import { useRecipes } from './useRecipes'
import { RecipeList } from './components/RecipeList'
import { RecipeView } from './components/RecipeView'
import { ImportView } from './components/ImportView'
import { loadTheme, saveTheme, type ThemePref } from './lib/storage'

type Route = { view: 'list' } | { view: 'recipe'; id: string } | { view: 'import' }

function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '')
  const m = h.match(/^\/r\/(.+)$/)
  if (m) return { view: 'recipe', id: decodeURIComponent(m[1]) }
  if (h === '/import') return { view: 'import' }
  return { view: 'list' }
}

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function applyTheme(t: ThemePref) {
  const root = document.documentElement
  if (t === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
}

const THEME_ICON: Record<ThemePref, string> = { auto: '◐', light: '☀', dark: '☾' }
const THEME_NEXT: Record<ThemePref, ThemePref> = { auto: 'dark', dark: 'light', light: 'auto' }

export default function App() {
  const route = useHashRoute()
  const { entries, local, remoteState, refresh, importRecipes, removeLocal } = useRecipes()
  const [theme, setTheme] = useState<ThemePref>(() => loadTheme())

  useEffect(() => applyTheme(theme), [theme])

  const cycleTheme = () => {
    const next = THEME_NEXT[theme]
    setTheme(next)
    saveTheme(next)
  }

  let body: React.ReactNode
  let title = 'ResinMixer'
  if (route.view === 'recipe') {
    const entry = entries.find((e) => e.recipe.id === route.id)
    title = route.id
    body = entry ? (
      <RecipeView key={entry.recipe.id + entry.origin} recipe={entry.recipe} isLocal={entry.origin === 'local'} />
    ) : (
      <div className="page">
        <p className="empty">
          レシピ "{route.id}" が見つかりません。
          {remoteState.kind === 'loading' && ' 読み込み中…'}
        </p>
      </div>
    )
  } else if (route.view === 'import') {
    title = 'インポート'
    body = <ImportView local={local} onImport={importRecipes} onRemove={removeLocal} />
  } else {
    body = <RecipeList entries={entries} remoteState={remoteState} onRefresh={refresh} />
  }

  return (
    <>
      <header className="appbar">
        {route.view !== 'list' ? (
          <a className="appbar-btn" href="#/" aria-label="一覧へ戻る">
            ‹
          </a>
        ) : (
          <span className="appbar-btn appbar-logo" aria-hidden="true">
            ⬢
          </span>
        )}
        <h1 className="appbar-title">{title}</h1>
        <a className={`appbar-btn ${route.view === 'import' ? 'active' : ''}`} href="#/import" aria-label="インポート">
          ⇩
        </a>
        <button type="button" className="appbar-btn" onClick={cycleTheme} aria-label={`テーマ: ${theme}`}>
          {THEME_ICON[theme]}
        </button>
      </header>
      <main>{body}</main>
    </>
  )
}
