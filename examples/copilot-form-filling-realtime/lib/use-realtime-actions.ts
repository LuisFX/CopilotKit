/**
 * Bridge between CopilotKit actions and OpenAI Realtime tools
 * This hook provides the tools and handlers for voice interactions
 */

import { useMemo, useCallback } from "react";
import { useRealtimeActionHandler } from "@copilotkit/react-core";

interface RealtimeActionsProps {
  onFillForm?: (args: any) => void;
}

export function useRealtimeActions(props?: RealtimeActionsProps) {
  // Use CopilotKit's realtime action handler for proper voice integration
  const { executeVoiceAction, getAvailableActions } = useRealtimeActionHandler();
  
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

    // For other actions, use CopilotKit's voice action handler
    // This will properly execute the action and render GenerativeUI if available
    try {
      const result = await executeVoiceAction(toolName, args);
      console.log(`[RealtimeActions] Voice action executed successfully:`, result);
      return result || { success: true };
    } catch (error) {
      console.error(`[RealtimeActions] Voice action failed:`, error);
      // Action might not exist, return error
      return { error: `Action failed: ${(error as Error).message}` };
    }
  }, [props, executeVoiceAction]);

  return {
    realtimeTools,
    handleToolCall,
  };
}