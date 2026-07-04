import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import type { Student } from '../../services/mockStorage';
import { Upload, Trash2, UserPlus, Check, Download, FileSpreadsheet } from 'lucide-react';

export const StudentManager: React.FC = () => {
  const { students, uploadStudents } = useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [csvText, setCsvText] = useState('');
  const [singleStudent, setSingleStudent] = useState<Omit<Student, 'id'>>({
    grade: '',
    classNum: '',
    number: '',
    name: '',
    email: '',
  });
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to parse CSV strings
  const parseCsvString = (text: string) => {
    const lines = text.split(/\r?\n/);
    const parsedStudents: Student[] = [];

    lines.forEach((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      const parts = cleanLine.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      
      // Skip header if it contains common words OR if the numeric fields (grade, number) are not numbers
      const isHeader = idx === 0 && (
        cleanLine.includes('학년') ||
        cleanLine.includes('이름') ||
        cleanLine.includes('email') ||
        cleanLine.includes('이메일') ||
        isNaN(Number(parts[0])) ||
        isNaN(Number(parts[2]))
      );

      if (isHeader) {
        return;
      }

      // Allow 4 or more columns (Email is optional)
      if (parts.length >= 4) {
        parsedStudents.push({
          id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          grade: parts[0],
          classNum: parts[1],
          number: parts[2],
          name: parts[3],
          email: parts[4] || '', // Optional email
        });
      }
    });

    if (parsedStudents.length > 0) {
      uploadStudents(parsedStudents);
      setCsvText('');
      showSuccess(`성공적으로 ${parsedStudents.length}명의 학생을 등록했습니다.`);
    } else {
      alert('올바른 CSV 형식이 아닙니다. (예시: 학년,반,번호,이름,이메일(선택))');
    }
  };

  // Textarea submit
  const handleCsvTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    parseCsvString(csvText);
  };

  // File Upload change handler (Encoding detection)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        
        // 1. Try decoding with EUC-KR (EUC-KR is standard for Excel CSV in Korea)
        let decodedText = new TextDecoder('euc-kr').decode(arrayBuffer);
        
        // 2. Check if first line contains replacement characters (rough validation for UTF-8 files parsed as EUC-KR)
        // If it seems broken (contains Unicode Replacement Character \ufffd), fallback to UTF-8
        if (decodedText.includes('\ufffd')) {
          decodedText = new TextDecoder('utf-8').decode(arrayBuffer);
        }
        
        parseCsvString(decodedText);
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset file input value so same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { grade, classNum, number, name } = singleStudent;
    // Email is no longer required
    if (!grade || !classNum || !number || !name) {
      alert('이메일을 제외한 모든 필수 필드(학년, 반, 번호, 이름)를 입력해주세요.');
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
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllSelect = () => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map((s) => s.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`선택한 ${selectedIds.length}명의 학생을 정말로 삭제하시겠습니까?`)) {
      const remaining = students.filter((s) => !selectedIds.includes(s.id));
      uploadStudents(remaining);
      setSelectedIds([]);
      showSuccess(`선택한 ${selectedIds.length}명의 학생을 삭제했습니다.`);
    }
  };

  const downloadTemplate = () => {
    // UTF-8 with BOM (\uFEFF) to make sure Excel opens it perfectly without broken Korean characters
    const csvContent = "\uFEFF학년,반,번호,이름,이메일(선택)\n3,1,1,김철수,chulsoo@gmail.com\n3,1,2,이영희,younghee@gmail.com\n3,1,3,박지성,";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
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
            <h3 style={{ fontSize: '24px', fontFamily: 'var(--font-yeongwol)' }}>CSV 명단 일괄 등록</h3>
            <button onClick={downloadTemplate} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', fontFamily: 'var(--font-joseon)' }}>
              <Download size={14} />
              양식 다운로드
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Real File Input Hidden */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              style={{ display: 'none' }}
            />
            
            <button 
              type="button" 
              onClick={triggerFileUpload} 
              className="btn btn-primary" 
              style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', padding: '14px 24px', fontFamily: 'var(--font-yeongwol)', fontSize: '20px' }}
            >
              <FileSpreadsheet size={18} />
              엑셀 CSV 파일 업로드하기
            </button>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
              <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', width: '100%' }} />
              <span style={{ position: 'absolute', background: 'var(--glass-bg)', padding: '0 12px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-joseon)' }}>
                또는 직접 텍스트 붙여넣기
              </span>
            </div>

            <form onSubmit={handleCsvTextSubmit}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-joseon)' }}>
                  형식: 학년, 반, 번호, 이름, 이메일(선택) (한 줄에 한 명씩 쉼표 구분)
                </span>
              </div>
              <textarea
                className="glass-input"
                style={{ minHeight: '100px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', marginBottom: '12px' }}
                placeholder="예시:&#10;3,1,1,김철수,chulsoo@gmail.com&#10;3,1,2,이영희,younghee@gmail.com&#10;3,1,3,박지성,"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary" style={{ width: '100%', fontFamily: 'var(--font-yeongwol)', fontSize: '19px' }}>
                <Upload size={16} />
                텍스트 일괄 등록
              </button>
            </form>
          </div>
        </div>

        {/* Single Add */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-yeongwol)' }}>개별 학생 등록</h3>
          <form onSubmit={handleSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-joseon)' }}>
                학년 / 반 / 번호 입력
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <input
                  type="number"
                  placeholder="학년"
                  className="glass-input"
                  value={singleStudent.grade}
                  onChange={(e) => setSingleStudent({ ...singleStudent, grade: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="반"
                  className="glass-input"
                  value={singleStudent.classNum}
                  onChange={(e) => setSingleStudent({ ...singleStudent, classNum: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="번호"
                  className="glass-input"
                  value={singleStudent.number}
                  onChange={(e) => setSingleStudent({ ...singleStudent, number: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-joseon)' }}>
                이름
              </label>
              <input
                type="text"
                placeholder="이름"
                className="glass-input"
                value={singleStudent.name}
                onChange={(e) => setSingleStudent({ ...singleStudent, name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-joseon)' }}>
                구글 이메일 주소 (선택)
              </label>
              <input
                type="email"
                placeholder="teacher-approved-email@gmail.com (선택)"
                className="glass-input"
                value={singleStudent.email}
                onChange={(e) => setSingleStudent({ ...singleStudent, email: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '4px', fontFamily: 'var(--font-yeongwol)', fontSize: '20px' }}>
              <UserPlus size={16} />
              학생 추가
            </button>
          </form>
        </div>
      </div>

      {/* Right side: Students List */}
      <div className="glass-panel" style={{ padding: '24px', maxHeight: '720px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '22px', fontFamily: 'var(--font-yeongwol)' }}>등록된 학생 명단 ({students.length}명)</h3>
          {successMsg && (
            <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={14} />
              {successMsg}
            </span>
          )}
        </div>

        {/* Bulk select and delete bar */}
        {students.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-joseon)', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={students.length > 0 && selectedIds.length === students.length}
                onChange={handleToggleAllSelect}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              전체 선택 ({selectedIds.length} / {students.length})
            </label>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="btn btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  color: 'var(--danger)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.05)',
                  fontFamily: 'var(--font-joseon)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Trash2 size={14} />
                선택 삭제 ({selectedIds.length}명)
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {students.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              등록된 학생이 없습니다. 명단을 등록해주세요.
            </div>
          ) : (
            [...students]
              .sort((a, b) => {
                const aKey = `${a.grade.padStart(2, '0')}-${a.classNum.padStart(2, '0')}-${a.number.padStart(3, '0')}`;
                const bKey = `${b.grade.padStart(2, '0')}-${b.classNum.padStart(2, '0')}-${b.number.padStart(3, '0')}`;
                return aKey.localeCompare(bKey);
              })
              .map((student) => {
                const isSelected = selectedIds.includes(student.id);
                return (
                  <div
                    key={student.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: isSelected ? 'rgba(79, 70, 229, 0.06)' : 'rgba(255, 255, 255, 0.4)',
                      border: isSelected ? '1px solid rgba(79, 70, 229, 0.3)' : '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'background 0.2s, border-color 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(student.id)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-joseon)' }}>
                          {student.grade}학년 {student.classNum}반 {student.number}번 {student.name}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-joseon)' }}>
                          {student.email || '(이메일 없음)'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(student.id)}
                      className="btn-icon"
                      style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
};
