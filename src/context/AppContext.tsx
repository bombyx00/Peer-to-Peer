import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockStorage } from '../services/mockStorage';
import type { Student, Project, Group, Question, Evaluation } from '../services/mockStorage';
import { isSupabaseConfigured, syncStudentsToSupabase, syncProjectToSupabase, submitEvaluationToSupabase } from '../services/supabase';
import { isGoogleSheetsConfigured, appendEvaluationToSheet } from '../services/sheets';
import { isGeminiConfigured, generateAIFeedback } from '../services/gemini';

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
  ) => { success: boolean; error?: string };
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
  resetAll: () => void;
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

  // Check cloud connection only on mount
  useEffect(() => {
    setCloudConnected({
      supabase: isSupabaseConfigured(),
      sheets: isGoogleSheetsConfigured(),
      gemini: isGeminiConfigured()
    });
  }, []);

  // Reload data dynamically whenever user session changes (Data Isolation)
  useEffect(() => {
    const email = getTeacherEmail();
    setStudents(mockStorage.getStudents(email));
    setProjects(mockStorage.getProjects(email));
    setEvaluations(mockStorage.getEvaluations(email));
  }, [user]);

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

  const loginAsStudentWithCode = (
    accessCode: string,
    grade: string,
    classNum: string,
    number: string,
    name: string
  ): { success: boolean; error?: string } => {
    // 1. Search projects across all local storage keys to find the project matching the access code
    let matchedProject: Project | undefined = undefined;
    let foundTeacherEmail: string | undefined = undefined;

    // Check currently loaded projects first
    matchedProject = projects.find((p) => p.active && p.accessCode === accessCode.trim());
    if (matchedProject) {
      foundTeacherEmail = getTeacherEmail();
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

    if (!matchedProject) {
      return { success: false, error: '유효하지 않거나 비활성화된 인증번호입니다.' };
    }

    // 2. Load the corresponding student list for that teacher's space to match the student details
    const targetStudents = mockStorage.getStudents(foundTeacherEmail);
    const found = targetStudents.find(
      (s) =>
        s.grade.trim() === grade.trim() &&
        s.classNum.trim() === classNum.trim() &&
        s.number.trim() === number.trim() &&
        s.name.trim() === name.trim()
    );

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
  };

  const toggleProjectStatus = (projectId: string) => {
    const email = getTeacherEmail();
    const updated = projects.map((p) => (p.id === projectId ? { ...p, active: !p.active } : p));
    setProjects(updated);
    mockStorage.saveProjects(updated, email);
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

    const targetStudents = mockStorage.getStudents(targetTeacherEmail);
    const targetProjects = mockStorage.getProjects(targetTeacherEmail);

    const evaluator = targetStudents.find(s => s.id === evaluatorId);
    const evaluatee = targetStudents.find(s => s.id === evaluateeId);
    const projectObj = targetProjects.find(p => p.id === projectId);

    if (!evaluator || !evaluatee || !projectObj) return;

    // 1. Generate AI Feedback (Gemini API or Local rule based)
    const aiText = await generateAIFeedback(
      projectObj.title,
      projectObj.questions,
      evaluator.name,
      evaluatee.name,
      answers
    );

    // 2. Save locally with AI Feedback into the correct isolated space
    mockStorage.saveEvaluation({
      projectId,
      evaluatorId,
      evaluateeId,
      answers,
      aiFeedback: aiText
    }, targetTeacherEmail);
    
    setEvaluations(mockStorage.getEvaluations(targetTeacherEmail));

    // 3. Sync to Supabase DB if configured
    if (cloudConnected.supabase) {
      submitEvaluationToSupabase({
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

  const resetAll = () => {
    const email = getTeacherEmail();
    mockStorage.resetAllData(email);
    setStudents(mockStorage.getStudents(email));
    setProjects(mockStorage.getProjects(email));
    setEvaluations([]);
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
        resetAll,
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
