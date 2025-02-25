import { Client } from "../apiv2";
import { FirebaseError } from "../error";
import { runOrigin } from "../api";
import * as proto from "./proto";

const API_VERSION = "v1";

const client = new Client({
  urlPrefix: runOrigin,
  auth: true,
  apiVersion: API_VERSION,
});

export const LOCATION_LABEL = "cloud.googleapis.com/location";

// Unfortuantely, Omit<> doesn't allow supbath, so it's hard to have a reasonable API that
// declares all mandatory fields as mandatory and then accepts an Omit<> for update types.

export interface ObjectMetadata {
  name: string;

  // Must be the project ID or project number
  namespace: string;

  labels?: Record<string, string>;

  // Not supported in Cloud Run:
  generate_name?: string;
  deletionGracePeriodSeconds?: number;
  finalizers?: string[];
  clusterName?: string;

  // Output only:
  selfLink?: string;
  uid?: string;
  resourceVersion?: string;
  generation?: number;
  createTime?: string;

  // Onput only; not supported by Cloud Run
  ownerReference?: unknown;
  deleteTime?: string;
}

export interface Addressable {
  url: string;
}

export interface Condition {
  type: string;
  status: string;
  reason: string;
  message: string;
  lastTransitionTime: string;
  severity: "Error" | "Warning" | "Info";
}

export interface ServiceSpec {
  template: RevisionTemplate;
  traffic: TrafficTarget[];
}

// All fields in ServiceStatus are output only so we will assume
// that an input Service will just Omit<"status">
export interface ServiceStatus {
  observedGeneration: number;
  conditions: Condition[];
  latestRevisionName: string;
  latestCreatedRevisionName: string;
  traffic: TrafficTarget[];
  url: string;
  address: Addressable;
}

export interface Service {
  apiVersion: "serving.knative.dev/v1";
  kind: "service";
  metadata: ObjectMetadata;
  spec: ServiceSpec;
  status?: ServiceStatus;
}

export interface RevisionSpec {
  containerConcurrency?: number | null;
}

export interface RevisionTemplate {
  metadata: ObjectMetadata;
  spec: RevisionSpec;
}

export interface TrafficTarget {
  configurationName: string;
  // RevisionName can be used to target a specific revision,
  // or customers can set latestRevision = true
  revisionName?: string;
  latestRevision?: boolean;
  percent: number;
  tag?: string;

  // Output only:
  // Displayed when TrafficTarget is part of a status and forbidden
  // when TrafficTarget is part of spec.
  url?: string;
}

export interface IamPolicy {
  version: number;
  bindings: Record<string, unknown>[];
  auditConfigs?: Record<string, unknown>[];
  etag?: string;
}

export const DEFAULT_PUBLIC_POLICY = {
  version: 3,
  bindings: [
    {
      role: "roles/run.invoker",
      members: ["allUsers"],
    },
  ],
};

export async function getService(name: string): Promise<Service> {
  try {
    const response = await client.get<Service>(name);
    return response.body;
  } catch (err) {
    throw new FirebaseError(`Failed to fetch Run service ${name}`, {
      original: err,
    });
  }
}

export async function replaceService(name: string, service: Service): Promise<Service> {
  try {
    const response = await client.put<Service, Service>(name, service);
    return response.body;
  } catch (err) {
    throw new FirebaseError(`Failed to update Run service ${name}`, {
      original: err,
    });
  }
}

/**
 * Sets the IAM policy of a Service
 * @param name Fully qualified name of the Service.
 * @param policy The [policy](https://cloud.google.com/run/docs/reference/rest/v1/projects.locations.services/setIamPolicy) to set.
 */
export async function setIamPolicy(name: string, policy: IamPolicy): Promise<void> {
  // Cloud Run has an atypical REST binding for SetIamPolicy. Instead of making the body a policy and
  // the update mask a query parameter (e.g. Cloud Functions v1) the request body is the literal
  // proto.
  interface Request {
    policy: IamPolicy;
    updateMask: string;
  }
  try {
    await client.post<Request, IamPolicy>(`${name}:setIamPolicy`, {
      policy,
      updateMask: proto.fieldMasks(policy).join(","),
    });
  } catch (err) {
    throw new FirebaseError(`Failed to set the IAM Policy on the Service ${name}`, {
      original: err,
    });
  }
}
