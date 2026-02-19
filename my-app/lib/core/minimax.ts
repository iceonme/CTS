/**
 * MiniMax API 简易客户端
 */
export class MiniMaxClient {
    private apiKey: string;
    private groupId?: string;
    private baseUrl: string = 'https://api.minimax.chat/v1/text/chatcompletion_v2';

    constructor(apiKey: string, groupId?: string) {
        this.apiKey = apiKey;
        this.groupId = groupId;
    }

    async chat(prompt: string, systemPrompt: string = "你是一个专业的加密货币交易员。"): Promise<string> {
        const url = this.groupId ? `${this.baseUrl}?GroupId=${this.groupId}` : this.baseUrl;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'MiniMax-Text-01', // 使用更经济高效的 M2.1/2.5 系列模型
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                tools: [],
                tool_choice: 'none',
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`MiniMax API error: ${error}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            console.error('[MiniMaxClient] Unexpected API response structure:', JSON.stringify(data, null, 2));

            // 处理 MiniMax 特有的错误结构或安全过滤
            if (data.base_resp?.status_msg) {
                throw new Error(`MiniMax API Error (${data.base_resp.status_code}): ${data.base_resp.status_msg}`);
            }

            throw new Error('MiniMax API returned no completion choices. Check technical logs for details.');
        }

        return data.choices[0].message.content;
    }
}
