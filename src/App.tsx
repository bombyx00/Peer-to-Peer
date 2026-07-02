import React from 'react';
import { useApp } from './context/AppContext';
import { Login } from './components/Login';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentEvaluation } from './components/StudentEvaluation';

const MainApp: React.FC = () => {
  const { user } = useApp();

  if (!user) {
    return <Login />;
  }

  return user.role === 'teacher' ? <TeacherDashboard /> : <StudentEvaluation />;
};

export const App: React.FC = () => {
  return <MainApp />;
};

export default App;
