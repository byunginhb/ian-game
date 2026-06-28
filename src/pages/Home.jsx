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

const BG_PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  animationDelay: `${((i * 19) % 80) / 10}s`,
  animationDuration: `${6 + ((i * 13) % 80) / 10}s`,
  size: 4 + ((i * 7) % 6),
  opacity: 0.15 + ((i * 9) % 20) / 100,
}));

function Home() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setLoaded(true));
  }, []);

  const games = [
    {
      id: "magic-hanja",
      title: "한자 마법 배틀",
      emoji: "🔮",
      description: "한자의 뜻·음을 맞혀 마법을 외치고 요괴를 물리치는 학습 배틀!",
      color: "#7c4dde",
      tags: ["new", "hot", "edu"],
    },
    {
      id: "tower-defense",
      title: "으악! 오지마",
      emoji: "🏯",
      description: "구불구불 길로 몰려오는 젤리몽을 타워를 세워 막아라! 20웨이브 디펜스!",
      color: "#16a34a",
      tags: ["new", "hot", "action"],
    },
    {
      id: "fruit-slash",
      title: "과일 닌자",
      emoji: "🍉",
      description: "30초 동안 날아오는 과일을 베고 마지막 러시까지 점수를 폭발시키세요!",
      color: "#22c55e",
      tags: ["new", "hot", "action"],
    },
    {
      id: "star-rescue",
      title: "별빛 구조대",
      emoji: "🚀",
      description: "그림자 몬스터를 쏘고 별을 구조하는 웨이브 액션 게임!",
      color: "#f59e0b",
      tags: ["new", "hot", "action"],
    },
    {
      id: "help-me",
      title: "도와줘",
      emoji: "🧼",
      description: "비누로 손바닥 위 세균을 시간 안에 모두 없애세요!",
      color: "#10b981",
      tags: ["new", "edu", "action"],
    },
    {
      id: "fortress",
      title: "삐리삐리 날라갑니다",
      emoji: "💥",
      description: "각도와 파워로 포탄을 쏴 상대 탱크를 격파! 2인 대전 또는 AI와 대결!",
      color: "#e74c3c",
      tags: ["new", "hot", "action"],
    },
    {
      id: "monster-defense",
      title: "몬스터 디펜스",
      emoji: "🏰",
      description: "사방에서 몰려오는 몬스터를 막아라! 무기 업그레이드!",
      color: "#dc2626",
      tags: ["new", "hot", "action"],
    },
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
        {BG_PARTICLES.map((particle, i) => (
          <div
            key={i}
            className="home-bg-particle"
            style={{
              left: particle.left,
              animationDelay: particle.animationDelay,
              animationDuration: particle.animationDuration,
              width: particle.size,
              height: particle.size,
              opacity: particle.opacity,
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
