import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SongIan from './pages/SongIan'
import PoopDodge from './pages/PoopDodge'
import MissileShoot from './pages/MissileShoot'
import BrickBreaker from './pages/BrickBreaker'
import Tetris from './pages/Tetris'
import Suika from './pages/Suika'
import StackTower from './pages/StackTower'
import CodeAdventure from './pages/CodeAdventure'
import WordPuzzle from './pages/WordPuzzle'
import MathSpell from './pages/MathSpell'
import MonsterDefense from './pages/MonsterDefense'
import Fortress from './pages/Fortress'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/song-ian" element={<SongIan />} />
        <Route path="/game/poop-dodge" element={<PoopDodge />} />
        <Route path="/game/missile-shoot" element={<MissileShoot />} />
        <Route path="/game/brick-breaker" element={<BrickBreaker />} />
        <Route path="/game/tetris" element={<Tetris />} />
        <Route path="/game/suika" element={<Suika />} />
        <Route path="/game/stack-tower" element={<StackTower />} />
        <Route path="/game/code-adventure" element={<CodeAdventure />} />
        <Route path="/game/word-puzzle" element={<WordPuzzle />} />
        <Route path="/game/math-spell" element={<MathSpell />} />
        <Route path="/game/monster-defense" element={<MonsterDefense />} />
        <Route path="/game/fortress" element={<Fortress />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
