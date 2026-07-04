export interface Roster {
  id: string;
  name: string; // 예: "3학년 1반", "3학년 2반"
  createdAt: string;
}

export interface Student {
  id: string;
  grade: string;
  classNum: string;
  number: string;
  name: string;
  email: string;
  rosterId: string; // 소속 명단 그룹 ID
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Question {
  id: string;
  type: 'rating' | 'slider' | 'text' | 'color' | 'choice-single' | 'choice-multiple';
  questionText: string;
  required: boolean;
  options?: string[]; // 객관식 보기 목록 (choice-single, choice-multiple 전용)
}

export interface Project {
  id: string;
  title: string;
  description: string;
  rosterId?: string; // 이 프로젝트의 평가 대상 명단 그룹 ID
  groups: Group[];
  questions: Question[];
  selfEvalEnabled: boolean;
  active: boolean;
  createdAt: string;
  accessCode: string;
}

export interface Evaluation {
  id: string;
  projectId: string;
  evaluatorId: string;
  evaluateeId: string;
  answers: { [questionId: string]: string | number | string[] }; // string[]은 복수선택용
  aiFeedback?: string;
  submittedAt: string;
}

const STORAGE_KEYS = {
  STUDENTS: 'peer_eval_students',
  PROJECTS: 'peer_eval_projects',
  EVALUATIONS: 'peer_eval_evaluations',
  ROSTERS: 'peer_eval_rosters',
};



export const mockStorage = {
  getKey(baseKey: string, email?: string): string {
    return email ? `${baseKey}_${email.trim().toLowerCase()}` : baseKey;
  },

  getStudents(email?: string): Student[] {
    const key = this.getKey(STORAGE_KEYS.STUDENTS, email);
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify([]));
      return [];
    }
    // Clean up stale demo data in unsuffixed/suffixed keys if any
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.some(s => s.id === '1' && s.name === '김철수')) {
        localStorage.setItem(key, JSON.stringify([]));
        return [];
      }
    } catch(e) {}
    return JSON.parse(data);
  },

  saveStudents(students: Student[], email?: string): void {
    const key = this.getKey(STORAGE_KEYS.STUDENTS, email);
    localStorage.setItem(key, JSON.stringify(students));
  },

  getProjects(email?: string): Project[] {
    const key = this.getKey(STORAGE_KEYS.PROJECTS, email);
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify([]));
      return [];
    }
    // Clean up stale demo data in unsuffixed/suffixed keys if any
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.some(p => p.id === 'demo-p1')) {
        localStorage.setItem(key, JSON.stringify([]));
        return [];
      }
    } catch(e) {}
    return JSON.parse(data);
  },

  saveProjects(projects: Project[], email?: string): void {
    const key = this.getKey(STORAGE_KEYS.PROJECTS, email);
    localStorage.setItem(key, JSON.stringify(projects));
  },

  getEvaluations(email?: string): Evaluation[] {
    const key = this.getKey(STORAGE_KEYS.EVALUATIONS, email);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  saveEvaluation(evaluation: Omit<Evaluation, 'id' | 'submittedAt'>, email?: string): void {
    const key = this.getKey(STORAGE_KEYS.EVALUATIONS, email);
    const evals = this.getEvaluations(email);
    const newEval: Evaluation = {
      ...evaluation,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      submittedAt: new Date().toISOString(),
    };
    
    const existingIndex = evals.findIndex(
      (e) =>
        e.projectId === evaluation.projectId &&
        e.evaluatorId === evaluation.evaluatorId &&
        e.evaluateeId === evaluation.evaluateeId
    );

    if (existingIndex > -1) {
      evals[existingIndex] = newEval;
    } else {
      evals.push(newEval);
    }
    localStorage.setItem(key, JSON.stringify(evals));
  },

  getRosters(email?: string): Roster[] {
    const key = this.getKey(STORAGE_KEYS.ROSTERS, email);
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify([]));
      return [];
    }
    return JSON.parse(data);
  },

  saveRosters(rosters: Roster[], email?: string): void {
    const key = this.getKey(STORAGE_KEYS.ROSTERS, email);
    localStorage.setItem(key, JSON.stringify(rosters));
  },

  resetAllData(email?: string): void {
    const keyStudents = this.getKey(STORAGE_KEYS.STUDENTS, email);
    const keyProjects = this.getKey(STORAGE_KEYS.PROJECTS, email);
    const keyEvals = this.getKey(STORAGE_KEYS.EVALUATIONS, email);
    const keyRosters = this.getKey(STORAGE_KEYS.ROSTERS, email);

    localStorage.setItem(keyStudents, JSON.stringify([]));
    localStorage.setItem(keyProjects, JSON.stringify([]));
    localStorage.setItem(keyRosters, JSON.stringify([]));
    localStorage.removeItem(keyEvals);
  },
};
