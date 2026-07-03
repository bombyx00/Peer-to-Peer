import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { Project, Group, Student } from '../services/mockStorage';
import { LogOut, Star, CheckCircle, HelpCircle, Save, Check } from 'lucide-react';

export const StudentEvaluation: React.FC = () => {
  const { user, students, projects, evaluations, submitEvaluation, logout } = useApp();
  
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [myGroup, setMyGroup] = useState<Group | null>(null);
  const [targets, setTargets] = useState<Student[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  
  // Local temporary draft state: { [targetId]: { [questionId]: value } }
  const [drafts, setDrafts] = useState<{ [targetId: string]: { [questionId: string]: any } }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');

  const me = user?.studentInfo;

  // Initialize Project and Group
  useEffect(() => {
    const activeProj = projects.find((p) => p.id === user?.currentProjectId) || 
                       projects.find((p) => p.active) || 
                       null;
    setActiveProject(activeProj);

    if (activeProj && me) {
      const group = activeProj.groups.find((g) => g.memberIds.includes(me.id)) || null;
      setMyGroup(group);

      if (group) {
        // Filter evaluation targets
        const list = students.filter((s) => {
          if (!group.memberIds.includes(s.id)) return false;
          // Skip me if self evaluation is disabled
          if (!activeProj.selfEvalEnabled && s.id === me.id) return false;
          return true;
        });
        setTargets(list);
        if (list.length > 0) {
          setSelectedTargetId(list[0].id);
        }
      }
    }
  }, [projects, students, me, user]);

  // Load existing evaluations as initial drafts
  useEffect(() => {
    if (activeProject && me && targets.length > 0) {
      const initialDrafts: typeof drafts = {};
      targets.forEach((target) => {
        const found = evaluations.find(
          (e) =>
            e.projectId === activeProject.id &&
            e.evaluatorId === me.id &&
            e.evaluateeId === target.id
        );
        if (found) {
          initialDrafts[target.id] = found.answers;
        } else {
          // Set defaults
          initialDrafts[target.id] = {};
          activeProject.questions.forEach((q) => {
            if (q.type === 'slider') {
              initialDrafts[target.id][q.id] = 50; // Default 50%
            }
          });
        }
      });
      setDrafts(initialDrafts);
    }
  }, [activeProject, targets, evaluations, me]);

  const handleValueChange = (targetId: string, questionId: string, value: any) => {
    setDrafts((prev) => ({
      ...prev,
      [targetId]: {
        ...prev[targetId],
        [questionId]: value,
      },
    }));
  };

  const handleSaveDraft = (targetId: string) => {
    if (!activeProject || !me) return;
    const targetAnswers = drafts[targetId] || {};
    
    // Save to AppContext (Mock API Storage)
    submitEvaluation(activeProject.id, me.id, targetId, targetAnswers);
    showTempMsg(`${students.find((s) => s.id === targetId)?.name} 학생에 대한 평가가 임시 저장되었습니다.`);
  };

  const showTempMsg = (msg: string) => {
    setSubmittedMessage(msg);
    setTimeout(() => setSubmittedMessage(''), 3000);
  };

  const handleFinalSubmitAll = () => {
    if (!activeProject || !me) return;

    // Check validation for all targets
    for (const target of targets) {
      const targetAnswers = drafts[target.id] || {};
      for (const q of activeProject.questions) {
        if (q.required && (targetAnswers[q.id] === undefined || targetAnswers[q.id] === '')) {
          setSelectedTargetId(target.id);
          alert(`${target.name} 학생의 필수 질문(${q.questionText})에 응답해주세요.`);
          return;
        }
      }
    }

    if (confirm('모든 평가를 최종 제출하시겠습니까? 제출 후에는 대시보드에 즉시 반영됩니다.')) {
      setSubmitting(true);
      
      // Save all drafts to global state
      const submitPromises = targets.map((target) => {
        const targetAnswers = drafts[target.id] || {};
        return submitEvaluation(activeProject.id, me.id, target.id, targetAnswers);
      });

      Promise.all(submitPromises)
        .then(() => {
          setSubmitting(false);
          alert('모든 상호평가 제출이 성공적으로 완료되었습니다. 수고하셨습니다!');
          logout();
        })
        .catch((err) => {
          setSubmitting(false);
          alert('평가 제출 중 오류가 발생했습니다. 다시 시도해 주세요.');
          console.error(err);
        });
    }
  };

  if (!me) return null;

  if (!activeProject) {
    return (
      <div className="container" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <HelpCircle size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>진행 중인 평가가 없습니다</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            현재 활성화된 상호평가 프로젝트가 없습니다. 교사의 안내가 있을 때까지 기다려주세요.
          </p>
          <button onClick={logout} className="btn btn-secondary" style={{ width: '100%' }}>
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (!myGroup) {
    return (
      <div className="container" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <HelpCircle size={48} color="var(--warning)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>배정된 모둠이 없습니다</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            {activeProject.title}에 소속 모둠이 편성되어 있지 않습니다. 교사에게 문의해주시기 바랍니다.
          </p>
          <button onClick={logout} className="btn btn-secondary" style={{ width: '100%' }}>
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  const selectedTarget = targets.find((t) => t.id === selectedTargetId);
  const selectedAnswers = drafts[selectedTargetId] || {};

  return (
    <div className="container" style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '80px' }}>
      {/* Header */}
      <header className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'var(--font-joseon)' }}>
            {myGroup.name}
          </span>
          <h2 style={{ fontSize: '22px', fontFamily: 'var(--font-yeongwol)' }}>
            {me.grade}학년 {me.classNum}반 {me.number}번 {me.name} (본인)
          </h2>
        </div>
        <button onClick={logout} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-joseon)' }}>
          <LogOut size={16} /> 로그아웃
        </button>
      </header>

      {/* Project Title Banner */}
      <div className="glass-panel" style={{ padding: '24px', background: 'var(--primary-light)', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
        <h3 style={{ fontSize: '22px', marginBottom: '8px', color: 'var(--primary)', fontFamily: 'var(--font-yeongwol)' }}>
          {activeProject.title}
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          {activeProject.description || '모둠원들의 협동심과 책임감, 기여도를 객관적이고 성실하게 평가해주세요.'}
        </p>
      </div>

      {submittedMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--success-light)',
          color: 'var(--success)',
          border: '1px solid rgba(16, 185, 129, 0.15)',
          padding: '10px 16px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
        }}>
          <Check size={16} />
          {submittedMessage}
        </div>
      )}

      {/* Evaluation Interface Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Side: Targets List */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', padding: '0 8px 8px 8px', borderBottom: '1px solid var(--glass-border)', fontFamily: 'var(--font-joseon)' }}>
            평가 대상 모둠원
          </h4>
          {targets.map((target) => {
            const isSelected = target.id === selectedTargetId;
            const completed = evaluations.some(
              (e) =>
                e.projectId === activeProject.id &&
                e.evaluatorId === me.id &&
                e.evaluateeId === target.id
            );

            return (
              <button
                key={target.id}
                onClick={() => setSelectedTargetId(target.id)}
                className="btn"
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: isSelected ? 'white' : 'transparent',
                  color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                  border: 'none',
                  boxShadow: isSelected ? 'var(--glass-shadow)' : 'none',
                  textAlign: 'left',
                  borderRadius: '10px'
                }}
              >
                <span>
                  {target.name} {target.id === me.id ? '(자기 평가)' : ''}
                </span>
                {completed && (
                  <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center' }}>
                    <CheckCircle size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Side: Questions Form */}
        {selectedTarget ? (
          <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
              <h3 style={{ fontSize: '22px', fontFamily: 'var(--font-yeongwol)' }}>
                {selectedTarget.name}에 대한 평가 {selectedTarget.id === me.id ? '(자기 평가)' : ''}
              </h3>
              <button
                onClick={() => handleSaveDraft(selectedTarget.id)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px', fontFamily: 'var(--font-joseon)' }}
              >
                <Save size={14} /> 임시 저장
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {activeProject.questions.map((q) => {
                const value = selectedAnswers[q.id];
                
                return (
                  <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '18px', fontFamily: 'var(--font-yeongwol)' }}>{q.questionText}</span>
                      {q.required && <span style={{ color: 'var(--danger)', fontSize: '14px' }}>*</span>}
                    </div>

                    {/* Question Type: Rating ⭐ */}
                    {q.type === 'rating' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleValueChange(selectedTargetId, q.id, star)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: '4px',
                              transition: 'transform 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                          >
                            <Star
                              size={28}
                              fill={star <= (value as number || 0) ? 'var(--warning)' : 'none'}
                              color={star <= (value as number || 0) ? 'var(--warning)' : '#cbd5e1'}
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Question Type: Slider 📊 */}
                    {q.type === 'slider' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={value !== undefined ? (value as number) : 50}
                            onChange={(e) => handleValueChange(selectedTargetId, q.id, parseInt(e.target.value))}
                            style={{ flex: 1, height: '6px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                          />
                          <span style={{ width: '45px', fontSize: '15px', fontWeight: 700, textAlign: 'right', color: 'var(--primary)' }}>
                            {value !== undefined ? value : 50}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-joseon)' }}>
                          <span>낮음 (기여 미흡)</span>
                          <span>보통</span>
                          <span>매우 높음 (주도적 기여)</span>
                        </div>
                      </div>
                    )}

                    {/* Question Type: Text ✍️ */}
                    {q.type === 'text' && (
                      <textarea
                        className="glass-input"
                        style={{ minHeight: '100px', resize: 'vertical' }}
                        placeholder="이 모둠원의 좋았던 행동이나 협업 능력을 구체적으로 기입해 주세요."
                        value={(value as string) || ''}
                        onChange={(e) => handleValueChange(selectedTargetId, q.id, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
              <button
                onClick={() => handleSaveDraft(selectedTarget.id)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-joseon)', fontSize: '14px' }}
              >
                <Save size={16} /> 이 모둠원 평가 임시저장
              </button>
            </div>

          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            평가할 학생을 선택해 주세요.
          </div>
        )}
      </div>

      {/* Final Submit Footer */}
      <footer className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-joseon)' }}>
          모든 모둠원에 대한 평가가 작성 및 임시 저장되었는지 반드시 확인한 후 제출해주시기 바랍니다.
        </div>
        <button
          onClick={handleFinalSubmitAll}
          disabled={submitting}
          className="btn btn-primary"
          style={{ padding: '14px 28px', fontSize: '20px', fontFamily: 'var(--font-yeongwol)' }}
        >
          {submitting ? '제출 처리 중...' : '상호평가 최종 제출'}
        </button>
      </footer>

    </div>
  );
};
export default StudentEvaluation;
