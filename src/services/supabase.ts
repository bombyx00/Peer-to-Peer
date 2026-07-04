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

// 학생 데이터를 DB에 동기화 (roster_id 400 에러 펄백 대응)
export const syncStudentsToSupabase = async (students: any[], teacherEmail: string) => {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase 환경변수가 설정되지 않아 로컬 모드로 동작합니다.');
    return false;
  }
  
  try {
    const buildPayload = (includeRoster: boolean) => {
      return students.map(s => {
        const payload: any = {
          id: s.id,
          grade: s.grade,
          classNum: s.classNum,
          number: s.number,
          name: s.name,
          email: s.email,
          teacher_email: teacherEmail
        };
        if (includeRoster) {
          payload.roster_id = s.rosterId || 'roster-default';
        }
        return payload;
      });
    };

    let response = await fetch(`${supabaseUrl}/rest/v1/students`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(buildPayload(true))
    });

    // 400 에러 발생 시, roster_id가 DB 테이블에 없는 것으로 간주하여 펄백 재시도
    if (response.status === 400) {
      console.warn('Supabase students 테이블에 roster_id 컬럼이 없어 roster_id 없이 동기화를 재시도합니다.');
      response = await fetch(`${supabaseUrl}/rest/v1/students`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(buildPayload(false))
      });
    }

    return response.ok;
  } catch (error) {
    console.error('Supabase 학생 동기화 실패:', error);
    return false;
  }
};

// 프로젝트 및 모둠 정보 동기화 (roster_id 400 에러 펄백 대응)
export const syncProjectToSupabase = async (project: any, teacherEmail: string) => {
  if (!isSupabaseConfigured()) return false;
  try {
    const buildPayload = (includeRoster: boolean) => {
      const payload: any = {
        id: project.id,
        title: project.title,
        description: project.description,
        questions: typeof project.questions === 'string' ? project.questions : JSON.stringify(project.questions),
        selfEvalEnabled: project.selfEvalEnabled,
        groups: typeof project.groups === 'string' ? project.groups : JSON.stringify(project.groups),
        active: project.active,
        createdAt: project.createdAt,
        accessCode: project.accessCode,
        teacher_email: teacherEmail
      };
      if (includeRoster) {
        payload.roster_id = project.rosterId || 'roster-default';
      }
      return payload;
    };

    let response = await fetch(`${supabaseUrl}/rest/v1/projects`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(buildPayload(true))
    });

    // 400 에러 발생 시, roster_id가 DB 테이블에 없는 것으로 간주하여 펄백 재시도
    if (response.status === 400) {
      console.warn('Supabase projects 테이블에 roster_id 컬럼이 없어 roster_id 없이 동기화를 재시도합니다.');
      response = await fetch(`${supabaseUrl}/rest/v1/projects`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(buildPayload(false))
      });
    }

    return response.ok;
  } catch (error) {
    console.error('Supabase 프로젝트 동기화 실패:', error);
    return false;
  }
};

// 제출된 평가 저장
export const submitEvaluationToSupabase = async (evaluation: any) => {
  if (!isSupabaseConfigured()) throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  const response = await fetch(`${supabaseUrl}/rest/v1/evaluations`, {
    method: 'POST',
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(evaluation)
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Supabase DB 저장 실패 (${response.status}): ${errData.message || response.statusText || '알 수 없는 오류'}`);
  }
  return true;
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

// 프로젝트를 Supabase DB에서 삭제
export const deleteProjectFromSupabase = async (projectId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${projectId}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    console.error('Supabase 프로젝트 삭제 실패:', error);
    return false;
  }
};

// Supabase DB의 모든 프로젝트, 학생, 평가 데이터를 청소 (DELETE)
export const clearAllCloudData = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    // 1. projects 테이블 비우기 (PostgREST API에서 전체 삭제를 위해 조건으로 'id=not.is.null' 사용)
    const resProj = await fetch(`${supabaseUrl}/rest/v1/projects?id=not.is.null`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    // 2. students 테이블 비우기
    const resStud = await fetch(`${supabaseUrl}/rest/v1/students?id=not.is.null`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    // 3. evaluations 테이블 비우기
    const resEval = await fetch(`${supabaseUrl}/rest/v1/evaluations?id=not.is.null`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    return resProj.ok && resStud.ok && resEval.ok;
  } catch (error) {
    console.error('Supabase 클라우드 전체 초기화 실패:', error);
    return false;
  }
};

// 프로젝트 고유 ID로 Supabase DB 조회
export const fetchProjectById = async (projectId: string): Promise<any | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${projectId}`, {
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
    console.error('Supabase 프로젝트 ID 조회 실패:', error);
    return null;
  }
};

// Supabase DB에 저장된 전체 학생 명단 조회 (교사 이메일 필터링 추가)
export const fetchAllStudentsFromSupabase = async (teacherEmail: string): Promise<any[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/students?teacher_email=eq.${encodeURIComponent(teacherEmail)}`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Supabase 전체 학생 조회 실패:', error);
    return [];
  }
};

// 특정 학생이 수행한 특정 프로젝트의 평가 리스트 조회
export const fetchEvaluationsFromSupabase = async (projectId: string, evaluatorId: string): Promise<any[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/evaluations?projectId=eq.${projectId}&evaluatorId=eq.${evaluatorId}`,
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
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Supabase 평가 조회 실패:', error);
    return [];
  }
};

// 특정 평가 레코드 삭제 (중복 방지 및 Upsert 지원용)
export const deleteEvaluationFromSupabase = async (
  projectId: string,
  evaluatorId: string,
  evaluateeId: string
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/evaluations?project_id=eq.${projectId}&evaluator_id=eq.${evaluatorId}&evaluatee_id=eq.${evaluateeId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Supabase 평가 삭제 실패:', error);
    return false;
  }
};


// Supabase DB에 저장된 전체 프로젝트 조회 (교사 이메일 필터링 추가)
export const fetchAllProjectsFromSupabase = async (teacherEmail: string): Promise<any[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/projects?teacher_email=eq.${encodeURIComponent(teacherEmail)}`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Supabase 전체 프로젝트 조회 실패:', error);
    return [];
  }
};

// Supabase DB에 저장된 전체 평가 리스트 조회 (교사 이메일 필터링 추가)
export const fetchAllEvaluationsFromSupabase = async (teacherEmail: string): Promise<any[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/evaluations?teacher_email=eq.${encodeURIComponent(teacherEmail)}`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Supabase 전체 평가 조회 실패:', error);
    return [];
  }
};

// 명단 그룹(rosters) 데이터를 DB에 동기화
export const syncRostersToSupabase = async (rosters: any[], teacherEmail: string) => {
  if (!isSupabaseConfigured()) return false;
  try {
    const rostersPayload = rosters.map(r => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      teacher_email: teacherEmail
    }));

    const response = await fetch(`${supabaseUrl}/rest/v1/rosters`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(rostersPayload)
    });

    if (!response.ok) {
      console.warn('Supabase rosters 테이블 동기화 실패 (테이블이 없을 수 있음):', response.statusText);
    }
    return response.ok;
  } catch (error) {
    console.error('Supabase rosters 동기화 에러:', error);
    return false;
  }
};

// Supabase DB의 명단 그룹 조회
export const fetchAllRostersFromSupabase = async (teacherEmail: string): Promise<any[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rosters?teacher_email=eq.${encodeURIComponent(teacherEmail)}`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.warn('Supabase rosters 조회 실패 (테이블이 없을 수 있음):', error);
    return [];
  }
};

