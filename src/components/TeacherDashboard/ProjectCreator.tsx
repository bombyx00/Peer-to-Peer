import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Question } from '../../services/mockStorage';
import { Plus, Trash2, Calendar, FileText, Settings } from 'lucide-react';

const getDefaultPlaceholder = (type: 'rating' | 'slider' | 'text') => {
  const defaultTexts = {
    rating: '이 모둠원은 역할을 책임감 있게 수행했습니까?',
    slider: '이 모둠원의 전반적인 기여도는 몇 %입니까?',
    text: '이 모둠원의 가장 뛰어났던 점이나 보완할 점을 자유롭게 기술해주세요.',
  };
  return defaultTexts[type];
};

export const ProjectCreator: React.FC = () => {
  const { projects, createProject, deleteProject, toggleProjectStatus } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selfEvalEnabled, setSelfEvalEnabled] = useState(true);
  
  const [questions, setQuestions] = useState<Question[]>([
    { id: 'q-1', type: 'rating', questionText: '', required: true },
    { id: 'q-2', type: 'slider', questionText: '', required: true },
  ]);

  const addQuestion = (type: 'rating' | 'slider' | 'text') => {
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      type,
      questionText: '',
      required: true,
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const updateQuestionText = (id: string, text: string) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, questionText: text } : q)));
  };

  const updateQuestionRequired = (id: string, required: boolean) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, required } : q)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('프로젝트 제목을 입력해주세요.');
      return;
    }
    if (questions.length === 0) {
      alert('최소 1개 이상의 평가 문항을 추가해주세요.');
      return;
    }

    const finalQuestions = questions.map((q) => {
      if (!q.questionText.trim()) {
        return { ...q, questionText: getDefaultPlaceholder(q.type) };
      }
      return q;
    });

    createProject(title, description, finalQuestions, selfEvalEnabled);
    setTitle('');
    setDescription('');
    setQuestions([
      { id: 'q-1', type: 'rating', questionText: '', required: true },
      { id: 'q-2', type: 'slider', questionText: '', required: true },
    ]);
    alert('새 프로젝트가 생성되었습니다. 모둠 배정 탭으로 가셔서 모둠을 구성해주세요.');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
      {/* Left side: Create form */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={20} color="var(--primary)" />
          새 상호평가 프로젝트 설계
        </h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              프로젝트 제목
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="예: 2026학년도 1학기 과학 실험 모둠 상호평가"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              설명 및 학생 안내 문구
            </label>
            <textarea
              className="glass-input"
              style={{ minHeight: '60px', resize: 'vertical' }}
              placeholder="학생들에게 보여질 평가 설명이나 안내 메시지를 작성하세요."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              id="selfEval"
              checked={selfEvalEnabled}
              onChange={(e) => setSelfEvalEnabled(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="selfEval" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              자기 평가 포함 (본인 자신에 대한 평가도 문항에 포함하여 제출하도록 설정)
            </label>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '10px 0' }} />

          {/* Questions designer */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label style={{ fontSize: '16px', fontWeight: 700 }}>평가 문항 설계 ({questions.length})</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => addQuestion('rating')}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <Plus size={14} /> 별점 문항
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion('slider')}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <Plus size={14} /> 슬라이더 문항
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion('text')}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <Plus size={14} /> 서술 문항
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.3)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                      문항 {idx + 1} - {q.type === 'rating' ? '⭐ 별점 척도' : q.type === 'slider' ? '📊 백분율 슬라이더' : '✍️ 서술형 의견'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    className="glass-input"
                    value={q.questionText}
                    onChange={(e) => updateQuestionText(q.id, e.target.value)}
                    placeholder={getDefaultPlaceholder(q.type)}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id={`req-${q.id}`}
                      checked={q.required}
                      onChange={(e) => updateQuestionRequired(q.id, e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor={`req-${q.id}`} style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      필수 응답 문항 설정
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px', fontSize: '15px' }}>
            프로젝트 최종 등록
          </button>
        </form>
      </div>

      {/* Right side: Projects list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>진행 중인 평가 목록</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                아직 생성된 프로젝트가 없습니다.
              </div>
            ) : (
              projects.map((proj) => (
                <div
                  key={proj.id}
                  style={{
                    background: proj.active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.03)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: proj.active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {proj.title}
                    </h4>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 600,
                      background: proj.active ? 'var(--success-light)' : 'rgba(0,0,0,0.06)',
                      color: proj.active ? 'var(--success)' : 'var(--text-muted)'
                    }}>
                      {proj.active ? '활성' : '비활성'}
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', minHeight: '32px' }}>
                    {proj.description || '상세 설명 없음'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={12} /> 문항 {proj.questions.length}개
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> 생성 {new Date(proj.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => toggleProjectStatus(proj.id)}
                      className="btn"
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        fontSize: '11px',
                        background: proj.active ? 'rgba(0,0,0,0.05)' : 'var(--primary-light)',
                        color: proj.active ? 'var(--text-secondary)' : 'var(--primary)',
                        border: 'none',
                        borderRadius: '8px'
                      }}
                    >
                      {proj.active ? '평가 종료' : '평가 개시'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('이 프로젝트와 관련된 모든 평가 데이터가 삭제됩니다. 정말 삭제하시겠습니까?')) {
                          deleteProject(proj.id);
                        }
                      }}
                      className="btn btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: 'var(--danger)',
                        background: 'transparent'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-light)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
