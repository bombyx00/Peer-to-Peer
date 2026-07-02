/**
 * Google Gemini API Integration Service
 * 
 * 동료 평가 점수와 서술형 의견을 요약하여
 * 생활기록부 기재 및 피드백용 AI 서술 평가를 자동으로 생성합니다.
 */

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

export const isGeminiConfigured = () => {
  return geminiApiKey !== '' && geminiApiKey !== 'your-gemini-api-key';
};

// 로컬 템플릿 기반 피드백 생성기 (API 미연동 혹은 백업용)
const generateMockFeedback = (
  evaluateeName: string,
  answers: { [qId: string]: string | number },
  questions: any[]
): string => {
  let scoreSum = 0;
  let scoreCount = 0;
  let textComment = '';

  questions.forEach((q) => {
    const val = answers[q.id];
    if (q.type === 'rating' && typeof val === 'number') {
      // Scale 1~5 to 100
      scoreSum += val * 20;
      scoreCount++;
    } else if (q.type === 'slider' && typeof val === 'number') {
      scoreSum += val;
      scoreCount++;
    } else if (q.type === 'text' && typeof val === 'string') {
      textComment = val.trim();
    }
  });

  const averageScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 70;

  let feedback = '';
  if (averageScore >= 90) {
    feedback = `동료들로부터 기여도와 책임감에 대해 극찬을 받았습니다. ${textComment ? `"${textComment}"라는 의견처럼 ` : ''}모둠 활동 시 적극적으로 소통하고 맡은 임무를 성실히 완수하여 팀원들에게 큰 귀감이 되었습니다.`;
  } else if (averageScore >= 75) {
    feedback = `모둠의 핵심적인 역할을 담당하며 성실히 기여했습니다. ${textComment ? `특히 "${textComment}"와 같이 ` : ''}팀원들과 원만한 관계를 유지하며 공동의 결과물을 도출해내는 협업 능력이 우수합니다.`;
  } else if (averageScore >= 55) {
    feedback = `주어진 역할을 비교적 원만하게 수행했으나, 모둠의 전체 목표 달성을 위해 적극성이 조금 더 보강된다면 차후 모둠 활동에서 한 단계 더 성장할 것으로 기대됩니다.`;
  } else {
    feedback = `모둠 활동 시 다소 소극적이거나 역할 참여율이 미진하다는 의견이 있어, 향후 협업 상황에서는 자신의 책임 범위를 넓히고 자발적인 참여 태도를 가질 필요가 있습니다.`;
  }

  return `${evaluateeName} 학생은 ` + feedback;
};

/**
 * Gemini API를 사용해 생성형 AI 피드백을 서술합니다.
 */
export const generateAIFeedback = async (
  projectName: string,
  questions: { id: string; questionText: string; type: string }[],
  evaluatorName: string,
  evaluateeName: string,
  answers: { [qId: string]: string | number }
): Promise<string> => {
  // If not configured, fallback to Mock local template
  if (!isGeminiConfigured()) {
    console.log('Gemini API 키가 없어 로컬 룰에 의한 피드백을 생성합니다.');
    return generateMockFeedback(evaluateeName, answers, questions);
  }

  try {
    const qAndAPairs = questions
      .map((q) => {
        const val = answers[q.id];
        const displayVal = q.type === 'rating' ? `${val}점 (5점 만점)` : q.type === 'slider' ? `${val}% 기여` : `"${val}"`;
        return `- 질문: ${q.questionText}\n  응답: ${displayVal}`;
      })
      .join('\n');

    const prompt = `
역할: 교사를 도와 학생들의 상호평가 결과를 분석하고 생활기록부용 종합 피드백 문장을 작성하는 유능한 AI 교육 비서.
평가 대상 프로젝트: "${projectName}"
평가자: "${evaluatorName}"
피평가자(피드백 대상 학생): "${evaluateeName}"

평가자가 피평가자에게 제출한 상세 점수 및 서술형 평가 내용:
${qAndAPairs}

위 데이터를 바탕으로, 피평가자가 모둠 활동에서 보여준 태도, 협력성, 기여도를 객관적으로 종합하고, 교사 어조의 부드럽고 긍정적인 평가글(생활기록부 관찰 의견 스타일)로 작성해주세요.
- 피평가자의 이름("${evaluateeName} 학생")으로 문장을 시작해 주세요 (예: "${evaluateeName} 학생은 ~").
- 글자 수는 공백 포함 120자 내외의 짧고 정제된 1~2개 문장으로 축약해 주세요.
- 서술형 평가 내용에 부정적이거나 욕설, 혹은 과격한 묘사가 있다면 순화하여 표현해 주세요.
- 완성된 결과 문장만을 반환하며, 인사말이나 따옴표 등의 다른 텍스트는 일절 생략하세요.
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API HTTP 에러: ${response.status}`);
    }

    const resData = await response.json();
    const generatedText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (generatedText) {
      return generatedText.trim().replace(/^"|"$/g, ''); // Remove outer quotes if generated
    }

    return generateMockFeedback(evaluateeName, answers, questions);
  } catch (error) {
    console.error('Gemini AI 피드백 생성 실패, Mock 텍스트로 우회:', error);
    return generateMockFeedback(evaluateeName, answers, questions);
  }
};
