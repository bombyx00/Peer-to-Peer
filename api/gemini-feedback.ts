import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendError, AuthError } from './_lib/auth.js';

const geminiApiKey = process.env.GEMINI_API_KEY || '';
const isGeminiConfigured = () => geminiApiKey !== '';

// 로컬 템플릿 기반 종합 피드백 생성기 (API 미연동 혹은 백업용)
const generateMockComprehensiveFeedback = (
  evaluateeName: string,
  allEvaluations: any[],
  questions: any[]
): string => {
  let scoreSum = 0;
  let scoreCount = 0;
  let textComments: string[] = [];
  let selfScoreSum = 0;
  let selfScoreCount = 0;

  allEvaluations.forEach((evalItem) => {
    const isSelf = evalItem.evaluatorId === evalItem.evaluateeId;
    questions.forEach((q) => {
      const val = evalItem.answers[q.id];
      if (q.type === 'rating' && typeof val === 'number') {
        if (isSelf) {
          selfScoreSum += val * 20;
          selfScoreCount++;
        } else {
          scoreSum += val * 20;
          scoreCount++;
        }
      } else if (q.type === 'slider' && typeof val === 'number') {
        if (isSelf) {
          selfScoreSum += val;
          selfScoreCount++;
        } else {
          scoreSum += val;
          scoreCount++;
        }
      } else if (q.type === 'text' && typeof val === 'string' && val.trim() && !isSelf) {
        textComments.push(val.trim());
      }
    });
  });

  const peerAvg = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 75;
  const selfAvg = selfScoreCount > 0 ? Math.round(selfScoreSum / selfScoreCount) : 75;

  let commentSummary = textComments.join(', ');
  if (commentSummary.length > 50) {
    commentSummary = commentSummary.substring(0, 50) + '...';
  }

  let feedback = '';

  if (peerAvg >= 90) {
    feedback = `동료들로부터 성실성과 뛰어난 기업에 대해 일괄적으로 매우 우수한 평가를 받았습니다. ${commentSummary ? `팀원들은 "${commentSummary}"라며 고마움을 전했습니다.` : ''}`;
    if (selfAvg >= 90) {
      feedback += ` 본인 스스로도 역할에 대한 깊은 책임감을 가졌으며 높은 효능감으로 모둠을 주도했습니다.`;
    } else {
      feedback += ` 본인의 실제 기여도에 비해 겸손하게 자기를 성찰하는 성실한 태도가 돋보입니다.`;
    }
  } else if (peerAvg >= 75) {
    feedback = `팀원들과 활발히 협력하며 맡은 역할을 원만하게 수행했습니다. ${commentSummary ? `"${commentSummary}"와 같은 긍정적인 협업 피드백을 얻었습니다.` : ''}`;
    if (selfAvg < 70 && selfAvg > 0) {
      feedback += ` 스스로의 아쉬운 점을 차분히 돌아보며 배우려는 성찰의 의지를 보였습니다.`;
    }
  } else {
    feedback = `모둠 활동 과정에서 좀 더 적극적인 참여와 소통이 보강된다면 앞으로 한 단계 더 발전할 것입니다.`;
    if (selfAvg > peerAvg + 20) {
      feedback += ` 본인의 성찰 내용과 동료들이 체감한 기여도 사이에 차이가 있으므로, 팀원들과의 구체적인 소통을 통해 책임 범위를 넓히는 노력이 필요합니다.`;
    } else if (selfAvg < 60 && selfAvg > 0) {
      feedback += ` 스스로도 참여가 미진했음을 차분하게 인정하고 성찰하는 자성적 태도를 보였습니다.`;
    }
  }

  return `${evaluateeName} 학생은 ` + feedback;
};

const generateComprehensiveAIFeedback = async (
  projectName: string,
  questions: { id: string; questionText: string; type: string }[],
  evaluateeName: string,
  allEvaluations: any[],
  studentsList: any[]
): Promise<string> => {
  if (!isGeminiConfigured()) {
    return generateMockComprehensiveFeedback(evaluateeName, allEvaluations, questions);
  }

  try {
    const peerEvals = allEvaluations.filter((e) => e.evaluatorId !== e.evaluateeId);
    const selfEvals = allEvaluations.filter((e) => e.evaluatorId === e.evaluateeId);

    const getStudentName = (id: string) => {
      const found = studentsList.find((s) => s.id === id);
      return found ? found.name : '동료';
    };

    let peerContent = '';
    peerEvals.forEach((evalItem, index) => {
      const name = getStudentName(evalItem.evaluatorId);
      const qAndA = questions
        .map((q) => {
          const val = evalItem.answers[q.id];
          const displayVal = q.type === 'rating' ? `${val}점(5점만점)` : q.type === 'slider' ? `${val}%기여` : `"${val}"`;
          return `  - ${q.questionText}: ${displayVal}`;
        })
        .join('\n');
      peerContent += `[동료평가 ${index + 1} (작성자: ${name})]\n${qAndA}\n`;
    });

    let selfContent = '없음';
    if (selfEvals.length > 0) {
      const qAndA = questions
        .map((q) => {
          const val = selfEvals[0].answers[q.id];
          const displayVal = q.type === 'rating' ? `${val}점(5점만점)` : q.type === 'slider' ? `${val}%기여` : `"${val}"`;
          return `  - ${q.questionText}: ${displayVal}`;
        })
        .join('\n');
      selfContent = qAndA;
    }

    const prompt = `
역할: 교사를 도와 학생들의 다면 상호평가 결과를 분석하고 생활기록부 기재용 종합 피드백 문장을 작성하는 유능한 AI 교육 비서.
평가 대상 프로젝트: "${projectName}"
피평가자(피드백 대상 학생): "${evaluateeName}"

[동료들이 이 학생을 평가한 내용 (동료평가)]:
${peerContent || '없음'}

[이 학생이 자기 자신을 직접 평가한 내용 (자기평가)]:
${selfContent}

위 데이터를 바탕으로, 피평가자가 모둠 활동에서 보여준 태도, 협력성, 기여도를 객관적으로 종합하되, **학생 본인의 자기평가 내용(성찰 태도, 자기 평가 점수와 동료 평가 점수 간의 간극 등)을 중요하게 감안하여** 교사 어조의 부드럽고 긍정적인 평가글(생활기록부 관찰 의견 스타일)로 작성해주세요.
- 피평가자의 실제 기여도가 높음에도 자기를 겸손하게 돌아보았는지, 혹은 본인의 평가와 동료의 평가에 큰 간극이 있어 성찰이 필요한지 등을 지적하되, 격려하고 성장을 돕는 방향이어야 합니다.
- 피평가자의 이름("${evaluateeName} 학생")으로 문장을 시작해 주세요 (예: "${evaluateeName} 학생은 ~").
- 글자 수는 공백 포함 150자 내외의 정제된 1~2개 문장으로 작성해 주세요.
- 완성된 결과 문장만을 반환하며, 인사말이나 따옴표 등의 다른 텍스트는 일절 생략하세요.
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API HTTP 에러: ${response.status}`);
    }

    const resData: any = await response.json();
    const generatedText = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (generatedText) {
      return generatedText.trim().replace(/^"|"$/g, '');
    }

    return generateMockComprehensiveFeedback(evaluateeName, allEvaluations, questions);
  } catch (error) {
    console.error('Gemini 종합 피드백 생성 실패, Mock 텍스트로 우회:', error);
    return generateMockComprehensiveFeedback(evaluateeName, allEvaluations, questions);
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    await requireAuth(req, 'teacher');

    const { projectTitle, questions, evaluateeName, evaluations, students } = req.body || {};
    if (!projectTitle || !questions || !evaluateeName) {
      throw new AuthError(400, 'projectTitle, questions, evaluateeName이 필요합니다.');
    }

    const text = await generateComprehensiveAIFeedback(
      projectTitle,
      questions,
      evaluateeName,
      evaluations || [],
      students || []
    );
    return res.status(200).json({ text });
  } catch (err) {
    return sendError(res, err);
  }
}
