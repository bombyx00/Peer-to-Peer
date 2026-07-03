import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Login } from './components/Login';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentEvaluation } from './components/StudentEvaluation';
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from './components/LegalTexts';

const MainApp: React.FC = () => {
  const { user } = useApp();
  const [showModal, setShowModal] = useState<'privacy' | 'terms' | null>(null);

  const renderContent = () => {
    if (!user) {
      return <Login />;
    }
    return user.role === 'teacher' ? <TeacherDashboard /> : <StudentEvaluation />;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        {renderContent()}
      </div>
      
      {/* Footer copyright and Legal links */}
      <footer style={{
        padding: '24px 0',
        textAlign: 'center',
        fontSize: '11px',
        color: 'var(--text-muted)',
        marginTop: 'auto',
        borderTop: '1px solid rgba(0,0,0,0.03)'
      }}>
        <div>© 2026 서울선사초등학교 교사 조근영. All Rights Reserved.</div>
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={() => setShowModal('terms')} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
          >
            이용약관
          </button>
          <span>|</span>
          <button 
            onClick={() => setShowModal('privacy')} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
          >
            개인정보처리방침
          </button>
        </div>
      </footer>

      {/* Legal Modal Popup */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setShowModal(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              padding: '30px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: 'var(--glass-shadow)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowModal(null)}
              style={{
                position: 'absolute',
                right: '20px',
                top: '20px',
                border: 'none',
                background: 'rgba(0,0,0,0.05)',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
            <div style={{ whiteSpace: 'pre-line', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-main)', textAlign: 'left' }}>
              {showModal === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return <MainApp />;
};

export default App;
