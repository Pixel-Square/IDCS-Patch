
import React, { useEffect, useState } from 'react';
import MarkEntryTabs from '../components/MarkEntryTabs';

// Props: courseId is the selected course code (string) or undefined
type Props = { courseId?: string; classType?: string | null; questionPaperType?: string | null; enabledAssessments?: string[] | null };

export default function MarkEntryPage({ courseId, classType, questionPaperType, enabledAssessments }: Props) {
  // subject is the current course code (string)
  const [subject, setSubject] = useState<string>(courseId || '');
  const [focus, setFocus] = useState(false);

  // Keep subject in sync with courseId prop
  useEffect(() => {
    if (courseId && courseId !== subject) {
      setSubject(courseId);
    }
    if (!courseId && subject) {
      setSubject('');
    }
  }, [courseId]);

  return (
    <div className="pt-1">
      {!courseId && (
        <div className="obe-card mb-4">
          <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Course ID</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Enter course id"
            className="obe-input"
            style={focus ? { boxShadow: '0 0 0 3px rgba(11,116,184,0.15)', borderColor: '#7dd3fc' } : {}}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
          />
        </div>
      )}

      {!subject ? (
        <div className="obe-card text-sm text-sky-700" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
          Select a course to start mark entry.
        </div>
      ) : (
        <MarkEntryTabs subjectId={subject} classType={classType} questionPaperType={questionPaperType} enabledAssessments={enabledAssessments} />
      )}
    </div>
  );
}
