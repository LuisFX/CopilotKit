/**
 * Bridge between CopilotKit actions and OpenAI Realtime tools
 * This hook provides the tools and handlers for voice interactions
 */

import { useMemo, useCallback } from "react";
import { useCopilotContext, useCopilotChatInternal } from "@copilotkit/react-core";
import { ActionExecutionMessage } from "@copilotkit/runtime-client-gql";

interface RealtimeActionsProps {
  onFillForm?: (args: any) => void;
}

export function useRealtimeActions(props?: RealtimeActionsProps) {
  // Get access to CopilotKit's actions registry
  const { actions } = useCopilotContext();
  const { appendMessage, sendMessage } = useCopilotChatInternal();
  
  // Convert CopilotKit actions to Realtime tool format
  const realtimeTools = useMemo(() => {
    return [
      {
        type: "function",
        name: "fillIncidentReportForm",
        description: "Fill out the incident report form fields with user-provided information. Use this when the user provides incident details like name, email, incident type, etc.",
        parameters: {
          type: "object",
          properties: {
            fullName: {
              type: "string",
              description: "The full name of the person reporting the incident"
            },
            email: {
              type: "string",
              description: "The email address of the person reporting the incident"
            },
            incidentDescription: {
              type: "string",
              description: "Detailed description of the incident"
            },
            date: {
              type: "string",
              description: "The date when the incident occurred"
            },
            incidentLevel: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description: "The severity level"
            },
            incidentType: {
              type: "string",
              enum: ["phishing", "malware", "data_breach", "unauthorized_access", "ddos", "other"],
              description: "The type of incident"
            },
            suggestedActions: {
              type: "string",
              description: "Suggested actions to take"
            }
          },
          required: ["fullName", "email", "incidentDescription", "date", "incidentLevel", "incidentType"]
        }
      },
      {
        type: "function",
        name: "confirmIncidentReport",
        description: "Show a confirmation message AFTER the form has been filled. Only use this to display a summary, not to fill the form.",
        parameters: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Summary of the incident report to confirm"
            }
          },
          required: ["summary"]
        }
      }
    ];
  }, []);

  // Handler that executes the corresponding action
  const handleToolCall = useCallback(async (toolName: string, args: any) => {
    console.log(`[RealtimeActions] Tool called: ${toolName}`, args);

    // For fillIncidentReportForm, directly call the handler
    if (toolName === "fillIncidentReportForm") {
      console.log(`[RealtimeActions] Filling form with data:`, args);
      if (props?.onFillForm) {
        props.onFillForm(args);
        console.log(`[RealtimeActions] Form filled successfully`);
      } else {
        console.warn(`[RealtimeActions] No onFillForm handler provided`);
      }
      return { success: true, message: "Form filled successfully" };
    }

    // For confirmIncidentReport, use CopilotKit's action render
    if (toolName === "confirmIncidentReport") {
      // Find the action in CopilotKit's registry
      const action = Object.values(actions).find((a: any) => a.name === "confirmIncidentReport") as any;
      
      console.log(`[RealtimeActions] Looking for confirmIncidentReport action`);
      console.log(`[RealtimeActions] Found action:`, !!action);
      console.log(`[RealtimeActions] Action has render:`, !!action?.render);
      console.log(`[RealtimeActions] All registered actions:`, Object.values(actions).map((a: any) => a.name));
      
      if (action && action.render) {
        // Try both approaches to ensure the message appears
        const messageId = `confirm-${Date.now()}`;
        
        // Approach 1: Create ActionExecutionMessage and append it
        const actionMessage = new ActionExecutionMessage({
          id: messageId,
          name: "confirmIncidentReport",
          arguments: args,
          parentMessageId: null,
        });
        
        console.log(`[RealtimeActions] Creating ActionExecutionMessage with id: ${messageId}`);
        
        // Use appendMessage to add the GQL message directly
        await appendMessage(actionMessage, { followUp: false });
        
        // Approach 2: Also send a regular message with the confirmation summary
        // This ensures something appears in the chat even if generativeUI doesn't work
        await sendMessage({
          id: `${messageId}-text`,
          role: "assistant",
          content: `✅ ${args.summary || "Incident report confirmed and ready for submission."}`,
        }, { followUp: false });
        
        console.log(`[RealtimeActions] Messages added successfully`);
      } else {
        console.warn(`[RealtimeActions] No action found or no render function for confirmIncidentReport`);
        // Fallback: just send a text confirmation
        await sendMessage({
          id: `confirm-fallback-${Date.now()}`,
          role: "assistant", 
          content: `✅ ${args.summary || "Incident report confirmed."}`,
        }, { followUp: false });
      }
      
      return { success: true, message: "Confirmation shown" };
    }

    return { error: `Unknown tool: ${toolName}` };
  }, [props, actions, appendMessage, sendMessage]);

  return {
    realtimeTools,
    handleToolCall,
  };
}