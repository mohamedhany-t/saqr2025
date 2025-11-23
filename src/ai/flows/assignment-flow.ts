
'use server';
/**
 * @fileOverview An AI agent for suggesting courier assignments for shipments.
 *
 * - suggestAssignments - A function that handles the assignment suggestion process.
 * - AssignmentInput - The input type for the suggestAssignments function.
 * - AssignmentOutput - The return type for the suggestAssignments function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Shipment, User, Governorate } from '@/lib/types'; // Using types for schema definition assistance

// Helper schema for a simplified shipment object for the prompt
const PromptShipmentSchema = z.object({
  id: z.string(),
  recipientName: z.string(),
  governorateId: z.string().optional(),
  address: z.string(),
});

// Helper schema for a simplified courier object for the prompt
const PromptCourierSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  activeShipments: z.number().describe("The number of shipments currently assigned to the courier."),
});

// Main input schema for the flow
const AssignmentInputSchema = z.object({
  shipments: z.array(PromptShipmentSchema).describe("A list of unassigned shipments."),
  couriers: z.array(PromptCourierSchema).describe("A list of available couriers and their current workload."),
});
export type AssignmentInput = z.infer<typeof AssignmentInputSchema>;

// Main output schema for the flow
const AssignmentOutputSchema = z.object({
  assignments: z.array(z.object({
    shipmentId: z.string().describe("The ID of the shipment to be assigned."),
    courierId: z.string().describe("The ID of the courier to assign the shipment to."),
    reasoning: z.string().describe("A brief justification for why this assignment was suggested."),
  })).describe("A list of suggested assignments."),
});
export type AssignmentOutput = z.infer<typeof AssignmentOutputSchema>;


/**
 * Public-facing wrapper function to call the assignment flow.
 * @param input The unassigned shipments and available couriers.
 * @returns A promise that resolves to the suggested assignments.
 */
export async function suggestAssignments(input: AssignmentInput): Promise<AssignmentOutput> {
  return assignmentFlow(input);
}


const assignmentPrompt = ai.definePrompt({
    name: 'assignmentPrompt',
    input: { schema: AssignmentInputSchema },
    output: { schema: AssignmentOutputSchema },
    prompt: `You are an expert logistics coordinator for a delivery company in Egypt.
Your task is to assign a list of new shipments to the most suitable couriers.

Your goal is to be as efficient as possible. Efficiency is defined by these rules, in order of importance:
1.  **Geographic Proximity:** Assign shipments to couriers who are likely already delivering in the same governorate. Grouping deliveries by area is the top priority.
2.  **Balanced Workload:** Distribute shipments evenly among couriers. Avoid overloading one courier while others have few shipments. A courier with fewer active shipments is generally a better candidate.

Here are the unassigned shipments:
{{#each shipments}}
- Shipment ID: {{{id}}}, Recipient: {{{recipientName}}}, Governorate ID: {{{governorateId}}}, Address: {{{address}}}
{{/each}}

Here are the available couriers and their current number of active shipments:
{{#each couriers}}
- Courier ID: {{{id}}}, Name: {{{name}}}, Active Shipments: {{{activeShipments}}}
{{/each}}

Based on the rules above, provide a list of assignments. For each assignment, provide the shipment ID, the courier ID, and a very brief reasoning for your choice.
`,
});

const assignmentFlow = ai.defineFlow(
  {
    name: 'assignmentFlow',
    inputSchema: AssignmentInputSchema,
    outputSchema: AssignmentOutputSchema,
  },
  async (input) => {
    const { output } = await assignmentPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return any output.");
    }
    return output;
  }
);
