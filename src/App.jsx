import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import GameSession from './components/GameSession'
import { games } from './data/games'
import './App.css'

const gamePages = {
  'conquest': lazy(() => import('./pages/Conquest')),
  'song-ian': lazy(() => import('./pages/SongIan')),
  'poop-dodge': lazy(() => import('./pages/PoopDodge')),
  'missile-shoot': lazy(() => import('./pages/MissileShoot')),
  'brick-breaker': lazy(() => import('./pages/BrickBreaker')),
  'tetris': lazy(() => import('./pages/Tetris')),
  'suika': lazy(() => import('./pages/Suika')),
  'stack-tower': lazy(() => import('./pages/StackTower')),
  'code-adventure': lazy(() => import('./pages/CodeAdventure')),
  'word-puzzle': lazy(() => import('./pages/WordPuzzle')),
  'math-spell': lazy(() => import('./pages/MathSpell')),
  'monster-defense': lazy(() => import('./pages/MonsterDefense')),
  'fortress': lazy(() => import('./pages/Fortress')),
  'help-me': lazy(() => import('./pages/HelpMe')),
  'star-rescue': lazy(() => import('./pages/StarRescue')),
  'fruit-slash': lazy(() => import('./pages/FruitSlash')),
  'tower-defense': lazy(() => import('./pages/TowerDefense')),
  'magic-hanja': lazy(() => import('./pages/MagicHanja')),
  'lava-castle': lazy(() => import('./pages/LavaCastle')),
  'swimming-race': lazy(() => import('./pages/SwimmingRace')),
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {games.map((game) => {
          const Game = gamePages[game.id]
          return <Route key={game.id} path={`/game/${game.id}`} element={
            <GameSession key={game.id} game={game}>
              <Suspense fallback={<div className="game-loading" role="status"><span aria-hidden="true">🕹️</span>게임을 준비하고 있어요…</div>}>
                <Game />
              </Suspense>
            </GameSession>
          } />
        })}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
