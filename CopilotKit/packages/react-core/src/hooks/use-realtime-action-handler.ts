/**
 * Voice/Realtime Action Handler for CopilotKit
 * 
 * This hook provides proper integration between voice commands and CopilotKit actions,
 * ensuring that GenerativeUI renders correctly through the normal pipeline.
 */

import { useCallback } from "react";
import { useCopilotContext, useCopilotMessagesContext } from "../context";
import { FrontendAction } from "../types/frontend-action";
import { TextMessage, Role, ActionExecutionMessage, ResultMessage } from "@copilotkit/runtime-client-gql";

export interface UseRealtimeActionHandlerReturn {
  /**
   * Execute an action triggered by voice, with proper GenerativeUI support
   */
  executeVoiceAction: (actionName: string, args: Record<string, any>) => Promise<any>;
  
  /**
   * Get all available actions for voice commands
   */
  getAvailableActions: () => FrontendAction<any>[];
  
  /**
   * Send a GenerativeUI message for voice actions
   */
  sendVoiceGenerativeUI: (actionName: string, args: Record<string, any>) => Promise<any>;
}

export function useRealtimeActionHandler(): UseRealtimeActionHandlerReturn {
  const { actions } = useCopilotContext();
  const { messages, setMessages } = useCopilotMessagesContext();
  
  const executeVoiceAction = useCallback(async (actionName: string, args: Record<string, any>) => {
    console.log(`[RealtimeActionHandler] Executing voice action: ${actionName}`, args);
    
    // Find the specific action
    const action = Object.values(actions).find((a: any) => a.name === actionName);
    
    if (!action) {
      console.warn(`[RealtimeActionHandler] Action not found: ${actionName}`);
      throw new Error(`Action not found: ${actionName}`);
    }
    
    console.log(`[RealtimeActionHandler] Found action with render:`, !!action.render);
    
    // If the action has a render function, add an ActionExecutionMessage to trigger rendering
    if (action.render) {
      const actionMessage = new ActionExecutionMessage({
        id: `voice-action-${Date.now()}`,
        name: actionName,
        arguments: args,
        parentMessageId: messages.length > 0 ? messages[messages.length - 1].id : null,
      });
      
      // Add the action message to trigger rendering
      setMessages([...messages, actionMessage]);
      console.log(`[RealtimeActionHandler] Added ActionExecutionMessage for GenerativeUI rendering`);
    }
    
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
  
  const sendVoiceGenerativeUI = useCallback(async (actionName: string, args: Record<string, any>) => {
    console.log(`[RealtimeActionHandler] Sending GenerativeUI for voice action: ${actionName}`, args);
    
    // Find the specific action
    const action = Object.values(actions).find((a: any) => a.name === actionName);
    
    if (!action) {
      console.warn(`[RealtimeActionHandler] Action not found: ${actionName}`);
      throw new Error(`Action not found: ${actionName}`);
    }
    
    // This function will be used by the useRealtimeChat hook to trigger GenerativeUI
    // The actual message sending will be handled by the parent component using the action's render function
    if (action.render) {
      console.log(`[RealtimeActionHandler] Action has render function, ready for GenerativeUI`);
      return { render: action.render, args };
    } else {
      console.log(`[RealtimeActionHandler] Action has no render function`);
      return null;
    }
  }, [actions]);
  
  const getAvailableActions = useCallback(() => {
    return Object.values(actions) as FrontendAction<any>[];
  }, [actions]);
  
  return {
    executeVoiceAction,
    getAvailableActions,
    sendVoiceGenerativeUI,
  };
}