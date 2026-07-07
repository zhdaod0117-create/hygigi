# Retriever Nest 🐾

커플이 함께 쓰는 공유 투두/메모 웹앱. 매직링크로 로그인하고, 초대 코드로 같은
공간(workspace)에 들어가 할 일과 메모를 실시간으로 공유합니다. 화면 하단에는
픽셀 골든 리트리버가 돌아다니며 할 일을 완료하거나 메모를 남기면 말풍선으로
반응합니다.

## 2.0 — 주말커플 확장 (Phase 1)

평일에 못 만나는 커플을 위한 비동기 소통 기능이 추가됐습니다. (기획 문서: [PRD/](PRD/README.md))

- **감정 날씨 체크인** ☀️🌤️☁️🌧️⛈️ — 홈의 "오늘의 우리"에서 탭 한 번 + 선택적 한 줄. 상대 화면에 실시간 반영
- **오늘의 질문 교환일기** (📖 일기 탭) — 매일 질문 하나에 각자 답하고, **둘 다 써야 서로의 답이 공개** (DB RLS로 강제)
- **출퇴근/야근 상태** 🏢🏠🌙🔇 — 탭 한 번으로 지금 상태 공유
- **리액션 + 읽음 표시** — 일기·감정 기록에 이모지 6종으로 답장 부담 없이 반응
- **기록 타임라인** (📚 기록 탭) — 감정과 일기가 날짜별로 쌓임

### Phase 2

- **🧺 주말에 하고 싶은 것** — 평일에 담아두고 주말에 함께 체크하는 위시리스트
- **🍽️ 오늘의 밥상** — 끼니별 사진 한 장 + 한 줄 (사진은 비공개 Storage, 둘만 볼 수 있음)
- **🗓️ 감정 캘린더** (기록 탭 상단) — 월 단위로 두 사람의 날씨를 나란히

> ⚠️ 2.0 기능을 켜려면 [supabase/schema.sql](supabase/schema.sql)을 Supabase SQL Editor에서
> **다시 한 번 실행**해야 합니다 (신규 테이블 7개 + 질문 시드 + 사진용 Storage 버킷.
> 멱등이라 여러 번 실행해도 안전).

## 기술 스택

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Auth 매직링크, Postgres, Row Level Security, Realtime)
- PWA (홈 화면에 추가해서 앱처럼 실행 — iOS Safari 제약상 완전한 네이티브 수준은 아님)

## 1. Supabase 프로젝트 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. 프로젝트 대시보드 → **SQL Editor**로 이동합니다.
3. 이 저장소의 [supabase/schema.sql](supabase/schema.sql) 파일 내용을 전체 복사해서
   붙여넣고 실행(Run)합니다. (스키마가 업데이트되면 같은 파일을 다시 실행하면
   됩니다 — 모든 구문이 멱등이라 여러 번 실행해도 안전합니다.)
   - `profiles`, `couple_workspaces`, `workspace_members`, `todos`, `notes` 테이블
   - 모든 테이블에 대한 RLS 정책 (같은 workspace 멤버만 읽기/쓰기 가능)
   - `create_workspace()` / `join_workspace(code)` RPC 함수
   - `auth.users` 생성 시 `profiles`를 자동 생성하는 트리거
   - `todos`, `notes`를 Realtime publication에 추가
4. **Authentication → Providers → Email**에서 "Confirm email"을 꺼도 되고 켜도
   됩니다 (매직링크 자체는 별도 설정 없이 기본 동작). "Enable Email provider"가
   켜져 있는지만 확인하세요.
5. **Authentication → URL Configuration**에서 아래를 추가합니다.
   - Site URL: `http://localhost:3000` (로컬 개발용), 배포 후에는 실제 도메인으로 변경
   - Redirect URLs: `http://localhost:3000/auth/callback`, 배포 도메인의
     `/auth/callback` 경로도 추가 (예: `https://your-app.vercel.app/auth/callback`)
6. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사해둡니다.
   (아래 환경변수에 사용)

## 2. 환경변수 설정

`.env.example`을 복사해서 `.env.local`을 만들고 값을 채워주세요.

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3. 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 로그인되어 있지 않으면
자동으로 `/login`으로 이동합니다.

### 사용 흐름

1. `/login`에서 이메일을 입력하고, 초대 코드가 있다면 함께 입력합니다.
   - 초대 코드를 비워두면 로그인 후 **새 공간이 자동 생성**되고 6자리 코드가
     발급됩니다 (헤더에서 확인 + 복사 가능).
   - 초대 코드를 입력하면 로그인 후 해당 공간에 **자동으로 참여**합니다.
2. "로그인 링크 받기"를 누르면 매직링크 메일이 발송됩니다. (Supabase 기본
   SMTP는 시간당 발송량 제한이 있으니, 테스트가 많다면 Supabase 대시보드에서
   커스텀 SMTP를 설정하는 것을 추천합니다.)
3. 메일의 링크를 클릭하면 `/auth/callback`을 거쳐 대시보드(`/`)로 이동합니다.
4. 상대방도 같은 방식으로 로그인하면서, 첫 사람이 발급받은 초대 코드를
   입력하면 같은 공간에 합류합니다. (한 공간은 최대 2명까지)
5. 대시보드에서 할 일과 메모를 추가하면 상대방 화면에도 실시간으로 반영됩니다
   (Supabase Realtime 구독).

## 4. 프로젝트 구조

```
src/
  app/
    login/page.tsx          # 이메일 + 초대 코드 로그인 폼
    auth/callback/route.ts  # 매직링크 콜백: 세션 교환 + workspace 참여/생성
    page.tsx                 # 메인 대시보드 (서버 컴포넌트, 데이터 fetch)
    layout.tsx                # 루트 레이아웃 + PWA 메타 태그
  components/
    Header.tsx               # 앱 이름, 날짜, 초대 코드 + 복사 버튼
    DashboardClient.tsx       # 할 일/메모 realtime 구독 + 상태 관리
    TodoSection.tsx           # 오늘 할 일 상단 + 아코디언
    NoteSection.tsx           # 공유 메모 목록
    PixelRetriever.tsx        # CSS 픽셀 강아지 + 말풍선
    OnboardingCard.tsx        # workspace가 없을 때 참여/생성 폴백 화면
  lib/
    supabase/                 # 브라우저/서버/미들웨어용 Supabase 클라이언트
    actions/                  # 할 일/메모/workspace 서버 액션
    types.ts, date.ts, database.types.ts
  middleware.ts                # 세션 갱신 + 인증 라우트 보호
supabase/schema.sql             # 테이블 + RLS + RPC 전체 스키마
```

## 5. 데이터 모델 메모

- `assigned_to`는 실제 `user_id`(uuid)를 저장합니다. `NULL`이면 "둘 다",
  로그인한 사용자의 id와 같으면 "나", 상대방의 id와 같으면 "상대방"으로
  화면에 표시합니다. (문자열 라벨 대신 실제 id로 저장해서 보는 사람 기준이
  아니라 항상 정확하게 표시되도록 했습니다.)
- 한 사용자는 하나의 workspace에만 속할 수 있고(MVP 단순화), 하나의
  workspace는 최대 2명까지 참여할 수 있습니다.

## 6. Vercel 배포

1. 이 프로젝트를 GitHub 저장소로 push합니다.
2. [vercel.com](https://vercel.com)에서 New Project → 해당 저장소를 선택합니다.
3. **Environment Variables**에 아래 두 값을 추가합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy를 누릅니다. 배포가 끝나면 발급된 도메인(`https://xxx.vercel.app`)을
   확인합니다.
5. Supabase 대시보드 → **Authentication → URL Configuration**으로 돌아가서
   Site URL과 Redirect URLs에 방금 발급된 Vercel 도메인 + `/auth/callback`을
   추가합니다. (이 단계를 빼먹으면 배포 환경에서 매직링크 클릭 시 로그인이
   완료되지 않습니다.)
6. 배포된 URL로 접속해서 로그인 → 초대 코드 발급 → 상대방 참여까지 한 번
   테스트해보세요.

## 7. PWA (홈 화면 추가)

- `public/manifest.json`과 `public/icons/`에 기본 아이콘이 포함되어 있습니다.
  (임시 placeholder 아이콘이니, 원하는 그림으로 교체해도 됩니다.)
- Android/Chrome: 주소창의 "설치" 또는 메뉴의 "홈 화면에 추가"로 설치됩니다.
- iOS Safari: 공유 버튼 → "홈 화면에 추가"로 설치됩니다. iOS 특성상
  백그라운드 푸시, 완전한 오프라인 캐싱 등은 지원되지 않지만, 홈 화면
  아이콘으로 전체 화면 앱처럼 실행되는 정도는 충분히 됩니다.

## 8. 알아두면 좋은 점

- 매직링크 방식이라 비밀번호가 없습니다. 이메일 접근 권한만 있으면 로그인
  가능하니, 실제 사용 시 본인만 접근 가능한 이메일을 사용하세요.
- Supabase 기본 이메일 발송량 제한(시간당 요청 수)이 낮은 편이라, 테스트를
  반복하다 막히면 Supabase 대시보드에서 커스텀 SMTP(Resend, Postmark 등)를
  연결하는 것을 권장합니다.
