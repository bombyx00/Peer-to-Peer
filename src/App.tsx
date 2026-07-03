import React from 'react';
import { useApp } from './context/AppContext';
import { Login } from './components/Login';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentEvaluation } from './components/StudentEvaluation';

const MainApp: React.FC = () => {
  const { user } = useApp();

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
      <footer style={{
        padding: '24px 0',
        textAlign: 'center',
        fontSize: '11px',
        color: 'var(--text-muted)',
        marginTop: 'auto',
        borderTop: '1px solid rgba(0,0,0,0.03)'
      }}>
        © 2026 서울선사초등학교 교사 조근영. All Rights Reserved.
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return <MainApp />;
};

export default App;
