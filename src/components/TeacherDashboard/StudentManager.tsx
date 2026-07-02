import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Student } from '../../services/mockStorage';
import { Upload, Trash2, UserPlus, Check, Download } from 'lucide-react';

export const StudentManager: React.FC = () => {
  const { students, uploadStudents } = useApp();
  const [csvText, setCsvText] = useState('');
  const [singleStudent, setSingleStudent] = useState<Omit<Student, 'id'>>({
    grade: '',
    classNum: '',
    number: '',
    name: '',
    email: '',
  });
  const [successMsg, setSuccessMsg] = useState('');

  // Simple CSV parser
  const handleCsvUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;

    try {
      const lines = csvText.split('\n');
      const parsedStudents: Student[] = [];

      lines.forEach((line, idx) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        // Skip header if matches common fields
        if (idx === 0 && (cleanLine.includes('학년') || cleanLine.includes('이름') || cleanLine.includes('email'))) {
          return;
        }

        const parts = cleanLine.split(',').map((p) => p.trim());
        if (parts.length >= 5) {
          parsedStudents.push({
            id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            grade: parts[0],
            classNum: parts[1],
            number: parts[2],
            name: parts[3],
            email: parts[4],
          });
        }
      });

      if (parsedStudents.length > 0) {
        uploadStudents(parsedStudents);
        setCsvText('');
        showSuccess(`성공적으로 ${parsedStudents.length}명의 학생을 등록했습니다.`);
      } else {
        alert('올바른 CSV 형식이 아닙니다. (예시: 학년,반,번호,이름,이메일)');
      }
    } catch (err) {
      alert('CSV 파싱 중 오류가 발생했습니다.');
    }
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { grade, classNum, number, name, email } = singleStudent;
    if (!grade || !classNum || !number || !name || !email) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    const newStudent: Student = {
      ...singleStudent,
      id: `s-${Date.now()}`,
    };

    uploadStudents([...students, newStudent]);
    setSingleStudent({ grade: '', classNum: '', number: '', name: '', email: '' });
    showSuccess(`${name} 학생이 추가되었습니다.`);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDelete = (id: string) => {
    if (confirm('이 학생을 삭제하시겠습니까?')) {
      uploadStudents(students.filter((s) => s.id !== id));
    }
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,학년,반,번호,이름,이메일\n3,1,1,김철수,chulsoo@gmail.com\n3,1,2,이영희,younghee@gmail.com";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
      {/* Left side: Upload & Add form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* CSV Upload */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>CSV 명단 일괄 등록</h3>
            <button onClick={downloadTemplate} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              <Download size={14} />
              양식 다운로드
            </button>
          </div>
          <form onSubmit={handleCsvUpload}>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                형식: 학년, 반, 번호, 이름, 구글이메일 (한 줄에 한 명씩 쉼표로 구분)
              </span>
            </div>
            <textarea
              className="glass-input"
              style={{ minHeight: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px', marginBottom: '16px' }}
              placeholder="예시:&#10;3,1,1,김철수,chulsoo@gmail.com&#10;3,1,2,이영희,younghee@gmail.com"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              <Upload size={16} />
              일괄 등록하기
            </button>
          </form>
        </div>

        {/* Single Add */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>개별 학생 등록</h3>
          <form onSubmit={handleSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <input
                type="number"
                placeholder="학년 (예: 3)"
                className="glass-input"
                value={singleStudent.grade}
                onChange={(e) => setSingleStudent({ ...singleStudent, grade: e.target.value })}
              />
              <input
                type="number"
                placeholder="반 (예: 1)"
                className="glass-input"
                value={singleStudent.classNum}
                onChange={(e) => setSingleStudent({ ...singleStudent, classNum: e.target.value })}
              />
              <input
                type="number"
                placeholder="번호 (예: 1)"
                className="glass-input"
                value={singleStudent.number}
                onChange={(e) => setSingleStudent({ ...singleStudent, number: e.target.value })}
              />
            </div>
            <input
              type="text"
              placeholder="이름"
              className="glass-input"
              value={singleStudent.name}
              onChange={(e) => setSingleStudent({ ...singleStudent, name: e.target.value })}
            />
            <input
              type="email"
              placeholder="구글 이메일"
              className="glass-input"
              value={singleStudent.email}
              onChange={(e) => setSingleStudent({ ...singleStudent, email: e.target.value })}
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              <UserPlus size={16} />
              학생 추가
            </button>
          </form>
        </div>
      </div>

      {/* Right side: Student list */}
      <div className="glass-panel" style={{ padding: '24px', maxHeight: '590px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
          학생 목록 ({students.length}명)
        </h3>

        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--success-light)',
            color: 'var(--success)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '16px'
          }}>
            <Check size={16} />
            {successMsg}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {students.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              등록된 학생이 없습니다. 왼쪽의 폼을 통해 추가해주세요.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>학적</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>이름</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>이메일</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', width: '60px' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      {student.grade}-{student.classNum}-{student.number}
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{student.name}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '13px' }}>{student.email}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(student.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-light)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
