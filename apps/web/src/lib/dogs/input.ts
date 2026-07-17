import { z } from "zod";
import { parseDogInput, type DogInput } from "@/domain/dogs";
import { fingerprintMicrochip } from "./microchip";

const dogFormSchema = z.object({
  registeredName: z.string(),
  callName: z.string().optional(),
  breed: z.string(),
  sex: z.string(),
  birthDate: z.string(),
  microchip: z.string().trim().max(80).optional(),
  notes: z.string().optional(),
});

export function parseDogFormData(formData: FormData, today = new Date()): DogInput {
  const form = dogFormSchema.parse({
    registeredName: formData.get("registeredName"),
    callName: formData.get("callName") || undefined,
    breed: formData.get("breed"),
    sex: formData.get("sex"),
    birthDate: formData.get("birthDate"),
    microchip: formData.get("microchip") || undefined,
    notes: formData.get("notes") || undefined,
  });

  return parseDogInput(
    {
      ...form,
      microchipHash: form.microchip ? fingerprintMicrochip(form.microchip) : undefined,
      microchip: undefined,
    },
    today,
  );
}
