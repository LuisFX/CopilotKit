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
        name: "fillMedicalIntakeForm",
        description: "Fill out the medical intake form fields with user-provided information. Use this when the user provides medical details like name, symptoms, chief complaint, etc.",
        parameters: {
          type: "object",
          properties: {
            fullName: {
              type: "string",
              description: "The full name of the patient"
            },
            dateOfBirth: {
              type: "string",
              description: "The patient's date of birth"
            },
            phone: {
              type: "string",
              description: "The patient's phone number"
            },
            emergencyContact: {
              type: "string",
              description: "The name of the emergency contact person"
            },
            emergencyPhone: {
              type: "string",
              description: "The emergency contact's phone number"
            },
            chiefComplaint: {
              type: "string",
              enum: ["chest_pain", "headache", "fever", "abdominal_pain", "shortness_of_breath", "dizziness", "nausea", "fatigue", "other"],
              description: "The primary reason for the visit"
            },
            symptoms: {
              type: "string",
              description: "Detailed description of symptoms"
            },
            painLevel: {
              type: "string",
              enum: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
              description: "The pain level on a scale of 1-10"
            },
            medicalHistory: {
              type: "string",
              description: "Relevant medical history"
            },
            currentMedications: {
              type: "string",
              description: "Current medications (optional)"
            },
            allergies: {
              type: "string",
              description: "Known allergies (optional)"
            }
          },
          required: ["fullName", "dateOfBirth", "phone", "emergencyContact", "emergencyPhone", "chiefComplaint", "symptoms", "painLevel", "medicalHistory"]
        }
      },
      {
        type: "function",
        name: "confirmMedicalIntake",
        description: "Show a confirmation message AFTER the form has been filled. Only use this to display a summary, not to fill the form.",
        parameters: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Summary of the medical intake form to confirm"
            }
          },
          required: ["summary"]
        }
      },
      {
        type: "function",
        name: "scheduleAppointment",
        description: "Schedule a medical appointment for the patient.",
        parameters: {
          type: "object",
          properties: {
            preferredDate: {
              type: "string",
              description: "Preferred date for the appointment (ISO or natural language)"
            },
            preferredTime: {
              type: "string",
              description: "Preferred time for the appointment (e.g., 10:30 AM)"
            },
            appointmentType: {
              type: "string",
              enum: ["new_patient", "follow_up", "telemedicine", "urgent_care", "lab_work", "imaging"],
              description: "Type of appointment"
            },
            provider: {
              type: "string",
              description: "Preferred provider or specialty (optional)"
            }
          },
          required: ["preferredDate", "preferredTime", "appointmentType"]
        }
      }
    ];
  }, []);

  // Handler that executes the corresponding action
  const handleToolCall = useCallback(async (toolName: string, args: any) => {
    console.log(`[RealtimeActions] Tool called: ${toolName}`, args);

    // For fillMedicalIntakeForm, directly call the handler
    if (toolName === "fillMedicalIntakeForm") {
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