# Retriever Nest 2.0 — 데이터 모델

> 기존 스키마(supabase/schema.sql)에 **추가**하는 테이블만 다룹니다.
> 기존 테이블(profiles, couple_workspaces, workspace_members, todos, notes)은 변경하지 않습니다.

---

## 전체 구조

```
[couple_workspaces] --1:N--> [diary_entries]  <--N:1-- [diary_questions]
        |--1:N--> [mood_logs]
        |--1:N--> [work_status_logs]
        |--1:N--> [reactions] --(다형 참조)--> diary_entries | mood_logs | notes | todos

(모든 신규 테이블은 기존과 동일하게 workspace_id로 격리 + is_workspace_member() RLS)
```

---

## 엔티티 상세

### diary_questions — 질문 뱅크
앱에 미리 심어두는 "오늘의 질문" 목록. 유저가 만들지 않고 시드 데이터로 채움.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 번호 (자동) | 42 | O |
| content | 질문 내용 | "오늘 제일 뿌듯했던 순간은?" | O |
| is_active | 순환에 포함할지 | true | O |

> 오늘의 질문 결정: `entry_date`를 기준으로 `active 질문 중 (날짜 해시 % 질문 수)` — 서버 계산이라 둘에게 항상 같은 질문이 보장됨.
> ⚠️ 가정: 시드 90개 순환 재사용 — 아니라면 알려주세요

### diary_entries — 교환일기 답변
한 사람이 하루에 한 편. "둘 다 쓰면 공개"의 단위.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | uuid | O |
| workspace_id | 우리 공간 | uuid | O |
| user_id | 작성자 | uuid | O |
| entry_date | 어느 날의 일기인지 (KST 기준 날짜) | 2026-07-07 | O |
| question_id | 그날의 질문 | 42 | O |
| content | 답변 본문 (최대 2,000자) | "점심에 상사가…" | O |
| read_at | 상대가 처음 읽은 시각 (읽음 표시) | null → 시각 | X |
| created_at / updated_at | 작성/수정 시각 | 자동 | O |

- **유니크 제약**: (workspace_id, user_id, entry_date) — 1인 1일 1편
- **공개 규칙을 RLS로 강제**: 내 글은 항상 조회 가능. **상대 글은 "같은 entry_date에 내 글이 존재할 때만"** SELECT 허용 → 클라이언트 버그로도 잠금이 뚫리지 않음

### mood_logs — 감정 날씨 체크인
탭 한 번의 감정 기록. 수정 없음, 삭제만.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | uuid | O |
| workspace_id | 우리 공간 | uuid | O |
| user_id | 기록자 | uuid | O |
| mood | 날씨 5종: sunny/partly/cloudy/rainy/stormy | cloudy | O |
| note | 선택적 한 줄 (80자) | "회의 3연속…" | X |
| created_at | 기록 시각 | 자동 | O |

### work_status_logs — 출퇴근/야근 상태
로그로 쌓고 "가장 최근 기록"을 현재 상태로 취급. (덮어쓰기 대신 로그 → 실시간 반영·이력 공짜)

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | uuid | O |
| workspace_id | 우리 공간 | uuid | O |
| user_id | 기록자 | uuid | O |
| status | working 🏢 / off 🏠 / overtime 🌙 / meeting 🔇 | overtime | O |
| created_at | 기록 시각 | 자동 | O |

> ⚠️ 가정: KST 새벽 4시 이전 기록은 "오늘 상태 없음"으로 취급 (DB 삭제 없이 앱에서 판단) — 아니라면 알려주세요

### reactions — 이모지 리액션
일기·감정로그·(기존) 메모·투두에 달 수 있는 공용 리액션.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | uuid | O |
| workspace_id | 우리 공간 | uuid | O |
| user_id | 누른 사람 | uuid | O |
| target_type | 대상 종류: diary_entry/mood_log/note/todo | mood_log | O |
| target_id | 대상 id | uuid | O |
| emoji | ❤️😂😭👍🥺🎉 중 1 | 🥺 | O |
| created_at | 시각 | 자동 | O |

- **유니크 제약**: (user_id, target_type, target_id) — 1인 1대상 1개, 다시 누르면 교체

---

## 왜 이 구조인가

- **기존 패턴 재사용**: 모든 신규 테이블이 기존 todos/notes와 동일한 `workspace_id + is_workspace_member()` RLS 패턴 → 새 보안 개념 없음. Realtime publication에 추가만 하면 기존 구독 코드 패턴 그대로.
- **공개 규칙을 DB(RLS)에 둠**: "둘 다 써야 공개"가 이 제품의 핵심 약속. Connected 등 레퍼런스 앱들도 같은 규칙을 서버에서 강제한다. 클라이언트에서 숨기는 방식은 신뢰할 수 없음.
- **로그형 설계 (mood/status)**: 상태 덮어쓰기 대신 append-only 로그 → P2 감정 캘린더·P3 리캡이 추가 마이그레이션 없이 이 데이터를 그대로 집계.
- **다형 리액션 1테이블**: 대상별 리액션 테이블 4개를 만들지 않음. 단, FK가 없으므로 삭제 시 고아 리액션은 앱/트리거에서 정리 (단순성 우선).

---

## Phase 2 엔티티 (2026-07-07 구현됨)

### weekend_wishes — 주말 위시리스트
날짜·담당자 개념이 없어 todos와 **분리** 결정 (2026-07-07). 둘 중 누구든 체크/삭제 가능.

| 필드 | 설명 | 필수 |
|------|------|------|
| id / workspace_id / created_by / created_at | 공통 | O |
| title | 하고 싶은 것 (100자) | O |
| is_done | 주말에 했는지 | O |

### meal_posts — 오늘의 밥상
사진은 **private Storage 버킷 'meals'** 에 `workspace_id/uuid.jpg`로 저장, 폴더 첫 세그먼트로 멤버십 RLS 검사. 노출은 1시간짜리 서명 URL로만.

| 필드 | 설명 | 필수 |
|------|------|------|
| id / workspace_id / user_id / created_at | 공통 | O |
| meal_type | breakfast/lunch/dinner/snack | O |
| image_path | 버킷 내 경로 | O |
| caption | 한 줄 (100자) | X |

## [NEEDS CLARIFICATION]

- [ ] 감정 로그 상대 노출 범위 (초안: 전체 타임라인 노출)
- [x] ~~P2 주말 보드: 신규 테이블 vs 기존 todos 확장~~ → 신규 테이블로 결정·구현 (2026-07-07)
