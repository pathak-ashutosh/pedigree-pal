export type AuthState = {
  status: "idle" | "error" | "sent";
  message: string;
  errors?: { email?: string[] };
};

export const initialAuthState: AuthState = { status: "idle", message: "" };
