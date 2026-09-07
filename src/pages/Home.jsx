import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { games } from '../data/games'
import ianImg from '../assets/ian.png'
import './Home.css'

const categories = [
  { id: 'all', label: '모든 게임', icon: '✦' },
  { id: 'action', label: '신나는 액션', icon: '⚡' },
  { id: 'puzzle', label: '생각하는 퍼즐', icon: '🧩' },
  { id: 'edu', label: '놀면서 배우기', icon: '✏️' },
]

export default function Home() {
  const [category, setCategory] = useState('all')
  const [recent] = useState(() => {
    try { return games.find((game) => game.id === localStorage.getItem('ian-last-game')) } catch { return null }
  })
  const visibleGames = games.filter((game) => category === 'all' || game.tags.includes(category))
  useEffect(() => { document.title = 'IAN Games · 이안의 게임 놀이터' }, [])

  return (
    <main className="home-container">
      <header className="home-nav">
        <a href="#games" className="home-brand" aria-label="IAN Games 게임 목록"><span aria-hidden="true">✳</span> IAN<span>GAMES</span></a>
        <span className="home-made">작은 상상, 커다란 재미 <span aria-hidden="true">↗</span></span>
      </header>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <span className="home-eyebrow"><span /> 이안의 게임 놀이터</span>
          <h1 id="home-title">우리의 상상이<br /><em>게임이 되는 곳.</em></h1>
          <p>이안과 함께 생각하고 만든 {games.length}가지 게임.<br />오늘은 어떤 모험을 해볼까요?</p>
          <a className="home-start" href="#games">게임 골라보기 <span aria-hidden="true">↘</span></a>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          <span className="home-doodle home-doodle-star">✦</span><span className="home-doodle home-doodle-planet">🪐</span><span className="home-doodle home-doodle-block">🧩</span>
          <div className="home-avatar-frame"><img src={ianImg} alt="" fetchPriority="high" /><span>CREATED WITH IAN</span></div>
          <span className="home-art-note">내가 만든 게임, 같이 놀자!</span>
        </div>
      </section>
      <div className="home-play-note"><span>⌨ 키보드·마우스로 편하게</span><span>☝ 터치로 어디서나</span><span>♡ 함께 만들어 더 특별하게</span></div>
      {recent && <Link className="home-recent" to={`/game/${recent.id}`}><span>{recent.emoji} 지난번에 놀았던 게임 <strong>{recent.title}</strong></span><span>다시 놀기 →</span></Link>}
      <section className="home-library" id="games" aria-labelledby="library-title">
        <div className="home-library-heading"><h2 id="library-title">오늘의 놀 거리를 골라요 <span>{games.length}</span></h2><span>마음 가는 대로, 재밌게!</span></div>
        <div className="home-filters" role="group" aria-label="게임 종류">
          {categories.map((item) => <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}><span aria-hidden="true">{item.icon}</span> {item.label}<span className="home-filter-count">{games.filter((game) => item.id === 'all' || game.tags.includes(item.id)).length}</span></button>)}
        </div>
        <p className="home-filter-status" role="status">{categories.find((item) => item.id === category).label} {visibleGames.length}개</p>
        <div className="game-grid">
          {visibleGames.map((game, index) => <Link key={game.id} to={`/game/${game.id}`} className="game-card" style={{ '--card-color': game.color, '--card-delay': `${Math.min(index, 7) * 35}ms` }}>
            <div className="game-card-scene"><span className="game-card-number">PLAY / {String(games.indexOf(game) + 1).padStart(2, '0')}</span><span className="game-card-emoji" aria-hidden="true">{game.emoji}</span><span className="game-card-spark" aria-hidden="true">✦</span><span className="game-card-category">{game.tags.includes('edu') ? '놀면서 배우기' : game.tags.includes('puzzle') ? '퍼즐' : '액션'}</span></div>
            <div className="game-card-body"><h3>{game.title}</h3><p>{game.description}</p><span className="game-card-play">놀러 가기 <span aria-hidden="true">↗</span></span></div>
          </Link>)}
        </div>
      </section>
      <footer className="home-footer"><span className="home-brand">✳ IAN GAMES</span><p>이안의 아이디어에 사랑을 더했어요. <span aria-hidden="true">♡</span></p><a href="#home-title">맨 위로 ↑</a></footer>
    </main>
  )
}
