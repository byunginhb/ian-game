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
      </Routes>
    </BrowserRouter>
  )
}

export default App
