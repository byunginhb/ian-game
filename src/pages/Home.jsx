import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import ianImg from "../assets/ian.png";
import "./Home.css";

const TAGS = {
  hot: { label: "HOT", color: "#ef4444" },
  new: { label: "NEW", color: "#22c55e" },
  puzzle: { label: "퍼즐", color: "#8b5cf6" },
  action: { label: "액션", color: "#f59e0b" },
  edu: { label: "학습", color: "#3b82f6" },
};

function Home() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setLoaded(true));
  }, []);

  const games = [
    {
      id: "suika",
      title: "수박 게임",
      emoji: "🍉",
      description: "같은 과일을 합쳐 수박을 만드세요!",
      color: "#27ae60",
      tags: ["hot", "puzzle"],
    },
    {
      id: "song-ian",
      title: "2048",
      emoji: "🔢",
      description: "타일을 밀어 같은 숫자를 합쳐 2048을 만드세요!",
      color: "#edc22e",
      tags: ["hot", "puzzle"],
    },
    {
      id: "tetris",
      title: "테트리스",
      emoji: "🟦",
      description: "블록을 쌓아 줄을 없애세요!",
      color: "#00b4d8",
      tags: ["puzzle"],
    },
    {
      id: "missile-shoot",
      title: "미사일 슈팅",
      emoji: "🚀",
      description: "뱀을 파괴하고 스테이지를 클리어하세요!",
      color: "#2060d0",
      tags: ["action"],
    },
    {
      id: "brick-breaker",
      title: "벽돌깨기",
      emoji: "🧱",
      description: "공을 튕겨서 벽돌을 모두 부수세요!",
      color: "#e64a19",
      tags: ["action"],
    },
    {
      id: "poop-dodge",
      title: "똥 피하기",
      emoji: "💩",
      description: "하늘에서 내리는 똥을 피하고 보호막을 모으세요!",
      color: "#8B4513",
      tags: ["action"],
    },
    {
      id: "stack-tower",
      title: "스택 타워",
      emoji: "🏗️",
      description: "블록을 정확히 쌓아 올리세요! 어긋나면 잘려요!",
      color: "#6366f1",
      tags: ["hot", "action"],
    },
    {
      id: "code-adventure",
      title: "코딩 어드벤처",
      emoji: "🐱",
      description: "명령어로 고양이를 별까지 데려가세요! 코딩 사고력 UP!",
      color: "#6366f1",
      tags: ["new", "puzzle"],
    },
    {
      id: "word-puzzle",
      title: "워드 퍼즐",
      emoji: "🔤",
      description: "이모지 힌트를 보고 영어 단어를 맞춰보세요!",
      color: "#3b82f6",
      tags: ["new", "edu"],
    },
    {
      id: "math-spell",
      title: "매쓰 스펠",
      emoji: "🧮",
      description: "수학 문제를 풀고 답을 영어로 맞춰보세요!",
      color: "#a855f7",
      tags: ["new", "edu"],
    },
  ];

  return (
    <div className={`home-container${loaded ? " home-loaded" : ""}`}>
      {/* animated bg particles */}
      <div className="home-bg-particles">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="home-bg-particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 8}s`,
              width: 4 + Math.random() * 6,
              height: 4 + Math.random() * 6,
              opacity: 0.15 + Math.random() * 0.2,
            }}
          />
        ))}
      </div>

      {/* header */}
      <header className="home-header">
        <div className="home-logo">
          <img src={ianImg} alt="Ian" className="home-logo-icon" />
          <h1 className="home-title">IAN Games</h1>
          <img src={ianImg} alt="Ian" className="home-logo-icon" />
        </div>
        <p className="home-subtitle">재미있는 미니게임 모음</p>
        <div className="home-stats">
          <span className="home-stat">🕹️ {games.length}개 게임</span>
          <span className="home-stat-dot">·</span>
          <span className="home-stat">🆓 무료 플레이</span>
        </div>
      </header>

      {/* game grid */}
      <div className="game-grid">
        {games.map((game, i) => (
          <Link
            key={game.id}
            to={`/game/${game.id}`}
            className="game-card"
            style={{
              "--card-color": game.color,
              "--card-index": i,
            }}
          >
            <div className="game-card-glow" />
            <div className="game-card-tags">
              {game.tags.map((tag) => (
                <span
                  key={tag}
                  className="game-card-tag"
                  style={{ background: TAGS[tag].color }}
                >
                  {TAGS[tag].label}
                </span>
              ))}
            </div>
            <span className="game-card-emoji">{game.emoji}</span>
            <h2 className="game-card-title">{game.title}</h2>
            <p className="game-card-desc">{game.description}</p>
            <span className="game-card-play">플레이 →</span>
          </Link>
        ))}
      </div>

      {/* footer */}
      <footer className="home-footer">
        <p>Made with ❤️ by Ian</p>
      </footer>
    </div>
  );
}

export default Home;
