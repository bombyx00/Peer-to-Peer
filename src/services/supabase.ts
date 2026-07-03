/**
 * Supabase Integration Bridge
 * 
 * 실제 백엔드 연동이 활성화되면 아래 함수들을 실제 Supabase SDK (@supabase/supabase-js)
 * 혹은 REST API 호출 방식으로 전환하여 사용합니다.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => {
  return supabaseUrl !== '' && supabaseAnonKey !== '';
};

// 학생 데이터를 DB에 동기화
export const syncStudentsToSupabase = async (students: any[]) => {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase 환경변수가 설정되지 않아 로컬 모드로 동작합니다.');
    return false;
  }
  
  try {
    // 예시: API Fetch 호출
    const response = await fetch(`${supabaseUrl}/rest/v1/students`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(students)
    });
    return response.ok;
  } catch (error) {
    console.error('Supabase 학생 동기화 실패:', error);
    return false;
  }
};

// 프로젝트 및 모둠 정보 동기화
export const syncProjectToSupabase = async (project: any) => {
  if (!isSupabaseConfigured()) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/projects`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(project)
    });
    return response.ok;
  } catch (error) {
    console.error('Supabase 프로젝트 동기화 실패:', error);
    return false;
  }
};

// 제출된 평가 저장
export const submitEvaluationToSupabase = async (evaluation: any) => {
  if (!isSupabaseConfigured()) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/evaluations`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(evaluation)
    });
    return response.ok;
  } catch (error) {
    console.error('Supabase 평가 제출 실패:', error);
    return false;
  }
};

// 인증번호로 활성화된 프로젝트 조회
export const fetchProjectByAccessCode = async (accessCode: string): Promise<any | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/projects?accessCode=eq.${accessCode.trim()}&active=eq.true`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      const data = await response.json();
      return data.length > 0 ? data[0] : null;
    }
    return null;
  } catch (error) {
    console.error('Supabase 프로젝트 조회 실패:', error);
    return null;
  }
};

// 학적 정보를 통한 학생 조회
export const fetchStudentByDetails = async (
  grade: string,
  classNum: string,
  number: string,
  name: string
): Promise<any | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/students?grade=eq.${grade.trim()}&classNum=eq.${classNum.trim()}&number=eq.${number.trim()}&name=eq.${name.trim()}`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (response.ok) {
      const data = await response.json();
      return data.length > 0 ? data[0] : null;
    }
    return null;
  } catch (error) {
    console.error('Supabase 학생 조회 실패:', error);
    return null;
  }
};
