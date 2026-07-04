import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Download, CheckCircle, XCircle, BarChart2, RefreshCw, Copy, Check } from 'lucide-react';

export const MonitoringDashboard: React.FC = () => {
  const { students, projects, evaluations, resetAll, reloadData, cloudConnected, generateAndSaveAITotalFeedback } = useApp();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [generatingAIs, setGeneratingAIs] = useState<{ [studentId: string]: boolean }>({});
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }).catch(() => {
      // 클립보드 API 미지원 폴백
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  // Background polling and local storage sync for real-time reactivity
  useEffect(() => {
    const handleStorageChange = () => {
      reloadData().catch((err) => console.error('실시간 로컬 갱신 실패:', err));
    };
    window.addEventListener('storage', handleStorageChange);

    let interval: any = null;
    if (cloudConnected.supabase) {
      interval = setInterval(() => {
        reloadData().catch((err) => console.error('실시간 동기화 실패:', err));
      }, 1500); // 1.5s interval for fast reactivity
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (interval) clearInterval(interval);
    };
  }, [cloudConnected.supabase]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await reloadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGenerateTotalFeedback = async (studentId: string) => {
    if (!projectToMonitor) return;
    
    // 이 학생이 속한 모둠 정보와 모둠원 수 구하기
    const group = getGroupOfStudent(studentId);
    if (!group) return;
    
    // 모둠원 중 이 학생을 평가한 사람 수(자기평가 포함 여부 확인)
    const totalRequired = projectToMonitor.selfEvalEnabled ? group.memberIds.length : group.memberIds.length - 1;
    
    // 실제 제출된 평가 수 (AI_SUMMARY 제외)
    const actualSubmits = evaluations.filter(
      (e) => e.projectId === projectToMonitor.id && e.evaluateeId === studentId && e.evaluatorId !== 'AI_SUMMARY'
    ).length;

    // 만약 대부분 제출하지 않았다면 컨펌
    if (actualSubmits < Math.ceil(totalRequired * 0.7)) {
      if (!confirm(`해당 학생에 대한 동료들의 평가 제출율이 낮습니다. (${actualSubmits}/${totalRequired}명 제출)\n정말 AI 종합 총평을 생성하시겠습니까?`)) {
        return;
      }
    }

    setGeneratingAIs(prev => ({ ...prev, [studentId]: true }));
    try {
      await generateAndSaveAITotalFeedback(projectToMonitor.id, studentId);
      alert(`${students.find(s => s.id === studentId)?.name} 학생의 AI 종합 총평이 완성되었습니다.`);
    } catch (err: any) {
      console.error(err);
      alert(`AI 총평 생성 중 오류 발생: ${err.message || err}`);
    } finally {
      setGeneratingAIs(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const handleGenerateGroupTotalFeedback = async (groupId: string, memberIds: string[]) => {
    if (!projectToMonitor) return;
    const groupName = projectToMonitor.groups.find(g => g.id === groupId)?.name || '모둠';
    if (!confirm(`[${groupName}]의 모든 학생(${memberIds.length}명)에 대한 AI 종합 총평을 순차적으로 생성하시겠습니까?`)) return;

    // 각 멤버에 대해 순차적으로 생성
    for (const memberId of memberIds) {
      setGeneratingAIs(prev => ({ ...prev, [memberId]: true }));
      try {
        await generateAndSaveAITotalFeedback(projectToMonitor.id, memberId);
      } catch (err) {
        console.error(`${memberId} AI 생성 실패:`, err);
      } finally {
        setGeneratingAIs(prev => ({ ...prev, [memberId]: false }));
      }
    }
    alert('모둠 내 모든 학생의 AI 종합 총평 생성이 완료되었습니다.');
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Group members helper
  const getGroupOfStudent = (studentId: string) => {
    if (!currentProject) return null;
    return currentProject.groups.find((g) => g.memberIds.includes(studentId));
  };

  // Check if evaluator evaluated evaluatee (Check if they are in the same group currently)
  const hasEvaluated = (evaluatorId: string, evaluateeId: string) => {
    const group1 = getGroupOfStudent(evaluatorId);
    const group2 = getGroupOfStudent(evaluateeId);
    if (!group1 || !group2 || group1.id !== group2.id) return false;

    return evaluations.some(
      (e) =>
        e.projectId === currentProject?.id &&
        e.evaluatorId === evaluatorId &&
        e.evaluateeId === evaluateeId
    );
  };

  // Check if a student submitted all evaluations for their group
  const isSubmissionComplete = (studentId: string) => {
    if (!currentProject) return false;
    const group = getGroupOfStudent(studentId);
    if (!group) return false;

    // Filter members to evaluate
    const targets = currentProject.selfEvalEnabled
      ? group.memberIds
      : group.memberIds.filter((id) => id !== studentId);

    if (targets.length === 0) return false;

    return targets.every((targetId) => hasEvaluated(studentId, targetId));
  };

  // Calculate stats
  const totalStudentsInProject = currentProject
    ? currentProject.groups.reduce((acc, g) => acc + g.memberIds.length, 0)
    : 0;

  const activeStudents = currentProject
    ? students.filter((s) => getGroupOfStudent(s.id))
    : [];

  const completedCount = activeStudents.filter((s) => isSubmissionComplete(s.id)).length;
  const progressPercent = totalStudentsInProject > 0 ? Math.round((completedCount / totalStudentsInProject) * 100) : 0;

  // Export to CSV
  const handleExportCSV = () => {
    if (!currentProject) return;

    // Header definition
    const headers = [
      '평가자 학년',
      '평가자 반',
      '평가자 번호',
      '평가자 이름',
      '피평가자 학년',
      '피평가자 반',
      '피평가자 번호',
      '피평가자 이름',
      ...currentProject.questions.map((q) => q.questionText.replace(/,/g, ' ')),
      'AI 종합 피드백',
      '제출시간'
    ];

    const csvRows = [headers.join(',')];

    evaluations
      .filter((e) => e.projectId === currentProject.id && e.evaluatorId !== 'AI_SUMMARY')
      .forEach((evalItem) => {
        const evaluator = students.find((s) => s.id === evalItem.evaluatorId);
        const evaluatee = students.find((s) => s.id === evalItem.evaluateeId);

        // Only export evaluations between students currently in the same group to maintain consistency
        if (evaluator && evaluatee) {
          const evalGroup = getGroupOfStudent(evaluator.id);
          const evaleeGroup = getGroupOfStudent(evaluatee.id);
          if (!evalGroup || !evaleeGroup || evalGroup.id !== evaleeGroup.id) {
            return; // Skip mismatching group records
          }

          const answers = currentProject.questions.map((q) => {
            const val = evalItem.answers[q.id];
            return val !== undefined ? `"${String(val).replace(/"/g, '""')}"` : '';
          });

          // 피평가자 학생의 AI 종합 총평을 찾아 CSV에 매핑
          const aiSummaryEval = evaluations.find(
            (e) => e.projectId === currentProject.id && e.evaluateeId === evaluatee.id && e.evaluatorId === 'AI_SUMMARY'
          );
          const aiText = aiSummaryEval?.aiFeedback ? `"${aiSummaryEval.aiFeedback.replace(/"/g, '""')}"` : '""';

          const row = [
            evaluator.grade,
            evaluator.classNum,
            evaluator.number,
            evaluator.name,
            evaluatee.grade,
            evaluatee.classNum,
            evaluatee.number,
            evaluatee.name,
            ...answers,
            aiText,
            evalItem.submittedAt
          ];
          csvRows.push(row.join(','));
        }
      });

    // UTF-8 with BOM (\uFEFF) to make sure Excel opens the result cleanly without breaking Korean text
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentProject.title}_평가결과.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (projects.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <BarChart2 size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>모니터링이 불가능합니다</h3>
        <p style={{ fontSize: '14px' }}>진행 중인 상호평가 프로젝트가 없습니다.</p>
      </div>
    );
  }

  const projectToMonitor = currentProject || projects[0];
  const studentAccessUrl = `${window.location.origin}?code=${projectToMonitor?.accessCode || ''}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Selector & Actions */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>모니터링 프로젝트</label>
            <select
              className="glass-input"
              style={{ width: '280px' }}
              value={selectedProjectId || projectToMonitor.id}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {cloudConnected.supabase && (
              <button
                onClick={handleManualRefresh}
                className="btn btn-secondary"
                style={{ padding: '10px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={isRefreshing}
              >
                <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
                {isRefreshing ? '동기화 중...' : '실시간 새로고침'}
              </button>
            )}
            <button onClick={handleExportCSV} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: '13px' }}>
              <Download size={16} /> CSV 결과 다운로드
            </button>
            <button
              onClick={() => {
                if (confirm('주의: 모든 학생 데이터, 프로젝트, 제출된 평가 내용이 전부 초기화됩니다. 계속하시겠습니까?')) {
                  resetAll();
                }
              }}
              className="btn btn-secondary"
              style={{ padding: '10px 18px', fontSize: '13px', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}
            >
              전체 초기화 (Demo Reset)
            </button>
          </div>
        </div>
      </div>

      {/* QR Code and Student Access Guidance Card */}
      {projectToMonitor && (
        <div className="glass-panel" style={{
          padding: '24px',
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          background: 'var(--primary-light)',
          border: '1px solid rgba(79, 70, 229, 0.15)',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, letterSpacing: '1px', fontFamily: 'var(--font-joseon)' }}>STUDENT ACCESS INFO</span>
            <h3 style={{ fontSize: '24px', marginTop: '4px', marginBottom: '8px', fontFamily: 'var(--font-yeongwol)' }}>학생 접속 안내</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
              선생님이 이 화면을 빔 프로젝터나 대형 모니터에 띄워주시면, 학생들이 QR 코드를 스캔하거나 아래 인증번호를 사용해 손쉽게 접속할 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ background: 'white', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-joseon)' }}>평가 인증번호</span>
                <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '1px', lineHeight: '1.2' }}>
                  {projectToMonitor.accessCode}
                </span>
              </div>
              <button
                onClick={() => handleCopyCode(projectToMonitor.accessCode)}
                className="btn"
                style={{
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontFamily: 'var(--font-joseon)',
                  background: codeCopied ? 'rgba(16, 185, 129, 0.12)' : 'rgba(79, 70, 229, 0.08)',
                  color: codeCopied ? 'var(--success)' : 'var(--primary)',
                  border: codeCopied ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(79,70,229,0.25)',
                  borderRadius: '12px',
                  transition: 'all 0.2s ease',
                  fontWeight: 600
                }}
              >
                {codeCopied ? <Check size={15} /> : <Copy size={15} />}
                {codeCopied ? '복사됨!' : '인증번호 복사'}
              </button>
            </div>
          </div>
          
          <div 
            onClick={() => setShowQRModal(true)} 
            style={{ 
              background: 'white', 
              padding: '12px', 
              borderRadius: 'var(--radius-md)', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)', 
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(studentAccessUrl)}`} 
              alt="QR Code" 
              style={{ width: '100px', height: '100px', display: 'block' }}
            />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>클릭 시 크게 보기</span>
          </div>
        </div>
      )}

      {/* Progress Metrics */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-yeongwol)' }}>평가 제출 현황 통계</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div style={{ background: 'white', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px', fontFamily: 'var(--font-joseon)' }}>전체 대상 인원</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-joseon)' }}>{totalStudentsInProject}명</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px', fontFamily: 'var(--font-joseon)' }}>제출 완료 인원</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font-joseon)' }}>{completedCount}명</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px', fontFamily: 'var(--font-joseon)' }}>현재 제출 진행률</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{progressPercent}%</div>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, background: 'var(--primary)', height: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Group Detail Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-yeongwol)' }}>모둠별 세부 제출 현황판</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {projectToMonitor.groups.map((group) => {
              const groupStudents = students.filter((s) => group.memberIds.includes(s.id));
              
              return (
                <div key={group.id} style={{ background: 'rgba(255,255,255,0.4)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '18px', color: 'var(--primary)', fontFamily: 'var(--font-yeongwol)', margin: 0 }}>{group.name}</h4>
                    <button
                      onClick={() => handleGenerateGroupTotalFeedback(group.id, group.memberIds)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px', fontFamily: 'var(--font-joseon)' }}
                    >
                      모둠 AI 종합 총평 일괄 생성
                    </button>
                  </div>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                          <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, fontFamily: 'var(--font-joseon)', fontSize: '13px' }}>평가 제출자</th>
                          <th style={{ textAlign: 'center', padding: '8px', width: '120px', fontWeight: 600, fontFamily: 'var(--font-joseon)', fontSize: '13px' }}>최종 제출 상태</th>
                          {groupStudents.map((s) => (
                            <th key={s.id} style={{ textAlign: 'center', padding: '8px', fontWeight: 500, fontFamily: 'var(--font-joseon)', fontSize: '13px' }}>
                              {s.name} 평가
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groupStudents.map((evaluator) => {
                          const isDone = isSubmissionComplete(evaluator.id);
                          return (
                            <tr key={evaluator.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
                              <td style={{ padding: '10px 8px', fontWeight: 600, fontFamily: 'var(--font-joseon)', fontSize: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span>{evaluator.grade}-{evaluator.classNum}-{evaluator.number} {evaluator.name}</span>
                                  <button
                                    onClick={() => handleGenerateTotalFeedback(evaluator.id)}
                                    disabled={generatingAIs[evaluator.id]}
                                    className="btn btn-secondary"
                                    style={{ padding: '2px 8px', fontSize: '11px', fontFamily: 'var(--font-joseon)', height: '24px', whiteSpace: 'nowrap' }}
                                  >
                                    {generatingAIs[evaluator.id] ? '생성 중...' : 'AI 종합 총평'}
                                  </button>
                                </div>
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                {isDone ? (
                                  <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontFamily: 'var(--font-joseon)' }}>
                                    <CheckCircle size={14} /> 완료
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-joseon)' }}>
                                    <XCircle size={14} /> 미완료
                                  </span>
                                )}
                              </td>
                              {groupStudents.map((evaluatee) => {
                                const selfEvalSkip = !projectToMonitor.selfEvalEnabled && evaluator.id === evaluatee.id;
                                const done = hasEvaluated(evaluator.id, evaluatee.id);
                                
                                return (
                                  <td key={evaluatee.id} style={{ padding: '10px 8px', textAlign: 'center' }}>
                                    {selfEvalSkip ? (
                                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>-</span>
                                    ) : done ? (
                                      <span style={{
                                        display: 'inline-block',
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: 'var(--success)'
                                      }}></span>
                                    ) : (
                                      <span style={{
                                        display: 'inline-block',
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: 'rgba(0,0,0,0.1)'
                                      }}></span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI 피드백 모아보기 표 */}
      <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
        <h3 style={{ fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-yeongwol)' }}>AI 종합 서술형 평가 모아보기</h3>
        <div style={{ overflowX: 'auto' }}>
          {students.filter((s) => getGroupOfStudent(s.id)).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              프로젝트에 배정된 학생이 없습니다.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, width: '180px', fontFamily: 'var(--font-joseon)' }}>대상 학생</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600, width: '130px', fontFamily: 'var(--font-joseon)' }}>상호평가 제출 현황</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, fontFamily: 'var(--font-joseon)' }}>생성된 AI 종합 총평</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600, width: '160px', fontFamily: 'var(--font-joseon)' }}>최근 작성 일시</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600, width: '130px', fontFamily: 'var(--font-joseon)' }}>총평 관리</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .filter((s) => getGroupOfStudent(s.id))
                  .map((student) => {
                    const group = getGroupOfStudent(student.id);
                    if (!group) return null;

                    // 이 학생이 받은 평가 수 (AI_SUMMARY 제외)
                    const receivedCount = evaluations.filter(
                      (e) => e.projectId === projectToMonitor.id && e.evaluateeId === student.id && e.evaluatorId !== 'AI_SUMMARY'
                    ).length;
                    const totalRequired = projectToMonitor.selfEvalEnabled ? group.memberIds.length : group.memberIds.length - 1;

                    // 이 학생의 AI 종합 총평 레코드 찾기
                    const aiSummaryEval = evaluations.find(
                      (e) => e.projectId === projectToMonitor.id && e.evaluateeId === student.id && e.evaluatorId === 'AI_SUMMARY'
                    );

                    return (
                      <tr key={student.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 600, fontFamily: 'var(--font-joseon)' }}>
                          <div>{student.name} ({student.grade}학년 {student.classNum}반)</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>{group.name}</div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'var(--font-joseon)', fontWeight: 600 }}>
                          <span style={{ color: receivedCount === totalRequired ? 'var(--success)' : 'var(--warning)', fontSize: '13px' }}>
                            {receivedCount} / {totalRequired}명 완료
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', lineHeight: '1.5', fontFamily: 'var(--font-joseon)' }}>
                          {aiSummaryEval ? (
                            aiSummaryEval.aiFeedback
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                              상호평가 완료 후 우측 버튼을 눌러 AI 종합 총평을 생성해주세요.
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-joseon)' }}>
                          {aiSummaryEval ? new Date(aiSummaryEval.submittedAt).toLocaleString('ko-KR') : '-'}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleGenerateTotalFeedback(student.id)}
                            disabled={generatingAIs[student.id]}
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '11px', fontFamily: 'var(--font-joseon)', width: '90px' }}
                          >
                            {generatingAIs[student.id] ? '생성 중...' : aiSummaryEval ? '총평 재생성' : '총평 생성'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && projectToMonitor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowQRModal(false)}>
          <div className="glass-panel" style={{
            maxWidth: '450px',
            width: '100%',
            padding: '32px',
            background: 'white',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            animation: 'modal-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }} onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>학생 접속 QR 코드</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                모바일 기기 카메라로 스캔하면 인증번호가 자동 입력됩니다.
              </p>
            </div>
            
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0,0,0,0.03)' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(studentAccessUrl)}`} 
                alt="Large QR Code" 
                style={{ width: '250px', height: '250px', display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>평가 인증번호</span>
              <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--primary)', letterSpacing: '2px', lineHeight: '1' }}>
                {projectToMonitor.accessCode}
              </span>
            </div>

            <button onClick={() => setShowQRModal(false)} className="btn btn-primary" style={{ width: '100%' }}>
              닫기
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modal-pop {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

    </div>
  );
};
