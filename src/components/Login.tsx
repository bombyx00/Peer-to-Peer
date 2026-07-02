import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, GraduationCap, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { loginAsStudent, loginAsTeacher, students, cloudConnected } = useApp();
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [email, setEmail] = useState('');
  const [selectedStudentEmail, setSelectedStudentEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (role === 'teacher') {
      loginAsTeacher();
    } else {
      const loginEmail = selectedStudentEmail || email;
      if (!loginEmail) {
        setError('이메일을 선택하거나 입력해주세요.');
        return;
      }
      const success = loginAsStudent(loginEmail);
      if (!success) {
        setError('등록되지 않은 학생 이메일입니다.');
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
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>
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
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                학생 이메일 선택 (테스트용 편리 기능)
              </label>
              <select
                className="glass-input"
                value={selectedStudentEmail}
                onChange={(e) => {
                  setSelectedStudentEmail(e.target.value);
                  setEmail(e.target.value);
                }}
                style={{ marginBottom: '12px' }}
              >
                <option value="">직접 이메일 입력하기</option>
                {students.map((s) => (
                  <option key={s.id} value={s.email}>
                    {s.grade}학년 {s.classNum}반 {s.number}번 {s.name} ({s.email})
                  </option>
                ))}
              </select>

              {!selectedStudentEmail && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    또는 구글 이메일 직접 입력
                  </label>
                  <input
                    type="email"
                    className="glass-input"
                    placeholder="student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', background: 'var(--primary-light)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
                교사 권한으로 대시보드에 로그인합니다. 개발 버전에서는 별도의 비밀번호 없이 즉시 접속이 가능합니다.
              </p>
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 500, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
            로그인하기
            <ArrowRight size={16} />
          </button>
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
