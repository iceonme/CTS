/**
 * PA Chat API
 * POST /api/pa/chat
 * 
 * 演示正确的 PA 架构：LLM + Skills
 */

import { getPA } from "@/lib/agents/pa";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: '缺少 message 参数' },
        { status: 400 }
      );
    }

    // 获取 PA Agent (新框架版本)
    const pa = getPA();

    // PA 处理消息
    const result = await pa.chat(message);

    return NextResponse.json(result);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[PA Chat] Error:', error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
