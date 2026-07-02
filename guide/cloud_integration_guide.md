# Supabase & Google Cloud 연동 친절 가이드 (Cloud Integration Guide)

구글 클라우드 및 Supabase를 처음 사용하시는 분들도 쉽게 따라 하실 수 있도록 단계별로 구성한 연동 안내서입니다.

---

## 1. Supabase (데이터베이스 & 로그인) 설정하기

Supabase는 학생 목록을 저장하고, 학생들의 평가 결과를 안전하게 보관하는 실시간 데이터베이스 역할을 합니다.

### [단계 1] Supabase 프로젝트 생성
1. [Supabase 공식 홈페이지](https://supabase.com)에 접속하여 회원가입 후 로그인합니다.
2. **New Project** 버튼을 클릭합니다.
3. 프로젝트 이름(예: `peer-eval-app`)을 입력하고, 데이터베이스 비밀번호를 설정한 뒤 지역(Region)을 **Seoul (ap-northeast-2)**로 선택합니다.
4. **Create new project**를 누르고 프로젝트가 개설될 때까지 약 1~2분 기다립니다.

### [단계 2] API 키 획득 및 .env 설정
1. 프로젝트 생성이 완료되면 왼쪽 메뉴 가장 아래의 **Project Settings** (톱니바퀴 아이콘) -> **API** 메뉴로 이동합니다.
2. 화면에 보이는 두 가지 정보를 복사하여 프로젝트 폴더의 `.env` 파일에 복사 붙여넣기 합니다:
   - `Project URL` ➡️ `VITE_SUPABASE_URL`에 입력
   - `anon public (API Key)` ➡️ `VITE_SUPABASE_ANON_KEY`에 입력

---

## 2. Google Cloud & Google Sheets API 연동하기

학생들의 평가 제출 현황과 최종 평가 결과(엑셀 양식)를 구글 드라이브의 스프레드시트에 실시간으로 기록하기 위한 설정입니다.

### [단계 1] 구글 클라우드 콘솔 프로젝트 만들기
1. [구글 클라우드 콘솔](https://console.cloud.google.com/)에 접속하여 구글 계정으로 로그인합니다.
2. 상단 좌측의 프로젝트 선택 드롭다운을 누른 뒤 **새 프로젝트(New Project)**를 클릭합니다.
3. 프로젝트 이름(예: `Peer Evaluation Sheet Sync`)을 적고 **만들기**를 누릅니다.

### [단계 2] Google Sheets API 활성화
1. 좌측 탐색 메뉴에서 **API 및 서비스** ➡️ **라이브러리(Library)**를 선택합니다.
2. 검색창에 `Google Sheets API`를 검색하고 클릭합니다.
3. **사용(Enable)** 버튼을 클릭하여 API를 활성화합니다.

### [단계 3] API 키 및 OAuth 2.0 클라이언트 ID 생성 (인증 설정)
1. **API 및 서비스** ➡️ **사용자 인증 정보(Credentials)** 메뉴로 이동합니다.
2. 상단의 **사용자 인증 정보 만들기(Create Credentials)** 버튼을 클릭합니다.
3. **API 키**를 선택하면 고유한 문자열 키가 생성됩니다. 이를 복사하여 `.env` 파일의 `VITE_GOOGLE_API_KEY`에 입력합니다.
4. 다시 **사용자 인증 정보 만들기** ➡️ **OAuth 클라이언트 ID**를 클릭합니다.
   - 처음 생성할 경우 *동의 화면 구성(Configure Consent Screen)*이 필요하다는 메시지가 뜹니다.
   - **외부(External)**를 선택하고 앱 이름과 이메일 등 기본 사항만 기입한 뒤 저장합니다.
5. 동의 화면 설정이 끝나면 다시 **사용자 인증 정보 만들기** ➡️ **OAuth 클라이언트 ID**로 들어갑니다.
6. 애플리케이션 유형을 **웹 애플리케이션(Web Application)**으로 선택합니다.
7. 승인된 JavaScript 원본(Authorized JavaScript Origins)에 로컬 호스트 주소(예: `http://localhost:5173`)를 추가합니다.
8. **만들기**를 누르면 생성되는 **클라이언트 ID** 문자열을 복사하여 `.env` 파일의 `VITE_GOOGLE_CLIENT_ID`에 입력합니다.

### [단계 4] 대상 스프레드시트 ID 확인
1. 본인의 구글 드라이브에 새 스프레드시트를 하나 만듭니다.
2. 주소창(URL)을 유심히 보시면 다음과 같은 고유 ID가 있습니다:
   `https://docs.google.com/spreadsheets/d/[여기에_있는_긴_문자열]/edit#gid=0`
3. 이 중간의 긴 문자열(`[여기에_있는_긴_문자열]`)을 복사해 `.env` 파일의 `VITE_GOOGLE_SHEET_ID`에 적어줍니다.

---

> [!TIP]
> **로컬 Mock 모드로의 복귀**
> 연동 도중 오류가 발생하거나 로컬 스크린으로 다시 작동 테스트를 원하실 경우, `.env` 파일 내부의 환경변수 값들을 지우거나 주석 처리하시면 즉시 원래의 로컬 Mock 모드로 실행됩니다.
