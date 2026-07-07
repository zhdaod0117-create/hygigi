# Retriever Nest 2.0 — 프로젝트 스펙

> AI가 코드를 짤 때 지켜야 할 규칙과 절대 하면 안 되는 것.
> 이 문서를 AI에게 항상 함께 공유하세요.

---

## 기술 스택 (기존 앱 그대로 — 변경 금지)

| 영역 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js 14 (App Router) | 기존 앱과 동일. 업그레이드는 이번 범위 아님 |
| DB/백엔드 | Supabase (Postgres + RLS + Realtime) | 기존 테이블·RLS 패턴 재사용 |
| 인증 | Supabase Auth (매직링크 + 6자리 OTP) | 이미 동작 검증 완료 |
| 배포 | Vercel | 기존 배포 채널 |
| 스타일링 | Tailwind CSS 3 (커스텀 팔레트: cream/brown/butter) | 기존 디자인 시스템 유지 |

---

## 프로젝트 구조 (기존 구조에 추가)

```
retriever-nest/
├── src/
│   ├── app/
│   │   ├── page.tsx            # 홈 (기존 + 오늘의 우리 스트립)
│   │   ├── diary/page.tsx      # [신규] 오늘의 질문 + 교환일기
│   │   └── history/page.tsx    # [신규] 기록 타임라인
│   ├── components/             # 섹션 단위 컴포넌트 (기존 관례 유지)
│   └── lib/
│       ├── actions/            # 서버 액션 — { data, error } 반환 패턴 필수
│       └── supabase/           # 클라이언트 (변경 금지)
├── supabase/schema.sql          # 스키마 추가는 이 파일에 (멱등 SQL)
└── PRD/                         # 이 문서들
```

---

## 절대 하지 마 (DO NOT)

- [ ] **기존 테이블(profiles, couple_workspaces, workspace_members, todos, notes)의 컬럼·정책을 변경하지 마** — 신규 테이블 추가만
- [ ] **서버 액션에서 `throw new Error(메시지)`로 에러를 던지지 마** — 프로덕션에서 메시지가 마스킹된다. 반드시 `{ data, error }` 반환 (기존 actions/ 참고)
- [ ] 신규 테이블에 RLS 없이 두지 마 — 모든 테이블은 `is_workspace_member()` 패턴 필수
- [ ] "둘 다 써야 공개" 규칙을 클라이언트에서만 구현하지 마 — RLS SELECT 정책으로 강제
- [ ] RPC/함수 만들 때 `revoke execute from public, anon` 빠뜨리지 마 (기존 함수들과 동일)
- [ ] API 키를 코드에 직접 쓰지 마 (.env.local 사용)
- [ ] package.json 의존성 버전을 올리거나 새 UI 라이브러리를 추가하지 마
- [ ] schema.sql에 멱등이 아닌 SQL(재실행 시 에러 나는 구문)을 넣지 마

## 항상 해 (ALWAYS DO)

- [ ] UI 갱신은 낙관적 업데이트 + Realtime 중복제거(id 기준) 패턴 유지 (DashboardClient.tsx 참고)
- [ ] 날짜 판정은 반드시 KST 기준 (`lib/date.ts`의 `getTodayDateString()` 재사용)
- [ ] 에러는 한국어 토스트로, 원본 에러는 `console.error`로만
- [ ] 모바일 우선 (375px에서 먼저 확인), 기존 팔레트·라운드(rounded-2xl) 유지
- [ ] 새 이벤트마다 강아지 말풍선 반응 추가 (PixelRetriever bubble 재사용)
- [ ] 작업 후 `npx tsc --noEmit` + `npm run build` 통과 확인

---

## 테스트 방법

```bash
npm run dev          # 로컬 실행 (localhost:3000 — Supabase redirect 등록 포트)
npx tsc --noEmit     # 타입 체크
npm run build        # 프로덕션 빌드 확인
```

- 2계정 시나리오 테스트 필수: 시크릿 창으로 상대방 계정 로그인 → 일기 잠금/공개, Realtime 반영 확인
- schema.sql 변경 시: Supabase SQL Editor에서 전체 재실행 (멱등)

---

## 환경변수 (기존과 동일, 추가 없음)

| 변수명 | 설명 | 어디서 발급 |
|--------|------|------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 프로젝트 URL | Supabase → Settings → API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Publishable key (sb_publishable_...) | 위와 동일 |

> Phase 3 웹푸시 도입 시 VAPID 키 2개가 추가될 예정.

---

## [NEEDS CLARIFICATION]

- [ ] Phase 2 사진 업로드 시 이미지 리사이징 전략 (클라이언트 압축 vs Storage transform)
