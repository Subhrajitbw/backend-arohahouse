import * as React from 'react';
import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ShieldCheck } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Prompt,
  Select,
  Switch,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { Form } from '../../components/Form/Form';
import { InputField } from '../../components/Form/InputField';
import { TextareaField } from '../../components/Form/TextareaField';
import { SelectField } from '../../components/Form/SelectField';
import { withQueryClient } from '../../components/QueryClientProvider';

const adminFetch = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
};

type Role = {
  id: string;
  name: string;
  description?: string | null;
  is_super: boolean;
  role_permissions?: Array<{ permission?: Permission }>;
};

type Permission = {
  id: string;
  name: string;
  type: 'predefined' | 'custom';
  matcherType: 'api';
  matcher: string;
  actionType: 'read' | 'write' | 'delete';
  key: string;
  method: string;
  path: string;
  description?: string | null;
  category_id?: string | null;
};

type PermissionCategory = {
  id: string;
  name: string;
  type: 'predefined' | 'custom';
};

const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  access_level: z
    .enum(['custom', 'view', 'edit', 'full'])
    .optional()
    .default('custom'),
});

const updateRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

type ActionType = Permission['actionType'];

const PermissionChip: React.FC<{
  permission: Permission;
  draggable?: boolean;
  onClick?: () => void;
}> = ({ permission, draggable = true, onClick }) => (
  <div
    draggable={draggable}
    onClick={onClick}
    onDragStart={(event) => {
      event.dataTransfer.setData('permission_id', permission.id);
      event.dataTransfer.setData('permission_key', permission.key ?? '');
    }}
    className="flex items-center justify-between gap-2 rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-2 text-sm hover:border-ui-border-interactive cursor-grab"
  >
    <div className="flex flex-col">
      <Text weight="plus">{permission.name}</Text>
      <Text size="small" className="text-ui-fg-subtle">
        {permission.matcher} • {permission.actionType}
      </Text>
    </div>
    <Badge color="blue">{permission.actionType}</Badge>
  </div>
);

const RoleBuilder: React.FC<{
  roles: Role[];
  permissions: Permission[];
  categories: PermissionCategory[];
  onRoleChange: (roleId: string) => void;
  selectedRoleId?: string;
}> = ({ roles, permissions, categories, onRoleChange, selectedRoleId }) => {
  const queryClient = useQueryClient();
  const selectedRole = roles.find((role) => role.id === selectedRoleId);
  const [permissionSearch, setPermissionSearch] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'routes' | 'drag'>('routes');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [actionFilter, setActionFilter] = React.useState<string>('all');

  const createRoleMutation = useMutation({
    mutationFn: async (values: z.infer<typeof createRoleSchema>) =>
      adminFetch<Role>('/admin/rbac/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          is_super: values.access_level === 'full',
        }),
      }),
    onSuccess: async (role, values) => {
      const accessLevel = values.access_level ?? 'custom';
      if (accessLevel === 'view' || accessLevel === 'edit') {
        const actionTypes: ActionType[] =
          accessLevel === 'view' ? ['read'] : ['read', 'write'];
        const permissionIds = permissions
          .filter((permission) => actionTypes.includes(permission.actionType))
          .map((permission) => permission.id);

        if (permissionIds.length) {
          await adminFetch(`/admin/rbac/roles/${role.id}/permissions`, {
            method: 'POST',
            body: JSON.stringify({ permission_ids: permissionIds }),
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] });
      toast.success('Role created');
      onRoleChange(role.id);
    },
    onError: (err) => {
      console.error(err);
      toast.error('Failed to create role');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (values: z.infer<typeof updateRoleSchema>) =>
      adminFetch(`/admin/rbac/roles/${selectedRoleId}`, {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          description: values.description,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] });
      toast.success('Role updated');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Failed to update role');
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) =>
      adminFetch(`/admin/rbac/roles/${roleId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] });
      toast.success('Role deleted');
      onRoleChange('');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Failed to delete role');
    },
  });

  const addPermissionMutation = useMutation({
    mutationFn: async (permissionIds: string[]) =>
      adminFetch(`/admin/rbac/roles/${selectedRoleId}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ permission_ids: permissionIds }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] });
    },
  });

  const removePermissionMutation = useMutation({
    mutationFn: async (permissionIds: string[]) =>
      adminFetch(`/admin/rbac/roles/${selectedRoleId}/permissions`, {
        method: 'DELETE',
        body: JSON.stringify({ permission_ids: permissionIds }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] });
    },
  });

  const assignedIds = new Set(
    selectedRole?.role_permissions
      ?.map((rp) => rp.permission?.id)
      .filter(Boolean)
  );

  const filteredPermissions = permissions.filter((permission) => {
    const query = permissionSearch.trim().toLowerCase();
    const matchesQuery = !query
      ? true
      : permission.name.toLowerCase().includes(query) ||
        permission.matcher.toLowerCase().includes(query) ||
        (permission.key ?? '').toLowerCase().includes(query);

    const matchesCategory =
      categoryFilter === 'all' ? true : permission.category_id === categoryFilter;
    const matchesAction =
      actionFilter === 'all' ? true : permission.actionType === actionFilter;

    return matchesQuery && matchesCategory && matchesAction;
  });

  const categoryNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => {
      map.set(category.id, category.name);
    });
    return map;
  }, [categories]);

  const groupedPermissions = React.useMemo(() => {
    const map = new Map<string, Permission[]>();
    filteredPermissions.forEach((permission) => {
      const key = permission.category_id ?? 'uncategorized';
      const group = map.get(key) ?? [];
      group.push(permission);
      map.set(key, group);
    });
    return Array.from(map.entries())
      .map(([categoryId, perms]) => ({
        id: categoryId,
        name: categoryNameById.get(categoryId) ?? 'Other',
        permissions: perms,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredPermissions, categoryNameById]);

  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(
    () => new Set()
  );

  React.useEffect(() => {
    if (expandedCategories.size === 0 && groupedPermissions.length) {
      setExpandedCategories(
        new Set(groupedPermissions.map((group) => group.id))
      );
    }
  }, [groupedPermissions, expandedCategories.size]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const togglePermissions = (permissionIds: string[], enable: boolean) => {
    if (!permissionIds.length) {
      return;
    }
    if (enable) {
      const missing = permissionIds.filter((id) => !assignedIds.has(id));
      if (missing.length) {
        addPermissionMutation.mutate(missing);
      }
    } else {
      const present = permissionIds.filter((id) => assignedIds.has(id));
      if (present.length) {
        removePermissionMutation.mutate(present);
      }
    }
  };

  const applyPreset = (actionTypes: ActionType[]) => {
    const allowedIds = permissions
      .filter((permission) => actionTypes.includes(permission.actionType))
      .map((permission) => permission.id);
    const disallowedIds = permissions
      .filter((permission) => !actionTypes.includes(permission.actionType))
      .map((permission) => permission.id);

    togglePermissions(disallowedIds, false);
    togglePermissions(allowedIds, true);
  };

  return (
    <Container className="p-0">
      <div className="flex flex-col gap-6 px-6 py-4">
        <div className="flex items-center justify-between">
          <Heading level="h2">Roles</Heading>
          <Drawer>
            <Drawer.Trigger asChild>
              <Button variant="secondary" size="small">
                Create role
              </Button>
            </Drawer.Trigger>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>Create Role</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body>
                <Form
                  schema={createRoleSchema}
                  onSubmit={async (values) => {
                    await createRoleMutation.mutateAsync(values);
                  }}
                  formProps={{ id: 'create-role-form' }}
                  defaultValues={{ access_level: 'custom' }}
                >
                  <div className="flex flex-col gap-4">
                    <InputField name="name" label="Role name" />
                    <TextareaField name="description" label="Description" />
                    <SelectField name="access_level" label="Access level">
                      <Select.Trigger>
                        <Select.Value placeholder="Select" />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="custom">Custom</Select.Item>
                        <Select.Item value="view">View only</Select.Item>
                        <Select.Item value="edit">Can edit</Select.Item>
                        <Select.Item value="full">Full access</Select.Item>
                      </Select.Content>
                    </SelectField>
                  </div>
                </Form>
              </Drawer.Body>
              <Drawer.Footer>
                <Drawer.Close asChild>
                  <Button variant="secondary">Cancel</Button>
                </Drawer.Close>
                <Button type="submit" form="create-role-form">
                  Create
                </Button>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-2">
            {roles.length === 0 && (
              <Text size="small" className="text-ui-fg-subtle">
                No roles yet. Create one to get started.
              </Text>
            )}
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => onRoleChange(role.id)}
                className={`flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors ${
                  role.id === selectedRoleId
                    ? 'border-ui-border-interactive bg-ui-bg-highlight'
                    : 'border-ui-border-base'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Text weight="plus">{role.name}</Text>
                  {role.is_super ? <Badge color="green">Super</Badge> : null}
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  {role.description || 'No description'}
                </Text>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {!selectedRole && (
              <div className="rounded-md border border-dashed border-ui-border-base p-6">
                <Text>Select a role to edit its permissions.</Text>
              </div>
            )}
            {selectedRole && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Heading level="h3">Edit role</Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      Rename and update description.
                    </Text>
                  </div>
                  <Prompt>
                    <Prompt.Trigger asChild>
                      <Button variant="secondary" size="small" disabled={selectedRole.is_super}>
                        Delete role
                      </Button>
                    </Prompt.Trigger>
                    <Prompt.Content>
                      <Prompt.Header>
                        <Prompt.Title>Delete {selectedRole.name}?</Prompt.Title>
                        <Prompt.Description>
                          This removes the role and its assignments.
                        </Prompt.Description>
                      </Prompt.Header>
                      <Prompt.Footer>
                        <Prompt.Cancel>Cancel</Prompt.Cancel>
                        <Prompt.Action
                          onClick={() => deleteRoleMutation.mutate(selectedRole.id)}
                        >
                          Delete
                        </Prompt.Action>
                      </Prompt.Footer>
                    </Prompt.Content>
                  </Prompt>
                </div>

                <Form
                  schema={updateRoleSchema}
                  onSubmit={async (values) => {
                    await updateRoleMutation.mutateAsync(values);
                  }}
                  formProps={{ id: 'update-role-form' }}
                  defaultValues={{
                    name: selectedRole.name,
                    description: selectedRole.description ?? '',
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <InputField name="name" label="Role name" />
                    <TextareaField name="description" label="Description" />
                  </div>
                  <div className="mt-3">
                    <Button
                      type="submit"
                      size="small"
                      isLoading={updateRoleMutation.isPending}
                      disabled={selectedRole.is_super}
                    >
                      Save changes
                    </Button>
                  </div>
                </Form>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Heading level="h3">Permissions</Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      Assign permissions route-wise or use drag-and-drop.
                    </Text>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      variant={viewMode === 'routes' ? 'primary' : 'secondary'}
                      onClick={() => setViewMode('routes')}
                    >
                      Routes
                    </Button>
                    <Button
                      size="small"
                      variant={viewMode === 'drag' ? 'primary' : 'secondary'}
                      onClick={() => setViewMode('drag')}
                    >
                      Drag
                    </Button>
                  </div>
                </div>

                {selectedRole.is_super && (
                  <div className="rounded-md border border-ui-border-base bg-ui-bg-subtle p-4 mt-4">
                    <Text weight="plus">Full access role</Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      This role has full access and permissions are locked. Create a
                      non-super role to customize access.
                    </Text>
                  </div>
                )}

                {!selectedRole.is_super && viewMode === 'routes' && (
                  <>
                    <div className="mt-4">
                      <Heading level="h3">Presets</Heading>
                      <Text size="small" className="text-ui-fg-subtle">
                        Apply a role baseline in one click.
                      </Text>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => {
                            applyPreset(['read']);
                          }}
                        >
                          Viewer
                        </Button>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => {
                            applyPreset(['read', 'write']);
                          }}
                        >
                          Editor
                        </Button>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => {
                            applyPreset(['read', 'write', 'delete']);
                          }}
                        >
                          Admin
                        </Button>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() =>
                            togglePermissions(
                              Array.from(assignedIds).filter(Boolean) as string[],
                              false
                            )
                          }
                        >
                          Clear all
                        </Button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-[1fr_200px_160px]">
                      <Input
                        placeholder="Search permissions"
                        value={permissionSearch}
                        onChange={(event) => setPermissionSearch(event.target.value)}
                      />
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <Select.Trigger>
                          <Select.Value placeholder="All categories" />
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="all">All categories</Select.Item>
                          {categories.map((category) => (
                            <Select.Item key={category.id} value={category.id}>
                              {category.name}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                      <Select value={actionFilter} onValueChange={setActionFilter}>
                        <Select.Trigger>
                          <Select.Value placeholder="All actions" />
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="all">All actions</Select.Item>
                          <Select.Item value="read">Read</Select.Item>
                          <Select.Item value="write">Write</Select.Item>
                          <Select.Item value="delete">Delete</Select.Item>
                        </Select.Content>
                      </Select>
                    </div>

                    <div className="mt-4 rounded-md border border-ui-border-base">
                      <div className="max-h-[520px] overflow-auto">
                        <Table>
                        <Table.Header>
                          <Table.Row>
                            <Table.HeaderCell>Permission</Table.HeaderCell>
                            <Table.HeaderCell>Method</Table.HeaderCell>
                            <Table.HeaderCell>Path</Table.HeaderCell>
                            <Table.HeaderCell>Action</Table.HeaderCell>
                            <Table.HeaderCell className="text-right">Assigned</Table.HeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {groupedPermissions.length === 0 && (
                            <Table.Row>
                              {/* @ts-ignore */}
                              <Table.Cell colSpan={5}>
                                <Text size="small" className="text-ui-fg-subtle">
                                  No permissions match your filters.
                                </Text>
                              </Table.Cell>
                            </Table.Row>
                          )}
                          {groupedPermissions.map((group) => {
                            const groupPermissionIds = group.permissions.map((perm) => perm.id);
                            const assignedCount = groupPermissionIds.filter((id) =>
                              assignedIds.has(id)
                            ).length;
                            const allAssigned = groupPermissionIds.length > 0 &&
                              assignedCount === groupPermissionIds.length;

                            return (
                              <React.Fragment key={group.id}>
                                <Table.Row>
                                  <Table.Cell colSpan={5}>
                                    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-ui-bg-base py-2">
                                      <button
                                        type="button"
                                        className="flex items-center gap-2 text-left"
                                        onClick={() => toggleCategory(group.id)}
                                      >
                                        <Text weight="plus">
                                          {expandedCategories.has(group.id) ? '▾' : '▸'} {group.name}
                                        </Text>
                                        <Badge color="grey">
                                          {assignedCount}/{groupPermissionIds.length}
                                        </Badge>
                                      </button>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="small"
                                          variant="secondary"
                                          onClick={() => togglePermissions(groupPermissionIds, true)}
                                          disabled={allAssigned}
                                        >
                                          Assign all
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="secondary"
                                          onClick={() => togglePermissions(groupPermissionIds, false)}
                                          disabled={assignedCount === 0}
                                        >
                                          Remove all
                                        </Button>
                                      </div>
                                    </div>
                                  </Table.Cell>
                                </Table.Row>
                                {expandedCategories.has(group.id) &&
                                  group.permissions.map((permission) => {
                                    const isAssigned = assignedIds.has(permission.id);
                                    return (
                                      <Table.Row key={permission.id}>
                                        <Table.Cell>
                                          <div className="flex flex-col">
                                            <Text weight="plus">{permission.name}</Text>
                                            <Text size="small" className="text-ui-fg-subtle">
                                              {permission.key}
                                            </Text>
                                          </div>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <Badge color="grey">{permission.method}</Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <Text size="small">{permission.path}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <Badge color="blue">{permission.actionType}</Badge>
                                        </Table.Cell>
                                        <Table.Cell className="text-right">
                                          <Switch
                                            checked={isAssigned}
                                            onClick={() =>
                                              togglePermissions([permission.id], !isAssigned)
                                            }
                                          />
                                        </Table.Cell>
                                      </Table.Row>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          })}
                        </Table.Body>
                      </Table>
                      </div>
                    </div>
                  </>
                )}

                {!selectedRole.is_super && viewMode === 'drag' && (
                  <>
                    <div className="mt-2">
                      <Input
                        placeholder="Search permissions"
                        value={permissionSearch}
                        onChange={(event) => setPermissionSearch(event.target.value)}
                      />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div
                        className="min-h-[260px] rounded-md border border-ui-border-base p-3"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const permissionId = event.dataTransfer.getData('permission_id');
                          if (permissionId && assignedIds.has(permissionId)) {
                            removePermissionMutation.mutate([permissionId]);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Text weight="plus">Assigned</Text>
                          <Badge color="green">{assignedIds.size}</Badge>
                        </div>
                        <div className="flex flex-col gap-2">
                          {filteredPermissions
                            .filter((permission) => assignedIds.has(permission.id))
                            .map((permission) => (
                              <PermissionChip key={permission.id} permission={permission} />
                            ))}
                          {filteredPermissions.filter((permission) => assignedIds.has(permission.id))
                            .length === 0 && (
                            <Text size="small" className="text-ui-fg-subtle">
                              Drop permissions here to grant access.
                            </Text>
                          )}
                        </div>
                      </div>

                      <div
                        className="min-h-[260px] rounded-md border border-dashed border-ui-border-base p-3"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const permissionId = event.dataTransfer.getData('permission_id');
                          if (permissionId && !assignedIds.has(permissionId)) {
                            addPermissionMutation.mutate([permissionId]);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Text weight="plus">Available</Text>
                          <Badge color="blue">{permissions.length - assignedIds.size}</Badge>
                        </div>
                        <div className="flex flex-col gap-2">
                          {filteredPermissions
                            .filter((permission) => !assignedIds.has(permission.id))
                            .map((permission) => (
                              <PermissionChip key={permission.id} permission={permission} />
                            ))}
                          {filteredPermissions.filter((permission) => !assignedIds.has(permission.id))
                            .length === 0 && (
                            <Text size="small" className="text-ui-fg-subtle">
                              All matching permissions are assigned.
                            </Text>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
};


const RbacPage = () => {
  const rolesQuery = useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: () =>
      adminFetch<{ roles: Role[] }>(
        '/admin/rbac/roles?include_permissions=true'
      ),
  });

  const permissionsQuery = useQuery({
    queryKey: ['rbac', 'permissions'],
    queryFn: () =>
      adminFetch<{ permissions: Permission[] }>(
        '/admin/rbac/permissions?page=1&limit=200'
      ),
  });

  const categoriesQuery = useQuery({
    queryKey: ['rbac', 'categories'],
    queryFn: () =>
      adminFetch<{ categories: PermissionCategory[] }>(
        '/admin/rbac/permission-categories?limit=200'
      ),
  });

  const roles = rolesQuery.data?.roles ?? [];
  const permissions = permissionsQuery.data?.permissions ?? [];
  const categories = categoriesQuery.data?.categories ?? [];

  const [selectedRoleId, setSelectedRoleId] = React.useState<string>('');

  React.useEffect(() => {
    if (!selectedRoleId && roles.length) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  return (
    <div className="flex flex-col gap-6">
      <RoleBuilder
        roles={roles}
        permissions={permissions}
        categories={categories}
        selectedRoleId={selectedRoleId}
        onRoleChange={setSelectedRoleId}
      />
    </div>
  );
};

export default withQueryClient(RbacPage);

export const config = defineRouteConfig({
  label: 'RBAC',
  icon: ShieldCheck,
});
