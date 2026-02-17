/**
 * TradeMind Framework - Core Exports
 */

export { BaseAgent, SkillRegistry } from './base-agent';
export type {
  AgentConfig,
  AgentIdentity,
  AgentMemory,
  AgentCapabilities,
  AgentBehavior,
  AutonomyLevel,
  ChatContext,
  ChatMessage,
  ChatResponse,
  SessionMemory,
  IndividualMemory,
  CollectiveMemory,
  SkillDefinition,
  SkillParameter,
  SkillHandler,
  SkillContext,
  SkillCall,
  Workflow,
  WorkflowStep,
  LLMConfig,
  LLMMessage,
  LLMResponse,
} from './types';

export { feedBus, createFeed } from './feed';
export type {
  Feed,
  FeedType,
  FeedImportance,
  FeedData,
  TechnicalSignalData,
  PolyMarketData,
  MacroRegimeData,
  RiskAlertData,
} from './feed';

export {
  AgentFeedStorage,
  CollectiveMemoryStorage,
  getAgentFeedStorage,
  getCollectiveMemoryStorage,
  enableFeedPersistence,
  startCleanupJob,
} from './feed-storage';
export type {
  CollectiveMemoryEntry,
} from './feed-storage';
