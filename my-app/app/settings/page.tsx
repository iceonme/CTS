"use client";

import { useState, useEffect } from "react";
import PAConfigPanel from "@/app/components/PAConfigPanel";
import { getPAConfigManager } from "@/lib/skills/config/manager";

export default function SettingsPage() {
  const [initialized, setInitialized] = useState(false);
  const [paName, setPaName] = useState("助手");

  useEffect(() => {
    // 确保配置已初始化
    const configManager = getPAConfigManager();
    const config = configManager.getConfig();
    setPaName(config.identity.name);
    setInitialized(true);
  }, []);

  return (
    <main className="min-h-screen bg-gray-950">
      {/* 顶部导航 */}
      <header className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                ← 返回首页
              </a>
              <h1 className="text-xl font-semibold text-white">
                {paName} 设置中心
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              配置您的个人助手
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {initialized ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 左侧导航 */}
            <div className="lg:col-span-1">
              <nav className="space-y-1">
                <a
                  href="#identity"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-blue-900/50 rounded-lg border border-blue-700"
                >
                  <span>👤</span>
                  身份设定
                </a>
                <a
                  href="#skills"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <span>⚡</span>
                  Skill 管理
                </a>
                <a
                  href="#behavior"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <span>⚙️</span>
                  行为偏好
                </a>
                <a
                  href="#history"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <span>📜</span>
                  版本历史
                </a>
                <a
                  href="/settings/auto-trading"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <span>🤖</span>
                  自动交易
                </a>
              </nav>

              {/* 快速操作 */}
              <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
                <h3 className="text-sm font-medium text-gray-300 mb-3">
                  快速操作
                </h3>
                <div className="space-y-2">
                  <ExportConfigButton />
                  <ImportConfigButton onImport={() => window.location.reload()} />
                </div>
              </div>

              {/* SaaS 迁移提示 */}
              <div className="mt-6 p-4 bg-purple-900/20 rounded-lg border border-purple-800">
                <h3 className="text-sm font-medium text-purple-400 mb-2">
                  💡 SaaS 准备
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  配置将保存在本地。未来可一键同步到云端。
                </p>
                <button
                  disabled
                  className="w-full px-3 py-2 text-xs bg-purple-900/50 text-purple-300 rounded cursor-not-allowed"
                >
                  登录以启用云同步
                </button>
              </div>
            </div>

            {/* 右侧配置面板 */}
            <div className="lg:col-span-3">
              <PAConfigPanel />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-400">加载配置中...</div>
          </div>
        )}
      </div>
    </main>
  );
}

// ==================== 导出配置按钮 ====================

function ExportConfigButton() {
  const handleExport = () => {
    const configManager = getPAConfigManager();
    const configJson = configManager.exportConfig();
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pa-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="w-full px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors text-left flex items-center gap-2"
    >
      <span>📤</span>
      导出配置
    </button>
  );
}

// ==================== 导入配置按钮 ====================

function ImportConfigButton({ onImport }: { onImport: () => void }) {
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const configManager = getPAConfigManager();
      const success = await configManager.importConfig(content);
      if (success) {
        alert("配置导入成功！");
        onImport();
      } else {
        alert("配置导入失败，请检查文件格式。");
      }
    };
    reader.readAsText(file);
  };

  return (
    <label className="w-full px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors text-left flex items-center gap-2 cursor-pointer">
      <span>📥</span>
      导入配置
      <input
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />
    </label>
  );
}
