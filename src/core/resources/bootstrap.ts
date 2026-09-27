import { membersResource } from './members.resource.ts';
import { registerResource } from './resource-registry.ts';

let bootstrapped = false;

/** Register reference resource manifests once at app startup. */
export function bootstrapResources(): void {
  if (bootstrapped) return;
  registerResource(membersResource);
  bootstrapped = true;
}

/** Test-only: allow re-bootstrap after clearing the registry. */
export function __resetBootstrapForTests(): void {
  bootstrapped = false;
}
