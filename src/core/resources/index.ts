export { __resetBootstrapForTests, bootstrapResources } from './bootstrap.ts';
export { membersResource } from './members.resource.ts';
export {
  __clearRegistry,
  getResource,
  listResources,
  registerResource,
} from './resource-registry.ts';
export type { Resource, ResourcePermissions, ResourceUI } from './types.ts';
