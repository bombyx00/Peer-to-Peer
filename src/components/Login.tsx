import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, GraduationCap, ArrowRight } from 'lucide-react';

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export const Login: React.FC = () => {
  const { loginAsStudent, loginAsStudentWithCode, loginAsTeacher, students, cloudConnected } = useApp();
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [selectedStudentEmail, setSelectedStudentEmail] = useState('');
  const [error, setError] = useState('');

  // Student specific inputs
  const [accessCode, setAccessCode] = useState('');
  const [grade, setGrade] = useState('');
  const [classNum, setClassNum] = useState('');
  const [number, setNumber] = useState('');
  const [studentName, setStudentName] = useState('');

  // Debug easter egg
  const [showDebug, setShowDebug] = useState(false);
  const [titleClicks, setTitleClicks] = useState(0);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  // Check if Google GSI is loaded
  useEffect(() => {
    const checkGoogle = setInterval(() => {
      // @ts-ignore
      if (window.google) {
        setGoogleLoaded(true);
        clearInterval(checkGoogle);
      }
    }, 500);
    return () => clearInterval(checkGoogle);
  }, []);

  // Parse access code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setAccessCode(code);
    }
  }, []);

  const handleGoogleLogin = (response: any) => {
    setError('');
    const payload = parseJwt(response.credential);
    if (payload && payload.email) {
      loginAsTeacher(payload.email, payload.name || '교사');
    } else {
      setError('구글 로그인에 실패했습니다. 유효하지 않은 응답입니다.');
    }
  };

  useEffect(() => {
    // @ts-ignore
    if (googleLoaded && role === 'teacher' && window.google) {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (clientId) {
        // @ts-ignore
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleLogin,
        });

        // @ts-ignore
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          {
            theme: 'outline',
            size: 'large',
            width: 370,
            text: 'signin_with',
          }
        );
      }
    }
  }, [googleLoaded, role]);

  const handleTitleClick = () => {
    const nextClicks = titleClicks + 1;
    setTitleClicks(nextClicks);
    if (nextClicks >= 5) {
      setShowDebug(true);
      alert('개발자 디버그 모드가 활성화되었습니다. 테스트용 학생 목록을 사용할 수 있습니다.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (role === 'teacher') {
      if (showDebug) {
        loginAsTeacher('teacher@example.com', '테스트교사');
      } else {
        setError('교사는 구글 로그인 버튼을 클릭하여 로그인해주세요.');
      }
    } else {
      // Student login
      if (showDebug && selectedStudentEmail) {
        const success = loginAsStudent(selectedStudentEmail);
        if (!success) {
          setError('등록되지 않은 학생 이메일입니다.');
        }
        return;
      }

      if (!accessCode || !grade || !classNum || !number || !studentName) {
        setError('모든 로그인 정보를 입력해주세요.');
        return;
      }

      const result = loginAsStudentWithCode(
        accessCode.trim(),
        grade.trim(),
        classNum.trim(),
        number.trim(),
        studentName.trim()
      );

      if (!result.success) {
        setError(result.error || '로그인에 실패했습니다.');
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 100px)',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '450px',
        width: '100%',
        padding: '40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '6px',
          background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)'
        }}></div>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 
            onClick={handleTitleClick}
            style={{ 
              fontSize: '28px', 
              fontWeight: 800, 
              marginBottom: '8px', 
              letterSpacing: '-0.5px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            상호평가 시스템
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            모둠 활동 상호평가에 오신 것을 환영합니다.
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.04)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px'
        }}>
          <button
            type="button"
            onClick={() => { setRole('student'); setError(''); }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              background: role === 'student' ? 'white' : 'transparent',
              color: role === 'student' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: role === 'student' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <GraduationCap size={18} />
            학생 로그인
          </button>
          <button
            type="button"
            onClick={() => { setRole('teacher'); setError(''); }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              background: role === 'teacher' ? 'white' : 'transparent',
              color: role === 'teacher' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: role === 'teacher' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <Shield size={18} />
            교사 로그인
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {role === 'student' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {showDebug ? (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    [디버그] 학생 이메일 선택
                  </label>
                  <select
                    className="glass-input"
                    value={selectedStudentEmail}
                    onChange={(e) => setSelectedStudentEmail(e.target.value)}
                  >
                    <option value="">이메일 선택...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.email}>
                        {s.grade}학년 {s.classNum}반 {s.number}번 {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      평가 인증번호 (6자리)
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      placeholder="교사에게 부여받은 6자리 숫자 입력"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      본인 학적 정보
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      <input
                        type="number"
                        className="glass-input"
                        placeholder="학년"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                      />
                      <input
                        type="number"
                        className="glass-input"
                        placeholder="반"
                        value={classNum}
                        onChange={(e) => setClassNum(e.target.value)}
                      />
                      <input
                        type="number"
                        className="glass-input"
                        placeholder="번호"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      본인 이름
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      placeholder="홍길동"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                lineHeight: '1.6',
                background: 'var(--primary-light)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(79, 70, 229, 0.15)',
                width: '100%'
              }}>
                교사 권한으로 대시보드에 접근하기 위해 구글 계정으로 로그인해주세요.
              </p>
              
              {googleLoaded ? (
                <div id="google-signin-btn" style={{ minHeight: '44px', width: '100%', display: 'flex', justifyContent: 'center' }}></div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Google SDK 로드 중...</div>
              )}

              {showDebug && (
                <button
                  type="button"
                  onClick={() => loginAsTeacher('teacher@example.com', '테스트교사')}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  [디버그] 테스트 교사 계정으로 로그인
                </button>
              )}
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 500, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              {error}
            </div>
          )}

          {(role === 'student' || (role === 'teacher' && showDebug)) && (
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
              로그인하기
              <ArrowRight size={16} />
            </button>
          )}
        </form>

        {/* Cloud Connection Status Badge */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: cloudConnected.supabase ? 'var(--success)' : '#cbd5e1'
            }}></span>
            Supabase: {cloudConnected.supabase ? '연동 완료' : '미연동'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: cloudConnected.sheets ? 'var(--success)' : '#cbd5e1'
            }}></span>
            Google Sheets: {cloudConnected.sheets ? '연동 완료' : '미연동'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: cloudConnected.gemini ? 'var(--success)' : '#cbd5e1'
            }}></span>
            Gemini AI: {cloudConnected.gemini ? '연동 완료' : '미연동'}
          </div>
        </div>
      </div>
    </div>
  );
};
