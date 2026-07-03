import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import type { Group, Student } from '../../services/mockStorage';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { Plus, Trash2, Users, ArrowRightLeft, UserCheck, HelpCircle, RotateCcw } from 'lucide-react';

// Draggable Student Card Component
const DraggableStudent: React.FC<{ student: Student }> = ({ student }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    padding: '8px 12px',
    background: 'white',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '10px',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: isDragging ? '0 10px 20px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.02)',
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="draggable-item">
      <span style={{ fontFamily: 'var(--font-joseon)', fontSize: '14px', fontWeight: 600 }}>{student.grade}-{student.classNum}-{student.number} {student.name}</span>
    </div>
  );
};

// Droppable Group/Unassigned Column Component
const DroppableArea: React.FC<{
  id: string;
  title: string;
  count: number;
  bg?: string;
  children: React.ReactNode;
}> = ({ id, title, count, bg = 'rgba(255, 255, 255, 0.4)', children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? 'rgba(79, 70, 229, 0.08)' : bg,
        border: isOver ? '2px dashed var(--primary)' : '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'var(--transition-fast)',
        boxShadow: isOver ? '0 8px 24px rgba(79,70,229,0.05)' : 'var(--glass-shadow)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h4 style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-yeongwol)' }}>{title}</h4>
        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(0,0,0,0.05)', fontWeight: 600, fontFamily: 'var(--font-joseon)' }}>
          {count}명
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: '120px' }}>
        {children}
      </div>
    </div>
  );
};

export const GroupManager: React.FC = () => {
  const { students, projects, updateProjectGroups } = useApp();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (currentProject) {
      setGroups(currentProject.groups || []);
    } else {
      setGroups([]);
    }
  }, [selectedProjectId, projects]);

  const addGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    const name = newGroupName.trim() || `${groups.length + 1}모둠`;
    
    const newGroup: Group = {
      id: `g-${Date.now()}`,
      name,
      memberIds: [],
    };

    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    updateProjectGroups(selectedProjectId, updatedGroups);
    setNewGroupName('');
  };

  const removeGroup = (groupId: string) => {
    if (confirm('이 모둠을 삭제하시겠습니까? (모둠에 속한 학생들은 미배정 상태로 돌아갑니다.)')) {
      const updatedGroups = groups.filter((g) => g.id !== groupId);
      setGroups(updatedGroups);
      updateProjectGroups(selectedProjectId, updatedGroups);
    }
  };

  // Find students not assigned to any group in the current project
  const assignedIds = groups.reduce<string[]>((acc, g) => [...acc, ...g.memberIds], []);
  const unassignedStudents = students.filter((s) => !assignedIds.includes(s.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !selectedProjectId) return;

    const studentId = active.id as string;
    const targetAreaId = over.id as string; // 'unassigned' or group.id

    // Remove student from any existing group
    let updatedGroups = groups.map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => id !== studentId),
    }));

    // Add to target group if it's a group ID
    if (targetAreaId !== 'unassigned') {
      updatedGroups = updatedGroups.map((g) => {
        if (g.id === targetAreaId) {
          return { ...g, memberIds: [...g.memberIds, studentId] };
        }
        return g;
      });
    }

    setGroups(updatedGroups);
    updateProjectGroups(selectedProjectId, updatedGroups);
  };

  // Convenient Click-to-Move handler for Mobile/Accessibility
  const handleMoveClick = (studentId: string, targetGroupId: string) => {
    if (!selectedProjectId) return;
    
    let updatedGroups = groups.map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => id !== studentId),
    }));

    if (targetGroupId !== 'unassigned') {
      updatedGroups = updatedGroups.map((g) => {
        if (g.id === targetGroupId) {
          return { ...g, memberIds: [...g.memberIds, studentId] };
        }
        return g;
      });
    }

    setGroups(updatedGroups);
    updateProjectGroups(selectedProjectId, updatedGroups);
  };

  const autoAllocate = () => {
    if (groups.length === 0) {
      alert('자동 배정을 진행하려면 최소 1개 이상의 모둠을 생성해주세요.');
      return;
    }
    if (unassignedStudents.length === 0) {
      alert('배정할 미배정 학생이 없습니다.');
      return;
    }

    const updatedGroups = groups.map(g => ({ ...g, memberIds: [...g.memberIds] }));
    
    // Distribute unassigned students to the group with the fewest members dynamically
    unassignedStudents.forEach((student) => {
      let minGroup = updatedGroups[0];
      updatedGroups.forEach((g) => {
        if (g.memberIds.length < minGroup.memberIds.length) {
          minGroup = g;
        }
      });
      minGroup.memberIds.push(student.id);
    });

    setGroups(updatedGroups);
    updateProjectGroups(selectedProjectId, updatedGroups);
  };

  const resetAllocations = () => {
    if (!selectedProjectId) return;
    if (groups.length === 0) {
      alert('초기화할 모둠이 없습니다.');
      return;
    }
    
    const assignedCount = groups.reduce((acc, g) => acc + g.memberIds.length, 0);
    if (assignedCount === 0) {
      alert('이미 모든 학생이 미배정 상태입니다.');
      return;
    }

    if (confirm('⚠️ 정말 모든 모둠 배정을 초기화하시겠습니까?\n배정된 모든 학생이 미배정 상태(대기 목록)로 되돌아갑니다.')) {
      const updatedGroups = groups.map((g) => ({
        ...g,
        memberIds: [],
      }));
      setGroups(updatedGroups);
      updateProjectGroups(selectedProjectId, updatedGroups);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <HelpCircle size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>모둠 설정이 불가능합니다</h3>
        <p style={{ fontSize: '14px' }}>먼저 [평가 문항 설계] 탭에서 상호평가 프로젝트를 생성해주세요.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Bar: Selector & Add Group */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>대상 프로젝트</label>
          <select
            className="glass-input"
            style={{ width: '280px' }}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <form onSubmit={addGroup} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="모둠명 (예: 1모둠)"
              className="glass-input"
              style={{ width: '160px', padding: '8px 12px' }}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '17px', fontFamily: 'var(--font-yeongwol)', fontWeight: 'bold' }}>
              <Plus size={16} /> 모둠 추가
            </button>
          </form>

          <button onClick={autoAllocate} className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: '17px', fontFamily: 'var(--font-yeongwol)', fontWeight: 'bold', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none' }}>
            <ArrowRightLeft size={14} /> 자동 균등 배정
          </button>

          <button
            onClick={resetAllocations}
            className="btn btn-secondary"
            style={{
              padding: '8px 18px',
              fontSize: '17px',
              fontFamily: 'var(--font-yeongwol)',
              fontWeight: 'bold',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--danger)',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-light)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <RotateCcw size={14} /> 배정 초기화
          </button>
        </div>
      </div>

      {/* Dnd Content */}
      <DndContext onDragEnd={handleDragEnd}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Left: Unassigned Students */}
          <DroppableArea id="unassigned" title="미배정 학생 목록" count={unassignedStudents.length}>
            {unassignedStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--success)', fontSize: '13px', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={20} />
                모든 학생이 배정되었습니다!
              </div>
            ) : (
              unassignedStudents.map((s) => (
                <div key={s.id} style={{ position: 'relative' }}>
                  <DraggableStudent student={s} />
                  
                  {/* Quick-move control dropdown for convenience */}
                  <select
                    onChange={(e) => handleMoveClick(s.id, e.target.value)}
                    value=""
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '8px',
                      fontSize: '11px',
                      background: 'rgba(0,0,0,0.03)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      cursor: 'pointer',
                      zIndex: 10
                    }}
                  >
                    <option value="" disabled>배정</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </DroppableArea>

          {/* Right: Group Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {groups.length === 0 ? (
              <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users size={32} style={{ marginBottom: '12px' }} />
                오른쪽 상단의 모둠 추가 입력창을 통해 모둠을 만들어주세요.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                {groups.map((group) => {
                  const groupStudents = students.filter((s) => group.memberIds.includes(s.id));
                  return (
                    <DroppableArea key={group.id} id={group.id} title={group.name} count={groupStudents.length}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '100px' }}>
                        {groupStudents.map((s) => (
                          <div key={s.id} style={{ position: 'relative' }}>
                            <DraggableStudent student={s} />
                            
                            {/* Return button */}
                            <button
                              onClick={() => handleMoveClick(s.id, 'unassigned')}
                              style={{
                                position: 'absolute',
                                right: '8px',
                                top: '8px',
                                border: 'none',
                                background: 'rgba(0,0,0,0.04)',
                                borderRadius: '4px',
                                fontSize: '11px',
                                padding: '2px 6px',
                                cursor: 'pointer',
                                zIndex: 10,
                                fontFamily: 'var(--font-joseon)'
                              }}
                            >
                              빼기
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => removeGroup(group.id)}
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--danger)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '6px 0',
                          borderRadius: '8px',
                          transition: 'var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-light)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Trash2 size={12} /> 모둠 삭제
                      </button>
                    </DroppableArea>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </DndContext>
    </div>
  );
};
