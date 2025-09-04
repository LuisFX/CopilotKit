"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { VoiceControls } from "./VoiceControls";
import { useRealtimeActions } from "@/lib/use-realtime-actions";

// Define the form schema with Zod
const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  dateOfBirth: z.date({
    required_error: "Please select your date of birth.",
  }),
  phone: z.string().min(10, {
    message: "Please enter a valid phone number.",
  }),
  emergencyContact: z.string().min(2, {
    message: "Emergency contact name must be at least 2 characters.",
  }),
  emergencyPhone: z.string().min(10, {
    message: "Please enter a valid emergency contact phone number.",
  }),
  chiefComplaint: z.string({
    required_error: "Please select your chief complaint.",
  }),
  symptoms: z.string().min(10, {
    message: "Please describe your symptoms in detail (at least 10 characters).",
  }),
  painLevel: z.string({
    required_error: "Please select your pain level.",
  }),
  medicalHistory: z.string().min(10, {
    message: "Please provide relevant medical history (at least 10 characters).",
  }),
  currentMedications: z.string().optional(),
  allergies: z.string().optional(),
});

export function MedicalIntakeForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      dateOfBirth: undefined,
      phone: "",
      emergencyContact: "",
      emergencyPhone: "",
      chiefComplaint: "",
      symptoms: "",
      painLevel: "",
      medicalHistory: "",
      currentMedications: "",
      allergies: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    alert("Medical intake form submitted successfully!");
    form.reset({
      name: "",
      dateOfBirth: undefined,
      phone: "",
      emergencyContact: "",
      emergencyPhone: "",
      chiefComplaint: "",
      symptoms: "",
      painLevel: "",
      medicalHistory: "",
      currentMedications: "",
      allergies: "",
    });
  }

  useCopilotReadable({
    description: "The medical intake form fields and their current values",
    value: form,
  }, [form]);

  // Action for showing confirmation UI through voice
  useCopilotAction({
    name: "confirmMedicalIntake",
    description: "Show confirmation dialog for the medical intake form before submission",
    parameters: [
      {
        name: "summary",
        type: "string",
        required: true,
        description: "Summary of the medical intake form to confirm"
      }
    ],
    render: ({ args }) => {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-green-900 mb-2">🏥 Confirming Medical Intake</h3>
          <p className="text-green-800">{args.summary}</p>
          <p className="text-sm text-green-600 mt-2">The form has been filled. Please review and submit.</p>
        </div>
      );
    },
  });

  useCopilotAction({
    name: "fillMedicalIntakeForm",
    description: "Fill out the medical intake form",
    parameters: [
      {
        "name": "fullName",
        "type": "string",
        "required": true,
        "description": "The full name of the patient"
      },
      {
        "name": "dateOfBirth",
        "type": "string",
        "required": true,
        "description": "The patient's date of birth"
      },
      {
        "name": "phone",
        "type": "string",
        "required": true,
        "description": "The patient's phone number"
      },
      {
        "name": "emergencyContact",
        "type": "string",
        "required": true,
        "description": "The name of the emergency contact person"
      },
      {
        "name": "emergencyPhone",
        "type": "string",
        "required": true,
        "description": "The emergency contact's phone number"
      },
      {
        "name": "chiefComplaint",
        "type": "string",
        "required": true,
        "description": "The primary reason for the visit, must be one of: chest_pain, headache, fever, abdominal_pain, shortness_of_breath, dizziness, nausea, fatigue, other"
      },
      {
        "name": "symptoms",
        "type": "string",
        "required": true,
        "description": "Detailed description of symptoms, be as specific as possible. At least 30 words."
      },
      {
        "name": "painLevel",
        "type": "string",
        "required": true,
        "description": "The pain level on a scale of 1-10, must be one of: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10"
      },
      { 
        "name": "medicalHistory",
        "type": "string",
        "required": true,
        "description": "Relevant medical history including past conditions, surgeries, and chronic illnesses."
      },
      { 
        "name": "currentMedications",
        "type": "string",
        "required": false,
        "description": "Current medications the patient is taking, including dosages if known."
      },
      { 
        "name": "allergies",
        "type": "string",
        "required": false,
        "description": "Known allergies to medications, foods, or other substances."
      },
    ],
    handler: async (action) => {
      form.setValue("name", action.fullName);
      form.setValue("dateOfBirth", new Date(action.dateOfBirth));
      form.setValue("phone", action.phone);
      form.setValue("emergencyContact", action.emergencyContact);
      form.setValue("emergencyPhone", action.emergencyPhone);
      form.setValue("chiefComplaint", action.chiefComplaint);
      form.setValue("symptoms", action.symptoms);
      form.setValue("painLevel", action.painLevel);
      form.setValue("medicalHistory", action.medicalHistory);
      form.setValue("currentMedications", action.currentMedications || "");
      form.setValue("allergies", action.allergies || "");
    },
  });

  // Bridge CopilotKit actions with Realtime tools
  const { realtimeTools, handleToolCall } = useRealtimeActions({
    onFillForm: (args) => {
      // Fill the form with the provided data
      form.setValue("name", args.fullName || "");
      form.setValue("phone", args.phone || "");
      form.setValue("emergencyContact", args.emergencyContact || "");
      form.setValue("emergencyPhone", args.emergencyPhone || "");
      form.setValue("chiefComplaint", args.chiefComplaint || "other");
      form.setValue("symptoms", args.symptoms || "");
      form.setValue("painLevel", args.painLevel || "1");
      form.setValue("medicalHistory", args.medicalHistory || "");
      form.setValue("currentMedications", args.currentMedications || "");
      form.setValue("allergies", args.allergies || "");
      
      // Parse and set date of birth if provided
      if (args.dateOfBirth) {
        const parsedDate = new Date(args.dateOfBirth);
        if (!isNaN(parsedDate.getTime())) {
          form.setValue("dateOfBirth", parsedDate);
        }
      }
    }
  });

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <VoiceControls 
        tools={realtimeTools}
        onToolCall={handleToolCall}
      />
      <Card>
      <CardHeader>
        <CardTitle>Medical Intake Form</CardTitle>
        <CardDescription>
          Please provide your medical information for our healthcare team. All information is confidential and secure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Birth</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick your date of birth</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergencyContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="emergencyPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="(555) 987-6543" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="chiefComplaint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chief Complaint</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your main concern" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="chest_pain">Chest Pain</SelectItem>
                        <SelectItem value="headache">Headache</SelectItem>
                        <SelectItem value="fever">Fever</SelectItem>
                        <SelectItem value="abdominal_pain">Abdominal Pain</SelectItem>
                        <SelectItem value="shortness_of_breath">Shortness of Breath</SelectItem>
                        <SelectItem value="dizziness">Dizziness</SelectItem>
                        <SelectItem value="nausea">Nausea</SelectItem>
                        <SelectItem value="fatigue">Fatigue</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="painLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pain Level (1-10)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pain level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">1 - No pain</SelectItem>
                        <SelectItem value="2">2 - Very mild</SelectItem>
                        <SelectItem value="3">3 - Mild</SelectItem>
                        <SelectItem value="4">4 - Moderate</SelectItem>
                        <SelectItem value="5">5 - Moderate</SelectItem>
                        <SelectItem value="6">6 - Moderate to severe</SelectItem>
                        <SelectItem value="7">7 - Severe</SelectItem>
                        <SelectItem value="8">8 - Very severe</SelectItem>
                        <SelectItem value="9">9 - Intense</SelectItem>
                        <SelectItem value="10">10 - Unbearable</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="symptoms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symptoms Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please describe your symptoms in detail, including when they started, how they feel, and any patterns you've noticed."
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="medicalHistory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical History</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please provide relevant medical history including past conditions, surgeries, hospitalizations, and chronic illnesses."
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currentMedications"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Medications (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="List any medications you are currently taking, including dosages if known."
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allergies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allergies (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="List any known allergies to medications, foods, or other substances."
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">Submit Medical Intake Form</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    </div>
  );
} 