import { serviceClient, userClient } from "../client";
import { NotFoundError, fromPostgrest } from "../errors";
import { profileInput, toProfileDTO, type ProfileDTO } from "../schemas/user";
import type { Session } from "../session";

export async function getCurrentProfile(session: Session): Promise<ProfileDTO> {
  const { data, error } = await userClient(session)
    .from("profiles")
    .select("*")
    .eq("id", session.userId)
    .maybeSingle();

  if (error) throw fromPostgrest(error, "Profile");
  if (!data) throw new NotFoundError("Profile");

  return toProfileDTO(data);
}

export async function updateCurrentProfile(
  session: Session,
  patch: { fullName: string },
): Promise<ProfileDTO> {
  const { fullName } = profileInput.parse(patch);

  const { data, error } = await serviceClient()
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", session.userId)
    .select("*")
    .single();

  if (error) throw fromPostgrest(error, "Profile");
  return toProfileDTO(data);
}
