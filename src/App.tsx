import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Login } from './components/Login';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentEvaluation } from './components/StudentEvaluation';
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from './components/LegalTexts';

const MainApp: React.FC = () => {
  const { user } = useApp();
  const [showModal, setShowModal] = useState<'privacy' | 'terms' | null>(null);

  // Markdown parsing to React elements helper
  const parseMarkdownToReact = (text: string) => {
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();
      
      // 1. Headers e.g., # Header
      if (trimmed.startsWith('# ')) {
        return (
          <h2 
            key={index} 
            style={{ 
              fontSize: '22px', 
              fontWeight: 800, 
              marginTop: '24px', 
              marginBottom: '16px', 
              borderBottom: '2px solid rgba(79, 70, 229, 0.15)', 
              paddingBottom: '8px', 
              color: 'var(--primary)' 
            }}
          >
            {trimmed.slice(2)}
          </h2>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3 
            key={index} 
            style={{ 
              fontSize: '15px', 
              fontWeight: 700, 
              marginTop: '20px', 
              marginBottom: '10px', 
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '4px', height: '14px', background: 'var(--primary)', borderRadius: '2px', display: 'inline-block' }} />
            {trimmed.slice(4)}
          </h3>
        );
      }
      
      // 2. Horizontal Rule e.g., ---
      if (trimmed === '---') {
        return <hr key={index} style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '20px 0' }} />;
      }
      
      // 3. Bold text parsing e.g., **Text**
      let content: React.ReactNode = line;
      if (line.includes('**')) {
        const parts = line.split('**');
        content = parts.map((part, pIdx) => 
          pIdx % 2 === 1 
            ? <strong key={pIdx} style={{ fontWeight: 700, color: 'var(--primary)' }}>{part}</strong> 
            : part
        );
      }
      
      // 4. Bullet lists e.g., 1. Item or - Item
      if (trimmed.match(/^\d+\./)) {
        return (
          <p key={index} style={{ margin: '8px 0', paddingLeft: '16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {content}
          </p>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        // Safe check if content is array or string
        const bulletText = typeof content === 'string' 
          ? content.slice(2) 
          : React.Children.toArray(content).slice(1); // Skip the "- " part roughly
          
        return (
          <p key={index} style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '8px', color: 'var(--primary)' }}>•</span>
            {bulletText}
          </p>
        );
      }

      // 5. Empty line
      if (!trimmed) {
        return <div key={index} style={{ height: '8px' }} />;
      }

      // 6. Normal paragraph
      return (
        <p key={index} style={{ margin: '8px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          {content}
        </p>
      );
    });
  };

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
        fontSize: '12px',
        color: 'var(--text-muted)',
        marginTop: 'auto',
        borderTop: '1px solid rgba(0,0,0,0.03)',
        fontFamily: 'var(--font-joseon)'
      }}>
        <div>© 2026 서울선사초등학교 교사 조근영. All Rights Reserved.</div>
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={() => setShowModal('terms')} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', fontFamily: 'var(--font-joseon)' }}
          >
            이용약관
          </button>
          <span>|</span>
          <button 
            onClick={() => setShowModal('privacy')} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', fontFamily: 'var(--font-joseon)' }}
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
            <div style={{ fontSize: '13px', color: 'var(--text-main)', textAlign: 'left' }}>
              {parseMarkdownToReact(showModal === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY)}
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
