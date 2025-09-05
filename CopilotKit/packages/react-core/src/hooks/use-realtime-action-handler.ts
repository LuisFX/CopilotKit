/**
 * Realtime Action Handler for CopilotKit
 * 
 * This hook provides integration between voice/realtime commands and CopilotKit actions,
 * using the unified ActionExecutionMessage with metadata for voice context.
 */

import { useCallback } from "react";
import { useCopilotContext, useCopilotMessagesContext } from "../context";
import { FrontendAction } from "../types/frontend-action";
import { ActionExecutionMessage } from "@copilotkit/runtime-client-gql";

export interface UseRealtimeActionHandlerReturn {
  /**
   * Execute an action with source context (voice/text/api)
   */
  executeAction: (actionName: string, args: Record<string, any>, source?: 'voice' | 'text' | 'api') => Promise<any>;
  
  /**
   * Get all available actions
   */
  getAvailableActions: () => FrontendAction<any>[];
  
  /**
   * Backward compatibility for voice actions
   */
  executeVoiceAction?: (actionName: string, args: Record<string, any>) => Promise<any>;
}

export function useRealtimeActionHandler(): UseRealtimeActionHandlerReturn {
  const { actions } = useCopilotContext();
  const { messages, setMessages } = useCopilotMessagesContext();
  
  const executeAction = useCallback(async (
    actionName: string, 
    args: Record<string, any>,
    source: 'voice' | 'text' | 'api' = 'text'
  ) => {
    console.log(`[RealtimeActionHandler] Executing action: ${actionName} from ${source}`, args);
    
    // Find the specific action
    const action = Object.values(actions).find((a: any) => a.name === actionName);
    
    if (!action) {
      console.warn(`[RealtimeActionHandler] Action not found: ${actionName}`);
      throw new Error(`Action not found: ${actionName}`);
    }
    
    console.log(`[RealtimeActionHandler] Found action with render:`, !!action.render);
    
    // Create ActionExecutionMessage with metadata for source
    const actionMessage = new ActionExecutionMessage({
      id: `${source}-action-${Date.now()}`,
      name: actionName,
      arguments: args,
      parentMessageId: messages.length > 0 ? messages[messages.length - 1].id : null,
      metadata: {
        source,
        skipInference: source === 'voice', // Voice actions skip inference by default
        ...(source === 'voice' && { voiceData: { timestamp: Date.now() } })
      }
    } as any);
    
    // Add the action message to trigger rendering
    setMessages([...messages, actionMessage]);
    console.log(`[RealtimeActionHandler] Added ActionExecutionMessage with ${source} metadata`);
    
    // Execute the action handler if it exists
    if (action.handler) {
      try {
        const result = await action.handler(args);
        console.log(`[RealtimeActionHandler] Action handler executed successfully:`, result);
        return result;
      } catch (error) {
        console.error(`[RealtimeActionHandler] Action handler failed:`, error);
        throw error;
      }
    }
    
    return { success: true };
  }, [actions, messages, setMessages]);
  
  const getAvailableActions = useCallback(() => {
    return Object.values(actions) as FrontendAction<any>[];
  }, [actions]);
  
  return {
    executeAction,
    getAvailableActions,
    // Backwards compatibility aliases
    executeVoiceAction: (name: string, args: Record<string, any>) => executeAction(name, args, 'voice'),
  };
}