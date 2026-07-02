# 학생 모둠 상호평가 웹앱 구현 계획 (Peer Evaluation Web App Implementation Plan)

교사와 학생 모두가 편리하게 모둠 상호평가를 수행하고 관리할 수 있도록 돕는 프리미엄 웹 애플리케이션을 구축합니다.

---

## 사용자 검토 필요 사항 (User Review Required)

> [!IMPORTANT]
> **로컬 Mock 모드 우선 지원**
> 실제 Supabase(Auth/DB) 및 Google Sheets API를 연동하려면 구글 클라우드 콘솔 및 Supabase 프로젝트 생성이 필요합니다. 
> 원활한 초기 검증 및 시연을 위해 **로컬 스토리지 기반의 완전 작동 Mock 모드**를 내장하고, 환경변수(`.env`) 설정을 통해 실제 Supabase 및 API 연동 모드로 전환할 수 있도록 아키텍처를 설계하겠습니다.

> [!NOTE]
> **Tailwind CSS 사용 여부**
> 본 가이드라인은 기본적으로 **Vanilla CSS** 사용을 권장합니다. CSS Custom Variables를 활용하여 다크모드 및 모던한 글래스모피즘(Glassmorphism) 스타일을 적용할 예정입니다. 
> 만약 Tailwind CSS를 희망하신다면 계획서 승인 시점에 말씀해주시기 바랍니다.

---

## 오픈 질문 (Open Questions)
1. **학생의 로그인 제한 범위**: 업로드된 CSV의 구글 이메일 리스트와 대조하는 기능을 Mock 모드에서 로컬 이메일 입력 로그인 등으로 간편하게 테스트할 수 있도록 구현해도 괜찮을까요? (실제 연동 시에는 Supabase OAuth 구글 로그인 적용)
2. **학생의 자기 평가**: 자기 평가(Self-evaluation) 포함 여부를 프로젝트 생성 시 교사가 토글할 수 있게 설계할 예정인데, 추가로 원하는 조건이 있으신가요?

---

## 제안된 변경 사항 (Proposed Changes)

Vite와 React, TypeScript를 기반으로 프로젝트를 생성하고, UI 완성도와 사용자 경험(UX)을 극대화한 컴포넌트를 설계합니다.

### [Component Name] 프로젝트 프레임워크 & 파일 구조

#### [NEW] [Vite Project Structure](file:///d:/Project_Codes/20260629_evaluatelves)
- **`index.html`**: 웹앱 엔트리 포인트, 구글 폰트(Outfit/Inter) 적용 및 기본적인 SEO 메타태그 설정.
- **`src/index.css`**: CSS variables 정의, 기본 테마 스타일링 (Premium Dark/Light Glassmorphism).
- **`src/main.tsx`**: React 엔트리 렌더러.
- **`src/App.tsx`**: 라우팅 제어 (교사 대시보드 / 학생 평가 화면 / 로그인 화면).
- **`src/context/AppContext.tsx`**: 데이터 공유 및 Mock/Supabase 모드 상태 전역 관리.
- **`src/components/`**:
  - `TeacherDashboard/`: CSV 업로드, 프로젝트 생성, Drag & Drop 모둠 배정, 실시간 모니터링 컴포넌트.
  - `StudentEvaluation/`: 질문별 평가 입력 양식(별점, 슬라이더, 주관식), 제출 확인 컴포넌트.
  - `Common/`: Premium Input, Button, Card, Modal 컴포넌트.
- **`src/services/`**:
  - `supabase.ts`: Supabase 클라이언트 셋업.
  - `sheets.ts`: 구글 시트 연동 API 서비스.
  - `mockStorage.ts`: 로컬 스토리지 기반 Mock API 구현 (오프라인 테스트용).
- **`package.json`**: 라이브러리 의존성 설정 (`lucide-react` 아이콘, `dnd-kit` 드래그 앤 드롭 등).

---

## 검증 계획 (Verification Plan)

### 수동 검증 (Manual Verification)
교사 및 학생의 전체 흐름을 테스트합니다.
1. **교사 흐름**:
   - CSV 파일을 업로드하여 학생 목록 생성 확인.
   - 프로젝트 주제 및 평가 문항(객관식, 주관식, 슬라이더, 별점) 커스텀 설계.
   - Drag & Drop UI를 활용한 학생 모둠 배정 테스트.
   - 실시간 대시보드에서 제출 현황 모니터링.
2. **학생 흐름**:
   - 이메일 로그인을 통해 학생 화면 진입.
   - 본인이 속한 모둠원만 평가 리스트에 노출되는지 확인.
   - 평가 입력(별점, 수직선 슬라이더, 주관식 등) 후 임시 저장 및 제출 완료.
   - 제출 후 대시보드에 완료 상태가 즉각 반영되는지 확인.
