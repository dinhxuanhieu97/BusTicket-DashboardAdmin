import { backendRequest } from "@/lib/backend-client";
import { staffListSchema, staffUserSchema } from "@/lib/live-contracts";
import {
  errorResponse,
  input,
  json,
  protectMutation,
} from "@/lib/server/session";
import { rejectStaffQuery, staffAccess } from "./access";
import { createStaffInput } from "./contracts";

export async function GET(request: Request) {
  try {
    const { path, token } = await staffAccess();
    rejectStaffQuery(request);
    return json(staffListSchema.parse(await backendRequest(path, { token })));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    protectMutation(request);
    const { path, token } = await staffAccess();
    rejectStaffQuery(request);
    const body = await input(request, createStaffInput);
    const result = await backendRequest(path, { method: "POST", token, body });
    return json(staffUserSchema.parse(result), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
