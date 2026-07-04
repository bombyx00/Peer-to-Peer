import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockStorage } from '../services/mockStorage';
import type { Student, Project, Group, Question, Evaluation } from '../services/mockStorage';
import { isSupabaseConfigured, syncStudentsToSupabase, syncProjectToSupabase, submitEvaluationToSupabase, fetchProjectByAccessCode, fetchStudentByDetails, deleteProjectFromSupabase, clearAllCloudData, fetchAllStudentsFromSupabase, fetchAllProjectsFromSupabase, fetchAllEvaluationsFromSupabase, deleteEvaluationFromSupabase } from '../services/supabase';
import { isGoogleSheetsConfigured, appendEvaluationToSheet } from '../services/sheets';
import { isGeminiConfigured, generateComprehensiveAIFeedback } from '../services/gemini';

interface User {
  role: 'teacher' | 'student';
  studentInfo?: Student;
  teacherInfo?: { email: string; name: string };
  currentProjectId?: string;
}

interface AppContextType {
  user: User | null;
  students: Student[];
  projects: Project[];
  evaluations: Evaluation[];
  cloudConnected: { supabase: boolean; sheets: boolean; gemini: boolean };
  loginAsStudent: (email: string) => boolean;
  loginAsStudentWithCode: (
    accessCode: string,
    grade: string,
    classNum: string,
    number: string,
    name: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginAsTeacher: (email: string, name: string) => void;
  logout: () => void;
  uploadStudents: (students: Student[]) => void;
  createProject: (
    title: string,
    description: string,
    questions: Question[],
    selfEvalEnabled: boolean
  ) => void;
  updateProject: (
    projectId: string,
    title: string,
    description: string,
    questions: Question[],
    selfEvalEnabled: boolean
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('peer_eval_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [cloudConnected, setCloudConnected] = useState({ supabase: false, sheets: false, gemini: false });

  // Get current logged-in teacher email helper
  const getTeacherEmail = (): string | undefined => {
    return user?.role === 'teacher' ? user.teacherInfo?.email : undefined;
  };

  // Helper to find which teacher's space a project belongs to in LocalStorage (for local multi-user testing)
  const findTeacherEmailByProjectId = (projectId: string): string | undefined => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('peer_eval_projects_')) {
        const email = key.replace('peer_eval_projects_', '');
        const projectsData = localStorage.getItem(key);
        if (projectsData) {
          try {
            const projs = JSON.parse(projectsData);
            if (projs.some((p: any) => p.id === projectId)) {
              return email;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    return undefined;
  };

  // Check cloud connection and register storage listener
  useEffect(() => {
    setCloudConnected({
      supabase: isSupabaseConfigured(),
      sheets: isGoogleSheetsConfigured(),
      gemini: isGeminiConfigured()
    });

    const handleStorageChange = () => {
      reloadData().catch((err) => console.error('Storage 리로드 실패:', err));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const reloadData = async () => {
    let email = getTeacherEmail();
    
    // If user is a student, determine which teacher space they belong to
    if (!email && user?.role === 'student' && user.currentProjectId) {
      email = findTeacherEmailByProjectId(user.currentProjectId);
    }
    
    let loadedStudents = mockStorage.getStudents(email);
    let loadedProjects = mockStorage.getProjects(email);
    let loadedEvaluations = mockStorage.getEvaluations(email);

    // If Supabase is configured, pull all active data from Cloud DB
    if (cloudConnected.supabase) {
      try {
        const cloudProjs = await fetchAllProjectsFromSupabase();
        if (cloudProjs.length > 0) {
          loadedProjects = cloudProjs.map((cp: any) => ({
            id: cp.id,
            title: cp.title,
            description: cp.description,
            questions: typeof cp.questions === 'string' ? JSON.parse(cp.questions) : cp.questions,
            selfEvalEnabled: cp.selfEvalEnabled,
            groups: typeof cp.groups === 'string' ? JSON.parse(cp.groups) : (cp.groups || []),
            active: cp.active,
            createdAt: cp.createdAt,
            accessCode: cp.accessCode,
          }));
        }

        const cloudStudents = await fetchAllStudentsFromSupabase();
        if (cloudStudents.length > 0) {
          loadedStudents = cloudStudents.map((cs: any) => ({
            id: cs.id,
            grade: cs.grade,
            classNum: cs.classNum,
            number: cs.number,
            name: cs.name,
            email: cs.email,
          }));
        }

        const cloudEvals = await fetchAllEvaluationsFromSupabase();
        if (cloudEvals.length > 0) {
          loadedEvaluations = cloudEvals.map((ce: any) => ({
            id: ce.id,
            projectId: ce.project_id || ce.projectId,
            evaluatorId: ce.evaluator_id || ce.evaluatorId,
            evaluateeId: ce.evaluatee_id || ce.evaluateeId,
            answers: typeof ce.answers === 'string' ? JSON.parse(ce.answers) : ce.answers,
            aiFeedback: ce.ai_feedback || ce.aiFeedback,
            submittedAt: ce.submitted_at || ce.submittedAt,
          }));
        }
      } catch (err) {
        console.error('Supabase 데이터 로드 실패:', err);
      }
    }

    // If student user logged in, verify project still exists
    if (user?.role === 'student' && user.currentProjectId) {
      const projectExists = loadedProjects.some(p => p.id === user.currentProjectId);
      if (!projectExists) {
        logout();
        return;
      }
    }

    setStudents(loadedStudents);
    setProjects(loadedProjects);
    setEvaluations(loadedEvaluations);
  };

  // Reload data dynamically whenever user session changes (Data Isolation)
  useEffect(() => {
    reloadData();
  }, [user, cloudConnected.supabase]);

  const loginAsStudent = (email: string): boolean => {
    const found = students.find((s) => s.email.trim().toLowerCase() === email.trim().toLowerCase());
    if (found) {
      const loggedUser: User = { role: 'student', studentInfo: found };
      setUser(loggedUser);
      localStorage.setItem('peer_eval_current_user', JSON.stringify(loggedUser));
      return true;
    }
    return false;
  };

  const loginAsStudentWithCode = async (
    accessCode: string,
    grade: string,
    classNum: string,
    number: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    // 1. Search projects across all local storage keys to find the project matching the access code
    let matchedProject: Project | undefined = undefined;
    let foundTeacherEmail: string | undefined = undefined;

    // Check currently loaded projects first
    matchedProject = projects.find((p) => p.active && p.accessCode === accessCode.trim());
    if (matchedProject) {
      foundTeacherEmail = getTeacherEmail() || findTeacherEmailByProjectId(matchedProject.id);
    } else {
      // Search all isolated storage slots
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('peer_eval_projects_')) {
          const email = key.replace('peer_eval_projects_', '');
          const projectsData = localStorage.getItem(key);
          if (projectsData) {
            try {
              const projs: Project[] = JSON.parse(projectsData);
              const foundProj = projs.find((p) => p.active && p.accessCode === accessCode.trim());
              if (foundProj) {
                matchedProject = foundProj;
                foundTeacherEmail = email;
                break;
              }
            } catch (e) {
              // Ignore
            }
          }
        }
      }
    }

    // 2. If not found locally but Supabase is configured, fetch from cloud DB!
    if (!matchedProject && cloudConnected.supabase) {
      const cloudProj = await fetchProjectByAccessCode(accessCode);
      if (cloudProj) {
        matchedProject = {
          id: cloudProj.id,
          title: cloudProj.title,
          description: cloudProj.description,
          questions: typeof cloudProj.questions === 'string' ? JSON.parse(cloudProj.questions) : cloudProj.questions,
          selfEvalEnabled: cloudProj.selfEvalEnabled,
          groups: typeof cloudProj.groups === 'string' ? JSON.parse(cloudProj.groups) : (cloudProj.groups || []),
          active: cloudProj.active,
          createdAt: cloudProj.createdAt,
          accessCode: cloudProj.accessCode,
        };
      }
    }

    if (!matchedProject) {
      return { success: false, error: '유효하지 않거나 비활성화된 인증번호입니다.' };
    }

    // 3. Load the corresponding student list for that teacher's space to match the student details
    const targetStudents = mockStorage.getStudents(foundTeacherEmail);
    let found = targetStudents.find(
      (s) =>
        s.grade.trim() === grade.trim() &&
        s.classNum.trim() === classNum.trim() &&
        s.number.trim() === number.trim() &&
        s.name.trim() === name.trim()
    );

    // 4. If not found in local student roster but Supabase is configured, fetch from cloud DB!
    if (!found && cloudConnected.supabase) {
      const cloudStudent = await fetchStudentByDetails(grade, classNum, number, name);
      if (cloudStudent) {
        found = {
          id: cloudStudent.id,
          grade: cloudStudent.grade,
          classNum: cloudStudent.classNum,
          number: cloudStudent.number,
          name: cloudStudent.name,
          email: cloudStudent.email,
        };
      }
    }

    if (found) {
      const loggedUser: User = {
        role: 'student',
        studentInfo: found,
        currentProjectId: matchedProject.id,
      };
      setUser(loggedUser);
      localStorage.setItem('peer_eval_current_user', JSON.stringify(loggedUser));
      return { success: true };
    }

    return { success: false, error: '등록된 학생 명단에서 일치하는 학생 정보를 찾을 수 없습니다.' };
  };

  const loginAsTeacher = (email: string, name: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Automatic Migration: Copy pre-login storage data to teacher-specific keys if they are empty
    const userProjectKey = `peer_eval_projects_${cleanEmail}`;
    const userStudentKey = `peer_eval_students_${cleanEmail}`;
    const userEvalKey = `peer_eval_evaluations_${cleanEmail}`;

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

    const loggedUser: User = { role: 'teacher', teacherInfo: { email, name } };
    setUser(loggedUser);
    localStorage.setItem('peer_eval_current_user', JSON.stringify(loggedUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('peer_eval_current_user');
  };

  const uploadStudents = (newStudents: Student[]) => {
    const email = getTeacherEmail();
    setStudents(newStudents);
    mockStorage.saveStudents(newStudents, email);
    
    // Cloud Sync if configured
    if (cloudConnected.supabase) {
      syncStudentsToSupabase(newStudents);
    }
  };

  const createProject = (
    title: string,
    description: string,
    questions: Question[],
    selfEvalEnabled: boolean
  ) => {
    const email = getTeacherEmail();
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newProject: Project = {
      id: `p-${Date.now()}`,
      title,
      description,
      questions,
      selfEvalEnabled,
      groups: [],
      active: true,
      createdAt: new Date().toISOString(),
      accessCode,
    };
    const updated = [newProject, ...projects];
    setProjects(updated);
    mockStorage.saveProjects(updated, email);

    // Cloud Sync if configured
    if (cloudConnected.supabase) {
      syncProjectToSupabase(newProject);
    }
  };

  const updateProject = (
    projectId: string,
    title: string,
    description: string,
    questions: Question[],
    selfEvalEnabled: boolean
  ) => {
    const email = getTeacherEmail();
    const updated = projects.map((p) =>
      p.id === projectId ? { ...p, title, description, questions, selfEvalEnabled } : p
    );
    setProjects(updated);
    mockStorage.saveProjects(updated, email);

    // Cloud Sync if configured
    if (cloudConnected.supabase) {
      const targetProj = updated.find((p) => p.id === projectId);
      if (targetProj) {
        syncProjectToSupabase(targetProj);
      }
    }
  };

  const updateProjectGroups = (projectId: string, groups: Group[]) => {
    const email = getTeacherEmail();
    const updated = projects.map((p) => (p.id === projectId ? { ...p, groups } : p));
    setProjects(updated);
    mockStorage.saveProjects(updated, email);

    // Cloud Sync if configured
    if (cloudConnected.supabase) {
      const targetProj = updated.find(p => p.id === projectId);
      if (targetProj) {
        syncProjectToSupabase(targetProj);
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
      deleteProjectFromSupabase(projectId);
    }
  };

  const toggleProjectStatus = (projectId: string) => {
    const email = getTeacherEmail();
    const updated = projects.map((p) => (p.id === projectId ? { ...p, active: !p.active } : p));
    setProjects(updated);
    mockStorage.saveProjects(updated, email);

    // Cloud Sync: Update in Supabase DB if configured
    if (cloudConnected.supabase) {
      const targetProj = updated.find((p) => p.id === projectId);
      if (targetProj) {
        syncProjectToSupabase(targetProj);
      }
    }
  };

  const submitEvaluation = async (
    projectId: string,
    evaluatorId: string,
    evaluateeId: string,
    answers: { [questionId: string]: string | number }
  ) => {
    // Determine the target teacher space
    let targetTeacherEmail = getTeacherEmail();
    if (!targetTeacherEmail) {
      targetTeacherEmail = findTeacherEmailByProjectId(projectId);
    }

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

    // 3. Sync to Supabase DB if configured (중복 방지를 위해 삭제 후 삽입)
    if (cloudConnected.supabase) {
      await deleteEvaluationFromSupabase(projectId, evaluatorId, evaluateeId);
      await submitEvaluationToSupabase({
        project_id: projectId,
        evaluator_id: evaluatorId,
        evaluatee_id: evaluateeId,
        answers: JSON.stringify(answers),
        ai_feedback: aiText,
        submitted_at: new Date().toISOString()
      });
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
    let targetTeacherEmail = getTeacherEmail();
    if (!targetTeacherEmail) {
      targetTeacherEmail = findTeacherEmailByProjectId(projectId);
    }

    const projectObj = projects.find(p => p.id === projectId);
    const evaluatee = students.find(s => s.id === evaluateeId);
    if (!projectObj || !evaluatee) return;

    // 해당 프로젝트의 해당 피평가자에 대한 모든 평가 수집 (자기 평가 및 동료 평가 포함, evaluatorId가 'AI_SUMMARY' 인 것은 제외)
    // Supabase 데이터와 로컬 데이터 갱신을 확실히 하기 위해 전체 평가 리스트 필터링
    const targetEvals = evaluations.filter(
      (e) => e.projectId === projectId && e.evaluateeId === evaluateeId && e.evaluatorId !== 'AI_SUMMARY'
    );

    // AI 종합 총평 생성 (자기 평가와 동료 평가를 구분하여 감안)
    const aiTotalText = await generateComprehensiveAIFeedback(
      projectObj.title,
      projectObj.questions,
      evaluatee.name,
      targetEvals,
      students
    );

    // AI_SUMMARY 라는 가상의 평가자로 결과를 evaluations에 저장
    mockStorage.saveEvaluation({
      projectId,
      evaluatorId: 'AI_SUMMARY',
      evaluateeId,
      answers: {},
      aiFeedback: aiTotalText
    }, targetTeacherEmail);

    setEvaluations(mockStorage.getEvaluations(targetTeacherEmail));

    // Supabase DB 동기화
    if (cloudConnected.supabase) {
      // 중복 방지를 위해 삭제 먼저 수행
      await deleteEvaluationFromSupabase(projectId, 'AI_SUMMARY', evaluateeId);
      await submitEvaluationToSupabase({
        project_id: projectId,
        evaluator_id: 'AI_SUMMARY',
        evaluatee_id: evaluateeId,
        answers: JSON.stringify({}),
        ai_feedback: aiTotalText,
        submitted_at: new Date().toISOString()
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

    // Cloud Sync: Wipe all cloud DB data if configured
    if (cloudConnected.supabase) {
      clearAllCloudData();
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
        cloudConnected,
        loginAsStudent,
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
