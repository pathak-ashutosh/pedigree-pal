export type ApiKeyActionState = {
  status: "idle" | "error" | "created" | "saved";
  message: string;
  key?: string;
};

export const initialApiKeyState: ApiKeyActionState = { status: "idle", message: "" };
