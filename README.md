# IAN Games

이안과 함께 아이디어를 만들고 즐기는 19가지 게임 놀이터입니다. 게임의 규칙과 캐릭터를 유지하면서 PC 키보드·마우스와 모바일 터치를 지원합니다.

## 실행

React 19, Vite 7, JavaScript/JSX, pnpm을 사용합니다.

```sh
pnpm install
pnpm dev
```

```sh
pnpm lint          # ESLint
pnpm test          # 게임 시계·화면 배율 단위 테스트
pnpm build         # 프로덕션 빌드
pnpm preview       # 빌드 미리보기
```

## 브라우저 검증

최초 한 번 테스트용 브라우저를 설치합니다.

```sh
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

PC Chromium, Android 크기 Chromium, iPhone 크기 WebKit, 320px 작은 화면, 모바일 가로 화면에서 전체 게임의 시작·입력·일시정지·복귀를 검증합니다. 2048 병합, 테트리스 줄 삭제 중 중복 입력, 스택 타워 마우스 배치, 배경 전환 시 시간 보존, 저장소 접근 차단도 검증합니다. 브라우저 에뮬레이션이므로 실제 기기의 GPU 성능·OS 제스처까지 재현하지는 않습니다.

## 공통 게임 동작

- `src/lib/gameClock.js`: 게임 시간, 프레임, 반복 작업, 지연 작업의 공통 시계입니다. `GameSession`이 창 이탈·화면 숨김·‘잠깐 쉬기’에서 시계를 정지하고, 게임을 나갈 때 남은 작업을 취소합니다. 계속하기를 눌러야 재개됩니다.
- 새 게임 로직에서는 기본 `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date.now`, `performance.now` 대신 `gameClock`의 같은 이름 메서드와 `now()`를 사용합니다. 오디오 합성에는 AudioContext 자체 시계를 사용합니다.
- 기존 물리 계산의 고정 간격은 유지하며, 화면 갱신은 하나의 `requestAnimationFrame`으로 처리합니다. 지연 프레임은 최대 50ms까지만 따라잡고, 반복 콜백은 프레임당 최대 5회 처리합니다.
- `useGameScale`은 주소 표시줄 변화와 화면 회전에 반응합니다. 좁고 낮은 화면에서는 게임을 읽을 수 있는 크기를 유지하고 페이지 세로 스크롤을 허용합니다. 터치 제스처 차단은 조작 영역으로 제한합니다.
- 물리 시뮬레이션은 ref에서 계산하고, React에 넘기는 화면 상태는 복제하여 게시합니다. 상태 updater 안에서 점수·타이머·다른 상태를 변경하는 부수 효과를 만들지 않습니다.
- 게임 목록은 `src/data/games.js`, 각 게임의 지연 로딩은 `src/App.jsx`에서 관리합니다. 게임을 추가할 때 두 곳에 등록합니다.
- 운영 서버는 `/game/*` 직접 접근 시 `index.html`로 연결하는 SPA fallback이 필요합니다.
