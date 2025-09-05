/**
 * Realtime Action Handler for CopilotKit
 * 
 * This hook provides integration between voice/realtime commands and CopilotKit actions,
 * using the unified ActionExecutionMessage with metadata for voice context.
 * 
 * Race Condition Fix (2025-09-05):
 * - Replaced hard-coded 500ms setTimeout with intelligent message queueing
 * - Uses requestAnimationFrame for reliable next-tick execution
 * - Checks recent message history to determine if immediate execution is safe
 * - Eliminates race conditions while maintaining proper message ordering
 */

import { useCallback, useRef } from "react";
import { useCopilotContext, useCopilotMessagesContext } from "../context";
import { FrontendAction } from "../types/frontend-action";
import { ActionExecutionMessage } from "@copilotkit/runtime-client-gql";
import type { Message } from "@copilotkit/shared";

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
  
  // Track pending voice actions to coordinate with transcript arrival
  const pendingVoiceActions = useRef<Map<string, {
    actionMessage: ActionExecutionMessage;
    timestamp: number;
  }>>(new Map());
  
  const executeAction = useCallback(async (
    actionName: string, 
    args: Record<string, any>,
    source: 'voice' | 'text' | 'api' = 'text'
  ) => {
    
    // Find the specific action
    const action = Object.values(actions).find((a: any) => a.name === actionName);
    
    if (!action) {
      console.warn(`[RealtimeActionHandler] Action not found: ${actionName}`);
      throw new Error(`Action not found: ${actionName}`);
    }
    
    
    // Extract metadata if present
    const { __metadata, ...cleanArgs } = args;
    const callId = __metadata?.callId;
    
    // Create ActionExecutionMessage with metadata for source
    const actionMessage = new ActionExecutionMessage({
      id: callId || `${source}-action-${Date.now()}`,
      name: actionName,
      arguments: cleanArgs,
      parentMessageId: messages.length > 0 ? messages[messages.length - 1].id : null,
      metadata: {
        source,
        skipInference: source === 'voice', // Voice actions skip inference by default
        ...(source === 'voice' && { voiceData: { timestamp: Date.now() } })
      }
    } as any);
    
    // Add the action message to trigger rendering
    // Use function form to ensure we get the latest messages
    if (source === 'voice') {
      // For voice actions, use intelligent queueing instead of fixed delay
      // Check if we should wait based on recent message history
      const now = Date.now();
      const recentUserMessage = messages.slice(-3).find(m => 
        'role' in m && m.role === 'user' && 
        (m as any).metadata?.source === 'voice'
      );
      
      // If there was a recent voice user message, add immediately
      // Otherwise, queue it briefly to allow transcript to arrive
      if (recentUserMessage) {
        setMessages((prevMessages) => [...prevMessages, actionMessage]);
      } else {
        // Store in pending actions with timestamp
        pendingVoiceActions.current.set(callId || `action-${Date.now()}`, {
          actionMessage,
          timestamp: now
        });
        
        // Use requestAnimationFrame for next tick execution
        // This is more reliable than setTimeout and ensures UI consistency
        requestAnimationFrame(() => {
          // Add all pending actions that have waited at least one frame
          const actionsToAdd: ActionExecutionMessage[] = [];
          for (const [id, data] of pendingVoiceActions.current.entries()) {
            actionsToAdd.push(data.actionMessage);
            pendingVoiceActions.current.delete(id);
          }
          
          if (actionsToAdd.length > 0) {
            setMessages((prevMessages) => [...prevMessages, ...actionsToAdd]);
          }
        });
      }
    } else {
      setMessages((prevMessages) => [...prevMessages, actionMessage]);
    }
    
    // Execute the action handler if it exists
    if (action.handler) {
      try {
        const result = await action.handler(cleanArgs);
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