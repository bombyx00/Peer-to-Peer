import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Question, Project } from '../../services/mockStorage';
import { Plus, Trash2, Calendar, FileText, Settings, ChevronUp, ChevronDown, Edit } from 'lucide-react';

const getDefaultPlaceholder = (type: 'rating' | 'slider' | 'text') => {
  const defaultTexts = {
    rating: '이 모둠원은 역할을 책임감 있게 수행했습니까?',
    slider: '이 모둠원의 전반적인 기여도는 몇 %입니까?',
    text: '이 모둠원의 가장 뛰어났던 점이나 보완할 점을 자유롭게 기술해주세요.',
  };
  return defaultTexts[type];
};

export const ProjectCreator: React.FC = () => {
  const { projects, createProject, updateProject, deleteProject, toggleProjectStatus, rosters } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selfEvalEnabled, setSelfEvalEnabled] = useState(true);
  const [projectRosterId, setProjectRosterId] = useState('');
  
  const [questions, setQuestions] = useState<Question[]>([
    { id: 'q-1', type: 'rating', questionText: '', required: true },
    { id: 'q-2', type: 'slider', questionText: '', required: true },
  ]);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

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

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIndex];
    newQuestions[targetIndex] = temp;

    setQuestions(newQuestions);
  };

  const updateQuestionText = (id: string, text: string) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, questionText: text } : q)));
  };

  const updateQuestionRequired = (id: string, required: boolean) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, required } : q)));
  };

  const handleStartEdit = (project: Project) => {
    setEditingProjectId(project.id);
    setTitle(project.title);
    setDescription(project.description);
    setQuestions(project.questions);
    setSelfEvalEnabled(project.selfEvalEnabled);
    setProjectRosterId(project.rosterId || 'roster-default');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setTitle('');
    setDescription('');
    setQuestions([
      { id: 'q-1', type: 'rating', questionText: '', required: true },
      { id: 'q-2', type: 'slider', questionText: '', required: true },
    ]);
    setSelfEvalEnabled(true);
    setProjectRosterId('');
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

    const activeRosterId = projectRosterId || (rosters[0]?.id || 'roster-default');

    if (editingProjectId) {
      updateProject(editingProjectId, title, description, finalQuestions, selfEvalEnabled, activeRosterId);
      setEditingProjectId(null);
      alert('프로젝트 정보가 수정되었습니다.');
    } else {
      createProject(title, description, finalQuestions, selfEvalEnabled, activeRosterId);
      alert('새 프로젝트가 생성되었습니다. 모둠 배정 탭으로 가셔서 모둠을 구성해주세요.');
    }

    setTitle('');
    setDescription('');
    setQuestions([
      { id: 'q-1', type: 'rating', questionText: '', required: true },
      { id: 'q-2', type: 'slider', questionText: '', required: true },
    ]);
    setSelfEvalEnabled(true);
    setProjectRosterId('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    // Prevent accidental submit via Enter key except inside textareas where newline is expected
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
      {/* Left side: Create form */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '29px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-yeongwol)' }}>
          <Settings size={20} color="var(--primary)" />
          {editingProjectId ? '프로젝트 정보 수정' : '새 상호평가 프로젝트 설계'}
        </h3>

        {editingProjectId && (
          <div style={{
            background: 'var(--primary-light)',
            border: '1px solid rgba(79, 70, 229, 0.2)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
              🔧 프로젝트 수정 모드 진행 중
            </span>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px', background: 'transparent' }}
            >
              수정 취소
            </button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'var(--font-joseon)' }}>
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
            <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'var(--font-joseon)' }}>
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

          <div>
            <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'var(--font-joseon)' }}>
              기본 매핑 카테고리
            </label>
            <select
              className="glass-input"
              style={{ width: '100%' }}
              value={projectRosterId}
              onChange={(e) => setProjectRosterId(e.target.value)}
            >
              {rosters.length === 0 ? (
                <option value="roster-default">기본 명단 (미등록 상태)</option>
              ) : (
                rosters.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))
              )}
            </select>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-joseon)' }}>
              이 프로젝트에 참여하고 평가받을 기본 학생 명단 카테고리를 선택합니다. 명단은 [CSV 명단 등록] 탭에서 생성할 수 있습니다.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              id="selfEval"
              checked={selfEvalEnabled}
              onChange={(e) => setSelfEvalEnabled(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="selfEval" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-joseon)' }}>
              자기 평가 포함 (본인 자신에 대한 평가도 문항에 포함하여 제출하도록 설정)
            </label>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '10px 0' }} />

          {/* Questions designer */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label style={{ fontSize: '23px', fontFamily: 'var(--font-yeongwol)' }}>평가 문항 설계</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => addQuestion('rating')}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '13px', fontFamily: 'var(--font-joseon)' }}
                >
                  <Plus size={14} /> 별점 문항
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion('slider')}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '13px', fontFamily: 'var(--font-joseon)' }}
                >
                  <Plus size={14} /> 슬라이더 문항
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion('text')}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '13px', fontFamily: 'var(--font-joseon)' }}
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
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', fontFamily: 'var(--font-joseon)' }}>
                      문항 {idx + 1} - {q.type === 'rating' ? '⭐ 별점 척도' : q.type === 'slider' ? '📊 백분율 슬라이더' : '✍️ 서술형 의견'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => moveQuestion(idx, 'up')}
                        disabled={idx === 0}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: idx === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          padding: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          opacity: idx === 0 ? 0.3 : 1
                        }}
                        title="위로 이동"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(idx, 'down')}
                        disabled={idx === questions.length - 1}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: idx === questions.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                          cursor: idx === questions.length - 1 ? 'not-allowed' : 'pointer',
                          padding: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          opacity: idx === questions.length - 1 ? 0.3 : 1
                        }}
                        title="아래로 이동"
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(q.id)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                        title="문항 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
                    <label htmlFor={`req-${q.id}`} style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-joseon)' }}>
                      필수 응답 문항 설정
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px', fontSize: '22px', fontFamily: 'var(--font-yeongwol)' }}>
            {editingProjectId ? '프로젝트 정보 수정 완료' : '프로젝트 최종 등록'}
          </button>
        </form>
      </div>

      {/* Right side: Projects list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '26px', marginBottom: '16px', fontFamily: 'var(--font-yeongwol)' }}>진행 중인 평가 목록</h3>
          
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
                    <h4 style={{ fontSize: '22px', color: proj.active ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-yeongwol)' }}>
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
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(5, 150, 105, 0.08)', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      카테고리: {rosters.find(r => r.id === proj.rosterId)?.name || '기본 명단'}
                    </span>
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
                      onClick={() => handleStartEdit(proj)}
                      className="btn btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(79, 70, 229, 0.2)',
                        color: 'var(--primary)',
                        background: 'rgba(79, 70, 229, 0.05)',
                        borderRadius: '8px'
                      }}
                      title="프로젝트 수정"
                    >
                      <Edit size={14} />
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
                        background: 'transparent',
                        borderRadius: '8px'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-light)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      title="프로젝트 삭제"
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
