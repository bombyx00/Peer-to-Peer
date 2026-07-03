import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StudentManager } from './StudentManager';
import { ProjectCreator } from './ProjectCreator';
import { GroupManager } from './GroupManager';
import { MonitoringDashboard } from './MonitoringDashboard';
import { LayoutDashboard, Users, UserPlus, Settings, LogOut } from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const { logout } = useApp();
  const [activeTab, setActiveTab] = useState<'project' | 'students' | 'groups' | 'monitor'>('project');

  const tabs = [
    { id: 'project', label: '평가 문항 설계', icon: <Settings size={18} />, component: <ProjectCreator /> },
    { id: 'students', label: 'CSV 명단 등록', icon: <UserPlus size={18} />, component: <StudentManager /> },
    { id: 'groups', label: '모둠 편성 (Drag & Drop)', icon: <Users size={18} />, component: <GroupManager /> },
    { id: 'monitor', label: '실시간 평가 현황', icon: <LayoutDashboard size={18} />, component: <MonitoringDashboard /> },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab);

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '60px' }}>
      {/* Header */}
      <header className="glass-panel" style={{
        padding: '20px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.5)'
      }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            관리자 모드
          </span>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', fontFamily: 'var(--font-yeongwol)' }}>교사 관리 대시보드</h2>
        </div>

        <button onClick={logout} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <LogOut size={16} />
          로그아웃
        </button>
      </header>

      {/* Tabs Selector */}
      <div className="glass-panel" style={{
        padding: '6px',
        display: 'flex',
        gap: '8px',
        background: 'rgba(255, 255, 255, 0.3)',
        overflowX: 'auto'
      }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="btn"
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '12px 16px',
                background: isActive ? 'white' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                boxShadow: isActive ? 'var(--glass-shadow)' : 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-yeongwol)',
                fontWeight: 'bold'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div style={{ animation: 'fade-in 0.4s ease-in-out' }}>
        {currentTab?.component}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
export default TeacherDashboard;
