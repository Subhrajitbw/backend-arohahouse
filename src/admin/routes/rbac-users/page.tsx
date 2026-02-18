import * as React from 'react';
import { defineRouteConfig } from '@medusajs/admin-sdk';
import { UserGroup } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Switch,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  is_super: boolean;
};

type User = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  roles?: Role[];
};

const RbacUsersPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const usersQuery = useQuery({
    queryKey: ['rbac', 'users-table'],
    queryFn: () =>
      adminFetch<{ users: User[] }>('/admin/rbac/users?limit=200&offset=0'),
  });

  const rolesQuery = useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: () => adminFetch<{ roles: Role[] }>('/admin/rbac/roles?include_permissions=false'),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) =>
      adminFetch(`/admin/rbac/users/${userId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ role_ids: [roleId] }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rbac', 'users-table'] });
      toast.success('Role assigned');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Failed to assign role');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) =>
      adminFetch(`/admin/rbac/users/${userId}/roles`, {
        method: 'DELETE',
        body: JSON.stringify({ role_ids: [roleId] }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rbac', 'users-table'] });
      toast.success('Role removed');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Failed to remove role');
    },
  });

  const users = usersQuery.data?.users ?? [];
  const roles = rolesQuery.data?.roles ?? [];

  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      user.email.toLowerCase().includes(query) ||
      `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim().toLowerCase().includes(query)
    );
  });

  const openDrawer = (user: User) => {
    setSelectedUser(user);
    setDrawerOpen(true);
  };

  return (
    <Container className="px-0">
      <div className="px-6 py-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserGroup />
            <Heading level="h2">RBAC Users</Heading>
          </div>
          <Input
            placeholder="Search users"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-[320px]"
          />
        </div>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>User</Table.HeaderCell>
            <Table.HeaderCell>Email</Table.HeaderCell>
            <Table.HeaderCell>Roles</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {usersQuery.isLoading && (
            <Table.Row>
              {/* @ts-ignore */}
              <Table.Cell colSpan={4}>
                <Text>Loading users...</Text>
              </Table.Cell>
            </Table.Row>
          )}
          {usersQuery.isError && (
            <Table.Row>
              {/* @ts-ignore */}
              <Table.Cell colSpan={4}>
                <Text>Failed to load users.</Text>
              </Table.Cell>
            </Table.Row>
          )}
          {!usersQuery.isLoading && filteredUsers.length === 0 && (
            <Table.Row>
              {/* @ts-ignore */}
              <Table.Cell colSpan={4}>
                <Text>No users found.</Text>
              </Table.Cell>
            </Table.Row>
          )}
          {filteredUsers.map((user) => (
            <Table.Row key={user.id}>
              <Table.Cell>
                <Text>
                  {user.first_name || user.last_name
                    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
                    : '—'}
                </Text>
              </Table.Cell>
              <Table.Cell>{user.email}</Table.Cell>
              <Table.Cell>
                <div className="flex flex-wrap gap-1">
                  {(user.roles ?? []).length === 0 && (
                    <Text size="small" className="text-ui-fg-subtle">
                      None
                    </Text>
                  )}
                  {(user.roles ?? []).map((role) => (
                    <Badge key={role.id} color={role.is_super ? 'green' : 'grey'}>
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </Table.Cell>
              <Table.Cell className="text-right">
                <Button size="small" variant="secondary" onClick={() => openDrawer(user)}>
                  Edit roles
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Edit Roles</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body>
            {selectedUser && (
              <div className="flex flex-col gap-4">
                <div>
                  <Text weight="plus">{selectedUser.email}</Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    Toggle roles for this user.
                  </Text>
                </div>
                <div className="flex flex-col gap-2">
                  {roles.map((role) => {
                    const assigned = (selectedUser.roles ?? []).some((r) => r.id === role.id);
                    return (
                      <div
                        key={role.id}
                        className="flex items-center justify-between rounded-md border border-ui-border-base px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Text>{role.name}</Text>
                          {role.is_super ? <Badge color="green">Super</Badge> : null}
                        </div>
                        <Switch
                          checked={assigned}
                          onClick={() => {
                            if (assigned) {
                              removeMutation.mutate({ userId: selectedUser.id, roleId: role.id });
                            } else {
                              assignMutation.mutate({ userId: selectedUser.id, roleId: role.id });
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Done</Button>
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  );
};

export default withQueryClient(RbacUsersPage);

export const config = defineRouteConfig({
  label: 'RBAC Users',
  icon: UserGroup,
});
