import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockStorage } from '../services/mockStorage';
import type { Student, Project, Group, Question, Evaluation, Roster } from '../services/mockStorage';
import {
  checkHealth,
  getSession,
  setSession,
  clearSession,
  apiLoginTeacher,
  apiLoginStudent,
  fetchRosters,
  syncRosters,
  fetchStudents,
  syncStudents,
  fetchProjects,
  syncProject,
  deleteProjectApi,
  fetchStudentContext,
  fetchEvaluations,
  submitEvaluationApi,
  resetAllApi,
  fetchGeminiFeedback,
} from '../services/api';
import { isGoogleSheetsConfigured, appendEvaluationToSheet } from '../services/sheets';

interface User {
  role: 'teacher' | 'student';
  studentInfo?: Student;
  teacherInfo?: { email: string; name: string };
  currentProjectId?: string;
  teacherEmail?: string;
}

interface AppContextType {
  user: User | null;
  students: Student[];
  projects: Project[];
  evaluations: Evaluation[];
  rosters: Roster[];
  selectedRosterId: string;
  setSelectedRosterId: (id: string) => void;
  createRoster: (name: string) => void;
  deleteRoster: (id: string) => void;
  cloudConnected: { supabase: boolean; sheets: boolean; gemini: boolean };
  loginAsStudentWithCode: (
    accessCode: string,
    grade: string,
    classNum: string,
    number: string,
    name: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginAsTeacher: (googleIdToken: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  uploadStudents: (students: Student[]) => void;
  createProject: (
    title: string,
    description: string,
    questions: Question[],
    selfEvalEnabled: boolean,
    rosterId: string
  ) => void;
  updateProject: (
    projectId: string,
    title: string,
    description: string,
    questions: Question[],
    selfEvalEnabled: boolean,
    rosterId: string,
    groups?: Group[]
  ) => void;
  updateProjectGroups: (projectId: string, groups: Group[]) => void;
  deleteProject: (projectId: string) => void;
  toggleProjectStatus: (projectId: string) => void;
  submitEvaluation: (
    projectId: string,
    evaluatorId: string,
    evaluateeId: string,
    answers: { [questionId: string]: string | number }
  ) => Promise<void>;
  generateAndSaveAITotalFeedback: (projectId: string, evaluateeId: string) => Promise<void>;
  resetAll: () => void;
  reloadData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Derives the UI-facing User shape from the session minted by /api/auth.
const sessionToUser = (session: ReturnType<typeof getSession>): User | null => {
  if (!session) return null;
  if (session.role === 'teacher') {
    return { role: 'teacher', teacherInfo: { email: session.email, name: session.name } };
  }
  return {
    role: 'student',
    studentInfo: session.studentInfo,
    currentProjectId: session.projectId,
    teacherEmail: session.teacherEmail,
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => sessionToUser(getSession()));
  const [students, setStudents] = useState<Student[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<string>('');
  const [cloudConnected, setCloudConnected] = useState({ supabase: false, sheets: false, gemini: false });

  // Get current logged-in teacher email helper
  const getTeacherEmail = (): string | undefined => {
    return user?.role === 'teacher' ? user.teacherInfo?.email : undefined;
  };

  // Check cloud connection (via server-side health check — the client no longer
  // knows the raw Supabase/Gemini env vars) and register storage/session listeners.
  useEffect(() => {
    checkHealth().then(({ supabase, gemini }) => {
      setCloudConnected((prev) => ({ ...prev, supabase, gemini }));
    });
    setCloudConnected((prev) => ({ ...prev, sheets: isGoogleSheetsConfigured() }));

    const handleStorageChange = () => {
      reloadData().catch((err) => console.error('Storage 리로드 실패:', err));
    };
    const handleSessionExpired = () => {
      logout();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('session-expired', handleSessionExpired);
    };
  }, []);

  const mapCloudProject = (cp: any): Project => ({
    id: cp.id,
    title: cp.title,
    description: cp.description,
    questions: typeof cp.questions === 'string' ? JSON.parse(cp.questions) : cp.questions,
    selfEvalEnabled: cp.selfEvalEnabled,
    groups: typeof cp.groups === 'string' ? JSON.parse(cp.groups) : (cp.groups || []),
    active: cp.active,
    createdAt: cp.createdAt,
    accessCode: cp.accessCode,
    rosterId: cp.roster_id || 'roster-default',
  });

  const mapCloudStudent = (cs: any): Student => ({
    id: cs.id,
    grade: cs.grade,
    classNum: cs.classNum,
    number: cs.number,
    name: cs.name,
    email: cs.email,
    rosterId: cs.roster_id || 'roster-default',
  });

  const mapCloudEvaluation = (ce: any): Evaluation => ({
    id: ce.id,
    projectId: ce.project_id || ce.projectId,
    evaluatorId: ce.evaluator_id || ce.evaluatorId,
    evaluateeId: ce.evaluatee_id || ce.evaluateeId,
    answers: typeof ce.answers === 'string' ? JSON.parse(ce.answers) : ce.answers,
    aiFeedback: ce.ai_feedback || ce.aiFeedback,
    submittedAt: ce.submitted_at || ce.submittedAt,
  });

  const reloadTeacherData = async (email: string) => {
    let loadedStudents = mockStorage.getStudents(email);
    let loadedProjects = mockStorage.getProjects(email);
    let loadedEvaluations = mockStorage.getEvaluations(email);
    let loadedRosters = mockStorage.getRosters(email);

    if (cloudConnected.supabase) {
      try {
        const cloudRosters = await fetchRosters();
        if (cloudRosters.length > 0) {
          loadedRosters = cloudRosters.map((cr: any) => ({ id: cr.id, name: cr.name, createdAt: cr.createdAt }));
        } else if (loadedRosters.length > 0) {
          // 클라우드에 rosters가 없고 로컬에는 있는 경우 백업 업로드
          syncRosters(loadedRosters);
        }

        const cloudProjs = await fetchProjects();
        if (cloudProjs.length > 0) loadedProjects = cloudProjs.map(mapCloudProject);

        const cloudStudents = await fetchStudents();
        if (cloudStudents.length > 0) loadedStudents = cloudStudents.map(mapCloudStudent);

        const cloudEvals = await fetchEvaluations();
        if (cloudEvals.length > 0) loadedEvaluations = cloudEvals.map(mapCloudEvaluation);
      } catch (err) {
        console.error('클라우드 데이터 로드 실패:', err);
      }
    }

    setStudents(loadedStudents);
    setProjects(loadedProjects);
    setEvaluations(loadedEvaluations);
    setRosters(loadedRosters);

    if (loadedRosters.length > 0) {
      setSelectedRosterId((prev) => (loadedRosters.some((r) => r.id === prev) ? prev : loadedRosters[0].id));
    } else {
      setSelectedRosterId('');
    }
  };

  const reloadStudentData = async (teacherEmail: string, currentProjectId?: string) => {
    let loadedStudents = mockStorage.getStudents(teacherEmail);
    let loadedProjects = mockStorage.getProjects(teacherEmail);
    let loadedEvaluations = mockStorage.getEvaluations(teacherEmail);

    if (cloudConnected.supabase) {
      try {
        const { project, students: cloudStudents } = await fetchStudentContext();
        if (!project) {
          logout();
          return;
        }
        loadedProjects = [mapCloudProject(project)];
        if (cloudStudents?.length > 0) loadedStudents = cloudStudents.map(mapCloudStudent);

        const cloudEvals = await fetchEvaluations();
        loadedEvaluations = cloudEvals.map(mapCloudEvaluation);
      } catch (err) {
        console.error('클라우드 데이터 로드 실패:', err);
      }
    }

    if (currentProjectId && !loadedProjects.some((p) => p.id === currentProjectId)) {
      logout();
      return;
    }

    setStudents(loadedStudents);
    setProjects(loadedProjects);
    setEvaluations(loadedEvaluations);
    setRosters([]);
    setSelectedRosterId('');
  };

  const reloadData = async () => {
    if (user?.role === 'teacher') {
      const email = getTeacherEmail();
      if (!email) return;
      await reloadTeacherData(email);
      return;
    }

    if (user?.role === 'student' && user.teacherEmail) {
      await reloadStudentData(user.teacherEmail, user.currentProjectId);
      return;
    }

    setStudents([]);
    setProjects([]);
    setEvaluations([]);
    setRosters([]);
    setSelectedRosterId('');
  };

  // Reload data dynamically whenever user session changes (Data Isolation)
  useEffect(() => {
    reloadData();
  }, [user, cloudConnected.supabase]);

  const loginAsStudentWithCode = async (
    accessCode: string,
    grade: string,
    classNum: string,
    number: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const session = await apiLoginStudent(accessCode.trim(), grade.trim(), classNum.trim(), number.trim(), name.trim());
      setSession(session);
      setUser({
        role: 'student',
        studentInfo: session.studentInfo,
        currentProjectId: session.projectId,
        teacherEmail: session.teacherEmail,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '로그인에 실패했습니다.' };
    }
  };

  const loginAsTeacher = async (googleIdToken: string): Promise<{ success: boolean; error?: string }> => {
    let session;
    try {
      session = await apiLoginTeacher(googleIdToken);
    } catch (err: any) {
      return { success: false, error: err.message || '구글 로그인에 실패했습니다.' };
    }

    const { email, name } = session;
    const cleanEmail = email.trim().toLowerCase();

    // Automatic Migration: Copy pre-login storage data to teacher-specific keys if they are empty
    const userProjectKey = `peer_eval_projects_${cleanEmail}`;
    const userStudentKey = `peer_eval_students_${cleanEmail}`;
    const userEvalKey = `peer_eval_evaluations_${cleanEmail}`;
    const userRosterKey = `peer_eval_rosters_${cleanEmail}`;

    if (!localStorage.getItem(userProjectKey)) {
      const oldProjects = localStorage.getItem('peer_eval_projects');
      if (oldProjects) {
        localStorage.setItem(userProjectKey, oldProjects);
      }
    }
    if (!localStorage.getItem(userStudentKey)) {
      const oldStudents = localStorage.getItem('peer_eval_students');
      if (oldStudents) {
        localStorage.setItem(userStudentKey, oldStudents);
      }
    }
    if (!localStorage.getItem(userEvalKey)) {
      const oldEvals = localStorage.getItem('peer_eval_evaluations');
      if (oldEvals) {
        localStorage.setItem(userEvalKey, oldEvals);
      }
    }

    // [Roster Migration] rosters 키가 없는 교사 계정의 경우 마이그레이션 수행
    if (!localStorage.getItem(userRosterKey)) {
      const oldRosters = localStorage.getItem('peer_eval_rosters');
      if (oldRosters) {
        localStorage.setItem(userRosterKey, oldRosters);
      } else {
        // 기존 명단들을 Roster-default ('기본 명단')로 통합 바인딩
        const defaultRoster = [{
          id: 'roster-default',
          name: '기본 명단',
          createdAt: new Date().toISOString()
        }];
        localStorage.setItem(userRosterKey, JSON.stringify(defaultRoster));

        // 학생 데이터에 rosterId: 'roster-default' 주입
        const currentStuds = localStorage.getItem(userStudentKey);
        if (currentStuds) {
          try {
            const parsed = JSON.parse(currentStuds);
            const migrated = parsed.map((s: any) => ({
              ...s,
              rosterId: s.rosterId || 'roster-default'
            }));
            localStorage.setItem(userStudentKey, JSON.stringify(migrated));
          } catch(e) {}
        }

        // 프로젝트 데이터에 rosterId: 'roster-default' 주입
        const currentProjs = localStorage.getItem(userProjectKey);
        if (currentProjs) {
          try {
            const parsed = JSON.parse(currentProjs);
            const migrated = parsed.map((p: any) => ({
              ...p,
              rosterId: p.rosterId || 'roster-default'
            }));
            localStorage.setItem(userProjectKey, JSON.stringify(migrated));
          } catch(e) {}
        }
      }
    }

    setSession(session);
    const loggedUser: User = { role: 'teacher', teacherInfo: { email, name } };
    setUser(loggedUser);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setStudents([]);
    setProjects([]);
    setEvaluations([]);
    setRosters([]);
    setSelectedRosterId('');
    clearSession();
  };

  const uploadStudents = (rosterStudents: Student[]) => {
    const email = getTeacherEmail();
    if (!selectedRosterId) return;

    // 현재 관리중인 명단 그룹(rosterId)을 강제로 맵핑
    const updatedRosterStudents = rosterStudents.map(s => ({
      ...s,
      rosterId: selectedRosterId
    }));

    // 다른 명단 그룹에 속한 기존 학생들을 보존
    const otherStudents = students.filter(s => s.rosterId !== selectedRosterId);
    const allStudents = [...otherStudents, ...updatedRosterStudents];

    setStudents(allStudents);
    mockStorage.saveStudents(allStudents, email);
    
    // Cloud Sync if configured
    if (cloudConnected.supabase && email) {
      syncStudents(allStudents);
    }
  };

  const createProject = (
    title: string,
    description: string,
    questions: Question[],
    selfEvalEnabled: boolean,
    rosterId: string
  ) => {
    const email = getTeacherEmail();
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newProject: Project = {
      id: `p-${Date.now()}`,
      title,
      description,
      questions,
      selfEvalEnabled,
      rosterId, // rosterId 추가
      groups: [],
      active: true,
      createdAt: new Date().toISOString(),
      accessCode,
    };
    const updated = [newProject, ...projects];
    setProjects(updated);
    mockStorage.saveProjects(updated, email);

    // Cloud Sync if configured
    if (cloudConnected.supabase && email) {
      syncProject(newProject);
    }
  };

  const updateProject = (
    projectId: string,
    title: string,
    description: string,
    questions: Question[],
    selfEvalEnabled: boolean,
    rosterId: string,
    groups?: Group[]
  ) => {
    const email = getTeacherEmail();
    const updated = projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            title,
            description,
            questions,
            selfEvalEnabled,
            rosterId,
            groups: groups !== undefined ? groups : p.groups
          }
        : p
    );
    setProjects(updated);
    mockStorage.saveProjects(updated, email);

    // Cloud Sync if configured
    if (cloudConnected.supabase && email) {
      const targetProj = updated.find((p) => p.id === projectId);
      if (targetProj) {
        syncProject(targetProj);
      }
    }
  };

  const updateProjectGroups = (projectId: string, groups: Group[]) => {
    const email = getTeacherEmail();
    const updated = projects.map((p) => (p.id === projectId ? { ...p, groups } : p));
    setProjects(updated);
    mockStorage.saveProjects(updated, email);

    // Cloud Sync if configured
    if (cloudConnected.supabase && email) {
      const targetProj = updated.find(p => p.id === projectId);
      if (targetProj) {
        syncProject(targetProj);
      }
    }
  };

  // 명단 그룹(Roster) 생성 및 저장 기능 추가
  const createRoster = (name: string) => {
    const email = getTeacherEmail();
    const newRoster: Roster = {
      id: `roster-${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString()
    };
    const updated = [...rosters, newRoster];
    setRosters(updated);
    mockStorage.saveRosters(updated, email);
    setSelectedRosterId(newRoster.id);

    if (cloudConnected.supabase && email) {
      syncRosters(updated);
    }
  };

  // 명단 그룹(Roster) 삭제 기능 추가 (소속 학생 동시 영구 삭제)
  const deleteRoster = (id: string) => {
    const email = getTeacherEmail();
    const targetRoster = rosters.find(r => r.id === id);
    if (!targetRoster) return;

    if (confirm(`⚠️ [${targetRoster.name}] 학급 명단 그룹을 삭제하시겠습니까?\n해당 학급에 소속된 모든 학생 명단 데이터도 함께 영구 삭제됩니다.`)) {
      const updatedRosters = rosters.filter(r => r.id !== id);
      setRosters(updatedRosters);
      mockStorage.saveRosters(updatedRosters, email);

      const remainingStudents = students.filter(s => s.rosterId !== id);
      setStudents(remainingStudents);
      mockStorage.saveStudents(remainingStudents, email);

      if (updatedRosters.length > 0) {
        setSelectedRosterId(updatedRosters[0].id);
      } else {
        setSelectedRosterId('');
      }

      if (cloudConnected.supabase && email) {
        syncRosters(updatedRosters);
        syncStudents(remainingStudents);
      }
    }
  };

  const deleteProject = (projectId: string) => {
    const email = getTeacherEmail();
    const updated = projects.filter((p) => p.id !== projectId);
    setProjects(updated);
    mockStorage.saveProjects(updated, email);

    // Cloud Sync: Delete from Supabase DB if configured
    if (cloudConnected.supabase) {
      deleteProjectApi(projectId);
    }
  };

  const toggleProjectStatus = (projectId: string) => {
    const email = getTeacherEmail();
    const updated = projects.map((p) => (p.id === projectId ? { ...p, active: !p.active } : p));
    setProjects(updated);
    mockStorage.saveProjects(updated, email);

    // Cloud Sync: Update in Supabase DB if configured
    if (cloudConnected.supabase && email) {
      const targetProj = updated.find((p) => p.id === projectId);
      if (targetProj) {
        syncProject(targetProj);
      }
    }
  };

  const submitEvaluation = async (
    projectId: string,
    evaluatorId: string,
    evaluateeId: string,
    answers: { [questionId: string]: string | number }
  ) => {
    // Determine the target teacher space (for local mockStorage namespacing only —
    // the server derives the authoritative scope from the caller's session token)
    const targetTeacherEmail = getTeacherEmail() || user?.teacherEmail;

    const evaluator = students.find(s => s.id === evaluatorId);
    const evaluatee = students.find(s => s.id === evaluateeId);
    const projectObj = projects.find(p => p.id === projectId);

    if (!evaluator || !evaluatee || !projectObj) {
      alert(`평가 데이터 누락 감지!\n- 평가자: ${evaluator ? '찾음' : '못찾음'}\n- 피평가자: ${evaluatee ? '찾음' : '못찾음'}\n- 프로젝트: ${projectObj ? '찾음' : '못찾음'}`);
      return;
    }

    // 1. 실시간 개별 AI 피드백 생성은 생략합니다. (교사가 일괄 종합 총평 생성)
    const aiText = '';

    // 2. Save locally with AI Feedback into the correct isolated space
    mockStorage.saveEvaluation({
      projectId,
      evaluatorId,
      evaluateeId,
      answers,
      aiFeedback: aiText
    }, targetTeacherEmail);

    setEvaluations(mockStorage.getEvaluations(targetTeacherEmail));

    // 3. Sync to Supabase DB if configured (server does delete-then-insert internally)
    if (cloudConnected.supabase) {
      await submitEvaluationApi({ projectId, evaluatorId, evaluateeId, answers, aiFeedback: aiText });
    }

    // 4. Sync to Google Sheets if configured
    if (cloudConnected.sheets) {
      const mappedAnswers = projectObj.questions.map(q => String(answers[q.id] || ''));
      appendEvaluationToSheet({
        evaluatorName: `${evaluator.grade}학년 ${evaluator.classNum}반 ${evaluator.name}`,
        evaluateeName: `${evaluatee.grade}학년 ${evaluatee.classNum}반 ${evaluatee.name}`,
        answers: [...mappedAnswers, aiText],
        submittedAt: new Date().toLocaleString('ko-KR')
      });
    }
  };

  const generateAndSaveAITotalFeedback = async (projectId: string, evaluateeId: string) => {
    const targetTeacherEmail = getTeacherEmail() || user?.teacherEmail;

    const projectObj = projects.find(p => p.id === projectId);
    const evaluatee = students.find(s => s.id === evaluateeId);
    if (!projectObj || !evaluatee) return;

    // 해당 프로젝트의 해당 피평가자에 대한 모든 평가 수집 (자기 평가 및 동료 평가 포함, evaluatorId가 'AI_SUMMARY' 인 것은 제외)
    // Supabase 데이터와 로컬 데이터 갱신을 확실히 하기 위해 전체 평가 리스트 필터링
    const targetEvals = evaluations.filter(
      (e) => e.projectId === projectId && e.evaluateeId === evaluateeId && e.evaluatorId !== 'AI_SUMMARY'
    );

    // AI 종합 총평 생성 (자기 평가와 동료 평가를 구분하여 감안)
    const aiTotalText = await fetchGeminiFeedback({
      projectTitle: projectObj.title,
      questions: projectObj.questions,
      evaluateeName: evaluatee.name,
      evaluations: targetEvals,
      students,
    });

    // AI_SUMMARY 라는 가상의 평가자로 결과를 evaluations에 저장
    mockStorage.saveEvaluation({
      projectId,
      evaluatorId: 'AI_SUMMARY',
      evaluateeId,
      answers: {},
      aiFeedback: aiTotalText
    }, targetTeacherEmail);

    setEvaluations(mockStorage.getEvaluations(targetTeacherEmail));

    // Supabase DB 동기화 (server does delete-then-insert internally)
    if (cloudConnected.supabase) {
      await submitEvaluationApi({
        projectId,
        evaluatorId: 'AI_SUMMARY',
        evaluateeId,
        answers: {},
        aiFeedback: aiTotalText,
      });
    }

    // Google Sheets 동기화
    if (cloudConnected.sheets) {
      appendEvaluationToSheet({
        evaluatorName: 'AI 종합 시스템',
        evaluateeName: `${evaluatee.grade}학년 ${evaluatee.classNum}반 ${evaluatee.name}`,
        answers: [...projectObj.questions.map(() => ''), aiTotalText],
        submittedAt: new Date().toLocaleString('ko-KR')
      });
    }
  };

  const resetAll = () => {
    const email = getTeacherEmail();
    mockStorage.resetAllData(email);
    setStudents(mockStorage.getStudents(email));
    setProjects(mockStorage.getProjects(email));
    setEvaluations([]);

    // Cloud Sync: Wipe this teacher's cloud DB data only if configured
    if (cloudConnected.supabase && email) {
      resetAllApi();
    }

    logout();
  };

  return (
    <AppContext.Provider
      value={{
        user,
        students,
        projects,
        evaluations,
        rosters,
        selectedRosterId,
        setSelectedRosterId,
        createRoster,
        deleteRoster,
        cloudConnected,
        loginAsStudentWithCode,
        loginAsTeacher,
        logout,
        uploadStudents,
        createProject,
        updateProject,
        updateProjectGroups,
        deleteProject,
        toggleProjectStatus,
        submitEvaluation,
        generateAndSaveAITotalFeedback,
        resetAll,
        reloadData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
