import { Context } from '@deepseek-ai/cordis';

/**
 * Ming Capability Pack - 插件入口
 *
 * DeepSeek Harness 插件：把自然语言需求翻译成「能力配方」，
 * 并通过 Harness 原生能力（子代理 / 工具 / LLM）真正完成任务。
 */

declare const name = "@mingworkbench/capability-pack";
declare const version = "0.3.0";
/**
 * 硬依赖：tools（注册 ming_auto 工具必需）。
 * llm / subagents 作为软依赖在运行期按需取用（见 executor / intent-analyzer）。
 */
declare const inject: string[];
declare function apply(ctx: Context): Promise<void>;

export { apply, inject, name, version };
