/**
 * Tool Registry
 * MCP (Model Context Protocol) 风格的工具注册中心
 * 
 * 每个 Tool 是一个可执行函数，通过 JSON Schema 定义参数
 */

import type { Tool, ToolParameter } from '../types';

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * 注册 Tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      console.warn(`[ToolRegistry] Tool ${tool.id} already exists, overwriting`);
    }
    this.tools.set(tool.id, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.id}`);
  }

  /**
   * 获取 Tool
   */
  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * 获取所有 Tool
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 检查 Tool 是否存在
   */
  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * 执行 Tool
   */
  async execute(toolId: string, params: any): Promise<any> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    // 参数验证 (简化版)
    if (tool.parameters.required) {
      for (const param of tool.parameters.required) {
        if (!(param in params)) {
          throw new Error(`Missing required parameter: ${param}`);
        }
      }
    }

    const startTime = Date.now();
    try {
      const result = await tool.execute(params);
      console.log(`[ToolRegistry] Executed ${toolId} in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      console.error(`[ToolRegistry] Tool ${toolId} failed:`, error);
      throw error;
    }
  }

  /**
   * 批量执行 Tools
   */
  async executeAll(tools: { toolId: string; params: any }[]): Promise<any[]> {
    return Promise.all(
      tools.map(({ toolId, params }) => this.execute(toolId, params))
    );
  }
}

// 单例导出
export const toolRegistry = new ToolRegistry();
export default toolRegistry;
