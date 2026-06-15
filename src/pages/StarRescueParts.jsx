export function StarBackdrop() {
  return (
    <div className="sr-space">
      {Array.from({ length: 44 }, (_, index) => (
        <span
          key={index}
          className="sr-star"
          style={{
            left: 12 + ((index * 53) % 392),
            top: 24 + ((index * 79) % 556),
            animationDelay: `${((index * 11) % 50) / 10}s`,
          }}
        />
      ))}
      <span className="sr-planet sr-planet-1" />
      <span className="sr-planet sr-planet-2" />
    </div>
  )
}

export function StarHud({ wave, score, rescued, target, hp, energy, progressRatio, boss }) {
  return (
    <>
      <div className="sr-hud">
        <div className="sr-chip">WAVE {wave}</div>
        <div className="sr-chip sr-score">점수 {score}</div>
        <div className="sr-chip sr-target">{rescued}/{target}</div>
      </div>

      <div className="sr-bars">
        <div className="sr-life" aria-label={`남은 생명 ${hp}`}>{'💙'.repeat(hp)}{'🖤'.repeat(Math.max(0, 5 - hp))}</div>
        <div className="sr-energy"><span style={{ width: `${energy}%` }} /></div>
        <div className="sr-progress"><span style={{ width: `${progressRatio * 100}%` }} /></div>
      </div>

      {boss && (
        <div className="sr-boss-card">
          <span>그림자 왕</span>
          <div><span style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} /></div>
        </div>
      )}
    </>
  )
}

export function StarEntities({ view, combo, phase, shielded, dashing, playerSize }) {
  return (
    <>
      {view.bullets.map((bullet) => (
        <span
          key={bullet.id}
          className="sr-bullet"
          style={{ left: bullet.x, top: bullet.y, width: bullet.size, height: bullet.size * 2.2 }}
        />
      ))}

      {view.enemyShots.map((shot) => (
        <span
          key={shot.id}
          className="sr-enemy-shot"
          style={{ left: shot.x, top: shot.y, width: shot.size, height: shot.size }}
        />
      ))}

      {view.enemies.map((enemy) => (
        <div
          key={enemy.id}
          className={`sr-enemy sr-enemy-${enemy.type}`}
          style={{
            left: enemy.x,
            top: enemy.y,
            width: enemy.size,
            height: enemy.size,
            '--enemy-color': enemy.color,
            animationDuration: `${enemy.wobble}s`,
          }}
        >
          <span>{enemy.emoji}</span>
          {enemy.maxHp > 1 && <i style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} />}
        </div>
      ))}

      {view.boss && (
        <div
          className="sr-boss"
          style={{ left: view.boss.x, top: view.boss.y, width: view.boss.size, height: view.boss.size }}
        >
          <span>😈</span>
        </div>
      )}

      {view.pickups.map((pickup) => (
        <div
          key={pickup.id}
          className="sr-pickup"
          style={{ left: pickup.x, top: pickup.y, width: pickup.size, height: pickup.size, '--star-color': pickup.color }}
        >
          ★
        </div>
      ))}

      <div
        className={`sr-player${shielded ? ' sr-player-shield' : ''}${dashing ? ' sr-player-dash' : ''}`}
        style={{ left: view.player.x, top: view.player.y, width: playerSize, height: playerSize }}
      >
        <span className="sr-ship">🚀</span>
      </div>

      {view.particles.map((particle) => (
        <span
          key={particle.id}
          className="sr-particle"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            background: particle.color,
            '--spark-x': `${particle.dx}px`,
            '--spark-y': `${particle.dy}px`,
          }}
        />
      ))}

      {combo >= 4 && phase === 'playing' && <div className="sr-combo">연속 구조 {combo}</div>}
    </>
  )
}

export function TouchControls({ onFireDown, onFireUp, onDash }) {
  return (
    <div className="sr-touch-controls" aria-hidden="true">
      <button
        type="button"
        className="sr-touch-fire"
        onPointerDown={onFireDown}
        onPointerUp={onFireUp}
        onPointerLeave={onFireUp}
      >
        발사
      </button>
      <button type="button" className="sr-touch-dash" onPointerDown={onDash}>
        대시
      </button>
    </div>
  )
}

export function StarOverlay({ phase, rescued, score, best, onPrimary }) {
  const isClear = phase === 'clear'
  const isLost = phase === 'lost'

  return (
    <div className="sr-overlay">
      <div className="sr-modal">
        <div className="sr-modal-icon">{isClear ? '🌟' : isLost ? '💫' : '🚀'}</div>
        <h1>{isClear ? '웨이브 클리어!' : isLost ? '구조 실패' : '별빛 구조대'}</h1>
        <p>
          {isClear
            ? `별 ${rescued}개 구조 · 다음 웨이브로 출동`
            : isLost
              ? `점수 ${score} · 최고 ${best}`
              : '그림자 몬스터를 쏘고 별을 구조하세요'}
        </p>
        <button type="button" className="sr-primary-button" onClick={onPrimary}>
          {isClear ? '다음 웨이브' : '출동'}
        </button>
      </div>
    </div>
  )
}
