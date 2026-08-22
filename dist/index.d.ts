import { Context } from '@deepseek-ai/cordis';

/**
 * Ming Capability Pack - 插件入口
 *
 * DeepSeek Harness 插件（薄适配层）：把自然语言目标一键转交给
 * Harness 原生能力（子代理 / 工具 / LLM）真正完成任务并产出文件。
 */

declare const name = "@mingworkbench/capability-pack";
declare const version = "0.5.0";
/**
 * 硬依赖：tools（注册工具）+ systemPrompt（注入「何时用 ming_auto」提示）。
 * subagents 作为软依赖在运行期按需取用（见 executor）。
 */
declare const inject: string[];
declare function apply(ctx: Context): Promise<void>;

export { apply, inject, name, version };
