/**
 * Bridge between CopilotKit actions and OpenAI Realtime tools
 * This hook provides the tools and handlers for voice interactions
 */

import { useMemo, useCallback } from "react";

interface RealtimeActionsProps {
  onFillForm?: (args: any) => void;
  onConfirm?: (summary: string) => void;
}

export function useRealtimeActions(props?: RealtimeActionsProps) {
  // Convert CopilotKit actions to Realtime tool format
  const realtimeTools = useMemo(() => {
    return [
      {
        type: "function",
        name: "fillIncidentReportForm",
        description: "Fill out the incident report form with the provided information",
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
        description: "Show confirmation dialog for the incident report",
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
      if (props?.onFillForm) {
        props.onFillForm(args);
      }
      return { success: true, message: "Form filled successfully" };
    }

    // For confirmIncidentReport, we can trigger a confirmation UI
    if (toolName === "confirmIncidentReport") {
      if (props?.onConfirm) {
        props.onConfirm(args.summary);
      }
      // For now, just log it - in a real app, this would trigger UI
      console.log(`[RealtimeActions] Confirmation: ${args.summary}`);
      return { success: true, message: "Confirmation shown" };
    }

    return { error: `Unknown tool: ${toolName}` };
  }, [props]);

  return {
    realtimeTools,
    handleToolCall,
  };
}