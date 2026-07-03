export interface Student {
  id: string;
  grade: string;
  classNum: string;
  number: string;
  name: string;
  email: string;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Question {
  id: string;
  type: 'rating' | 'slider' | 'text';
  questionText: string;
  required: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string;
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
  answers: { [questionId: string]: string | number };
  aiFeedback?: string;
  submittedAt: string;
}

const STORAGE_KEYS = {
  STUDENTS: 'peer_eval_students',
  PROJECTS: 'peer_eval_projects',
  EVALUATIONS: 'peer_eval_evaluations',
};

// Initial Demo Data
const DEMO_STUDENTS: Student[] = [
  { id: '1', grade: '3', classNum: '1', number: '1', name: '김철수', email: 'chulsoo@gmail.com' },
  { id: '2', grade: '3', classNum: '1', number: '2', name: '이영희', email: 'younghee@gmail.com' },
  { id: '3', grade: '3', classNum: '1', number: '3', name: '박민수', email: 'minsoo@gmail.com' },
  { id: '4', grade: '3', classNum: '1', number: '4', name: '최지우', email: 'jiwoo@gmail.com' },
  { id: '5', grade: '3', classNum: '1', number: '5', name: '정다은', email: 'daeun@gmail.com' },
  { id: '6', grade: '3', classNum: '1', number: '6', name: '한지원', email: 'jiwon@gmail.com' },
  { id: '7', grade: '3', classNum: '1', number: '7', name: '윤도현', email: 'dohyun@gmail.com' },
  { id: '8', grade: '3', classNum: '1', number: '8', name: '강하늘', email: 'haneul@gmail.com' },
  { id: '9', grade: '3', classNum: '1', number: '9', name: '조세호', email: 'seho@gmail.com' },
  { id: '10', grade: '3', classNum: '1', number: '10', name: '임윤아', email: 'yoona@gmail.com' },
  { id: '11', grade: '3', classNum: '1', number: '11', name: '송중기', email: 'joongki@gmail.com' },
  { id: '12', grade: '3', classNum: '1', number: '12', name: '배수지', email: 'suzy@gmail.com' },
];

const DEMO_PROJECTS: Project[] = [
  {
    id: 'demo-p1',
    title: '과학 탐구 실험 모둠 프로젝트 상호평가',
    description: '모둠별 탐구 실험 및 보고서 작성에 대한 기여도를 공정하게 평가해주세요.',
    selfEvalEnabled: true,
    active: true,
    createdAt: new Date().toISOString(),
    accessCode: '123456',
    groups: [
      { id: 'g1', name: '1모둠 (물리 탐구)', memberIds: ['1', '2', '3', '4'] },
      { id: 'g2', name: '2모둠 (화학 탐구)', memberIds: ['5', '6', '7', '8'] },
      { id: 'g3', name: '3모둠 (생명 탐구)', memberIds: ['9', '10', '11', '12'] },
    ],
    questions: [
      {
        id: 'q1',
        type: 'rating',
        questionText: '이 모둠원은 프로젝트 수행 과정에서 자신의 역할을 책임감 있게 수행했습니까?',
        required: true,
      },
      {
        id: 'q2',
        type: 'slider',
        questionText: '이 모둠원의 전반적인 기여도는 백분율(%)로 환산 시 어느 정도입니까?',
        required: true,
      },
      {
        id: 'q3',
        type: 'text',
        questionText: '이 모둠원의 가장 뛰어났던 점이나 보완할 점을 자유롭게 기술해주세요.',
        required: false,
      },
    ],
  },
];

export const mockStorage = {
  getKey(baseKey: string, email?: string): string {
    return email ? `${baseKey}_${email.trim().toLowerCase()}` : baseKey;
  },

  getStudents(email?: string): Student[] {
    const key = this.getKey(STORAGE_KEYS.STUDENTS, email);
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify(DEMO_STUDENTS));
      return DEMO_STUDENTS;
    }
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
      localStorage.setItem(key, JSON.stringify(DEMO_PROJECTS));
      return DEMO_PROJECTS;
    }
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

  resetAllData(email?: string): void {
    const keyStudents = this.getKey(STORAGE_KEYS.STUDENTS, email);
    const keyProjects = this.getKey(STORAGE_KEYS.PROJECTS, email);
    const keyEvals = this.getKey(STORAGE_KEYS.EVALUATIONS, email);

    localStorage.setItem(keyStudents, JSON.stringify(DEMO_STUDENTS));
    localStorage.setItem(keyProjects, JSON.stringify(DEMO_PROJECTS));
    localStorage.removeItem(keyEvals);
  },
};
