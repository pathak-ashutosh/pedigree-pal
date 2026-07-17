export type DogActionState = {
  status: "idle" | "error" | "saved";
  message: string;
  errors?: Record<string, string[]>;
};

export const initialDogState: DogActionState = { status: "idle", message: "" };
