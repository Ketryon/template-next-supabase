import { z } from "zod";
import type { Tables } from "../types.gen";

export const profileInput = z.object({
  fullName: z.string().min(1).max(120),
});
export type ProfileInput = z.infer<typeof profileInput>;

export type ProfileRow = Tables<"profiles">;

export function toProfileDTO(row: ProfileRow) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role === "admin" ? ("admin" as const) : ("user" as const),
    createdAt: row.created_at,
  };
}
export type ProfileDTO = ReturnType<typeof toProfileDTO>;
