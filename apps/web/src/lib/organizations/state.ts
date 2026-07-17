export type OrganizationActionState = {
  status: "idle" | "error";
  message: string;
  errors?: { name?: string[]; slug?: string[] };
};

export const initialOrganizationState: OrganizationActionState = {
  status: "idle",
  message: "",
};
