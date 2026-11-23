import { alertSettingsInput, alertSettingsSchema } from "@/lib/alert-settings";
import { backendRequest } from "@/lib/backend-client";
import { alertAccess } from "@/lib/server/alert-access";
import {
  errorResponse,
  input,
  json,
  protectMutation,
} from "@/lib/server/session";

export async function GET() {
  try {
    const { token, path } = await alertAccess();
    return json(
      alertSettingsSchema.parse(await backendRequest(path, { token })),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    protectMutation(request);
    const { token, path } = await alertAccess();
    const body = await input(request, alertSettingsInput);
    return json(
      alertSettingsSchema.parse(
        await backendRequest(path, { token, method: "PUT", body }),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
