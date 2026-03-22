# ian-game

아이(Ian)를 위한 교육용 게임 모음 프로젝트

## 기술 스택

- **프레임워크**: React 19 + Vite 7
- **라우팅**: react-router-dom v7
- **패키지 매니저**: pnpm
- **언어**: JavaScript (JSX)
- **린팅**: ESLint 9

## 프로젝트 구조

```
src/
├── App.jsx          # 메인 앱 (라우터 설정)
├── main.jsx         # 엔트리 포인트
├── pages/           # 게임 페이지들
├── hooks/           # 커스텀 훅
└── assets/          # 정적 자산
```

## 개발 명령어

```bash
pnpm dev       # 개발 서버
pnpm build     # 프로덕션 빌드
pnpm lint      # ESLint 실행
pnpm preview   # 빌드 미리보기
```

## 컨벤션

- 컴포넌트: JSX 함수형 컴포넌트
- 스타일: CSS 파일 (컴포넌트별)
- 상태 관리: React hooks (useState, useEffect 등)
- 불변성 패턴 준수
- 커밋 메시지: 한국어, conventional commits 형식
