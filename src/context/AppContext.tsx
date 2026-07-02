import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockStorage } from '../services/mockStorage';
import type { Student, Project, Group, Question, Evaluation } from '../services/mockStorage';
import { isSupabaseConfigured, syncStudentsToSupabase, syncProjectToSupabase, submitEvaluationToSupabase } from '../services/supabase';
import { isGoogleSheetsConfigured, appendEvaluationToSheet } from '../services/sheets';
import { isGeminiConfigured, generateAIFeedback } from '../services/gemini';

interface User {
  role: 'teacher' | 'student';
  studentInfo?: Student;
}

interface AppContextType {
  user: User | null;
  students: Student[];
  projects: Project[];
  evaluations: Evaluation[];
  cloudConnected: { supabase: boolean; sheets: boolean; gemini: boolean };
  loginAsStudent: (email: string) => boolean;
  loginAsTeacher: () => void;
  logout: () => void;
  uploadStudents: (students: Student[]) => void;
  createProject: (
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

  // Load initial data and check connection
  useEffect(() => {
    setStudents(mockStorage.getStudents());
    setProjects(mockStorage.getProjects());
    setEvaluations(mockStorage.getEvaluations());
    
    // Check if cloud environment variables are injected
    setCloudConnected({
      supabase: isSupabaseConfigured(),
      sheets: isGoogleSheetsConfigured(),
      gemini: isGeminiConfigured()
    });
  }, []);

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

  const loginAsTeacher = () => {
    const loggedUser: User = { role: 'teacher' };
    setUser(loggedUser);
    localStorage.setItem('peer_eval_current_user', JSON.stringify(loggedUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('peer_eval_current_user');
  };

  const uploadStudents = (newStudents: Student[]) => {
    setStudents(newStudents);
    mockStorage.saveStudents(newStudents);
    
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
    const newProject: Project = {
      id: `p-${Date.now()}`,
      title,
      description,
      questions,
      selfEvalEnabled,
      groups: [],
      active: true,
      createdAt: new Date().toISOString(),
    };
    const updated = [newProject, ...projects];
    setProjects(updated);
    mockStorage.saveProjects(updated);

    // Cloud Sync if configured
    if (cloudConnected.supabase) {
      syncProjectToSupabase(newProject);
    }
  };

  const updateProjectGroups = (projectId: string, groups: Group[]) => {
    const updated = projects.map((p) => (p.id === projectId ? { ...p, groups } : p));
    setProjects(updated);
    mockStorage.saveProjects(updated);

    // Cloud Sync if configured
    if (cloudConnected.supabase) {
      const targetProj = updated.find(p => p.id === projectId);
      if (targetProj) {
        syncProjectToSupabase(targetProj);
      }
    }
  };

  const deleteProject = (projectId: string) => {
    const updated = projects.filter((p) => p.id !== projectId);
    setProjects(updated);
    mockStorage.saveProjects(updated);
  };

  const toggleProjectStatus = (projectId: string) => {
    const updated = projects.map((p) => (p.id === projectId ? { ...p, active: !p.active } : p));
    setProjects(updated);
    mockStorage.saveProjects(updated);
  };

  const submitEvaluation = async (
    projectId: string,
    evaluatorId: string,
    evaluateeId: string,
    answers: { [questionId: string]: string | number }
  ) => {
    const evaluator = students.find(s => s.id === evaluatorId);
    const evaluatee = students.find(s => s.id === evaluateeId);
    const projectObj = projects.find(p => p.id === projectId);

    if (!evaluator || !evaluatee || !projectObj) return;

    // 1. Generate AI Feedback (Gemini API or Local rule based)
    const aiText = await generateAIFeedback(
      projectObj.title,
      projectObj.questions,
      evaluator.name,
      evaluatee.name,
      answers
    );

    // 2. Save locally with AI Feedback
    mockStorage.saveEvaluation({
      projectId,
      evaluatorId,
      evaluateeId,
      answers,
      aiFeedback: aiText
    });
    setEvaluations(mockStorage.getEvaluations());

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
      // Append AI feedback text to the last column
      appendEvaluationToSheet({
        evaluatorName: `${evaluator.grade}학년 ${evaluator.classNum}반 ${evaluator.name}`,
        evaluateeName: `${evaluatee.grade}학년 ${evaluatee.classNum}반 ${evaluatee.name}`,
        answers: [...mappedAnswers, aiText],
        submittedAt: new Date().toLocaleString('ko-KR')
      });
    }
  };

  const resetAll = () => {
    mockStorage.resetAllData();
    setStudents(mockStorage.getStudents());
    setProjects(mockStorage.getProjects());
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
        loginAsTeacher,
        logout,
        uploadStudents,
        createProject,
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
