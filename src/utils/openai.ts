import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

interface TimeCalculationResult {
  realTime: number;
  explanation: string;
}

export const calculateRealTime = async (
  taskName: string,
  estimatedTime: number
): Promise<TimeCalculationResult> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "あなたは現実的なタスク時間を計算するアシスタントです。タスクの性質に応じて、現実的な中断や追加作業を考慮し、総所要時間を計算してください。",
        },
        {
          role: "user",
          content: `タスク「${taskName}」の予定時間は${estimatedTime}分です。
            1. このタスクに必要な追加時間を計算し、合計時間を算出してください。
            2. なぜその追加時間が必要なのか、タスクの性質に基づいた理由を説明してください。
            3. 回答は以下のJSON形式で返してください：
            {
              "realTime": 数値（分）,
              "explanation": "理由の説明"
            }`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = response.choices[0].message.content || "";
    try {
      const result = JSON.parse(content);
      return {
        realTime: result.realTime || Math.ceil(estimatedTime * 1.2),
        explanation:
          result.explanation ||
          "予期せぬ中断や作業が発生する可能性を考慮して、余裕を持った時間を設定しました。",
      };
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return {
        realTime: Math.ceil(estimatedTime * 1.2),
        explanation:
          "予期せぬ中断や作業が発生する可能性を考慮して、余裕を持った時間を設定しました。",
      };
    }
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return {
      realTime: Math.ceil(estimatedTime * 1.2),
      explanation: "APIエラーが発生したため、基本の20%増しで計算しました。",
    };
  }
};
